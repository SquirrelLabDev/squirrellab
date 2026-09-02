import { apiFetch, ensureApiBaseConfigured, isDesktop } from './api.js';

const TOKEN_KEY = 'tokenManagerCreatorToken';
const errorEl = document.getElementById('error');
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const logoutBtn = document.getElementById('logout-btn');
const sessionsList = document.getElementById('sessions-list');
const rowTemplate = document.getElementById('session-row-template');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}
function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function creatorFetch(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
}

function sessionLink(slug) {
  const origin = window.location.origin;
  return `${origin}/session/${slug}`;
}

function expiryText(expiresAt) {
  if (!expiresAt) return 'Pas de suppression automatique.';
  const date = new Date(expiresAt).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  return `Suppression automatique prévue le ${date}.`;
}

async function refreshSessions() {
  sessionsList.textContent = 'Chargement…';
  try {
    const sessions = await creatorFetch('/api/creator/sessions');
    if (!sessions.length) {
      sessionsList.innerHTML = '';
      sessionsList.className = 'empty-state';
      sessionsList.textContent = "Vous n'avez pas encore créé de session.";
      return;
    }
    sessionsList.className = '';
    sessionsList.innerHTML = '';
    for (const session of sessions) {
      const node = rowTemplate.content.cloneNode(true);
      node.querySelector('.s-name').textContent = session.name;
      node.querySelector('.s-desc').textContent = session.description || '';
      node.querySelector('.s-participants').textContent = session.participantCount;
      node.querySelector('.s-resources').textContent = session.resourceCount;
      node.querySelector('.s-expiry').textContent = expiryText(session.expiresAt);
      const link = sessionLink(session.slug);
      node.querySelector('.s-link').value = link;
      node.querySelector('.s-open').href = link;
      node.querySelector('.s-copy').addEventListener('click', async () => {
        await navigator.clipboard.writeText(link);
      });
      node.querySelector('.s-delete').addEventListener('click', async () => {
        if (!window.confirm(`Supprimer la session "${session.name}" ? Cette action est irréversible.`)) return;
        try {
          await creatorFetch(`/api/creator/sessions/${session.slug}`, { method: 'DELETE' });
          await refreshSessions();
        } catch (err) {
          showError(err.message);
        }
      });

      const expiryForm = node.querySelector('.s-expiry-form');
      const expiryInput = node.querySelector('.s-expiry-input');
      node.querySelector('.s-edit-expiry').addEventListener('click', () => {
        expiryInput.value = '';
        expiryForm.hidden = false;
      });
      node.querySelector('.s-expiry-cancel').addEventListener('click', () => {
        expiryForm.hidden = true;
      });
      node.querySelector('.s-expiry-save').addEventListener('click', async () => {
        if (expiryInput.value === '') {
          showError('Indiquez un nombre de jours (0 pour ne jamais supprimer).');
          return;
        }
        try {
          await creatorFetch(`/api/creator/sessions/${session.slug}/expiry`, {
            method: 'PATCH',
            body: JSON.stringify({ expiryDays: Number(expiryInput.value) }),
          });
          await refreshSessions();
        } catch (err) {
          showError(err.message);
        }
      });

      sessionsList.appendChild(node);
    }
  } catch (err) {
    showError(err.message);
  }
}

function linesToList(value) {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

async function handleCreate() {
  clearError();
  const name = document.getElementById('new-name').value;
  const description = document.getElementById('new-description').value;
  const participants = linesToList(document.getElementById('new-participants').value);
  const resources = linesToList(document.getElementById('new-resources').value);
  const expiryDays = document.getElementById('new-expiry-days').value;

  if (!name.trim()) {
    showError('Le nom de la session est requis.');
    return;
  }

  try {
    await creatorFetch('/api/creator/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, description, participants, resources, expiryDays: Number(expiryDays) }),
    });
    document.getElementById('new-name').value = '';
    document.getElementById('new-description').value = '';
    document.getElementById('new-participants').value = '';
    document.getElementById('new-resources').value = '';
    document.getElementById('new-expiry-days').value = '365';
    await refreshSessions();
  } catch (err) {
    showError(err.message);
  }
}

function showLoggedIn() {
  authView.hidden = true;
  appView.hidden = false;
  logoutBtn.hidden = false;
}

function showLoggedOut() {
  authView.hidden = false;
  appView.hidden = true;
  logoutBtn.hidden = true;
}

for (const btn of document.querySelectorAll('.toggle-password')) {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-label', showing ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
  });
}

document.getElementById('tab-login').addEventListener('click', () => {
  loginForm.hidden = false;
  signupForm.hidden = true;
});
document.getElementById('tab-signup').addEventListener('click', () => {
  loginForm.hidden = true;
  signupForm.hidden = false;
});

document.getElementById('login-btn').addEventListener('click', async () => {
  clearError();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const { token } = await apiFetch('/api/creators/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(token);
    showLoggedIn();
    await refreshSessions();
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
  clearError();
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;
  try {
    const { token } = await apiFetch('/api/creators/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(token);
    showLoggedIn();
    await refreshSessions();
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById('create-btn').addEventListener('click', handleCreate);

logoutBtn.addEventListener('click', async () => {
  try {
    await creatorFetch('/api/creators/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  clearToken();
  showLoggedOut();
});

(async function init() {
  const ready = await ensureApiBaseConfigured();
  if (!ready && isDesktop()) {
    showError('Aucun serveur configuré. Rechargez la page pour réessayer.');
    return;
  }
  if (getToken()) {
    showLoggedIn();
    await refreshSessions();
  }
})();
