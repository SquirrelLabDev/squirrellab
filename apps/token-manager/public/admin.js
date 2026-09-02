import { apiFetch, ensureApiBaseConfigured, isDesktop } from './api.js';

const PASSWORD_KEY = 'tokenManagerAdminPassword';
const errorEl = document.getElementById('error');
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const logoutBtn = document.getElementById('logout-btn');
const creatorsList = document.getElementById('creators-list');
const creatorRowTemplate = document.getElementById('creator-row-template');
const sessionsList = document.getElementById('sessions-list');
const sessionRowTemplate = document.getElementById('session-row-template');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
}

function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || '';
}
function setPassword(pw) {
  sessionStorage.setItem(PASSWORD_KEY, pw);
}
function clearPassword() {
  sessionStorage.removeItem(PASSWORD_KEY);
}

async function adminFetch(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: { ...(options.headers || {}), 'x-admin-password': getPassword() },
  });
}

function sessionLink(slug) {
  return `${window.location.origin}/session/${slug}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

function expiryText(expiresAt) {
  return expiresAt ? `Suppression prévue le ${formatDate(expiresAt)}.` : 'Pas de suppression automatique.';
}

async function refreshCreators() {
  creatorsList.textContent = 'Chargement…';
  try {
    const creators = await adminFetch('/api/admin/creators');
    if (!creators.length) {
      creatorsList.className = 'empty-state';
      creatorsList.textContent = 'Aucun compte créateur pour le moment.';
      return;
    }
    creatorsList.className = '';
    creatorsList.innerHTML = '';
    for (const creator of creators) {
      const node = creatorRowTemplate.content.cloneNode(true);
      node.querySelector('.c-username').textContent = creator.username;
      node.querySelector('.c-created').textContent = formatDate(creator.createdAt);
      node.querySelector('.c-sessions').textContent = creator.sessionCount;
      node.querySelector('.c-delete').addEventListener('click', async () => {
        if (!window.confirm(`Supprimer le compte "${creator.username}" et toutes ses sessions ? Action irréversible.`)) return;
        try {
          await adminFetch(`/api/admin/creators/${creator.id}`, { method: 'DELETE' });
          await Promise.all([refreshCreators(), refreshSessions()]);
        } catch (err) {
          showError(err.message);
        }
      });
      creatorsList.appendChild(node);
    }
  } catch (err) {
    showError(err.message);
  }
}

async function refreshSessions() {
  sessionsList.textContent = 'Chargement…';
  try {
    const sessions = await adminFetch('/api/admin/sessions');
    if (!sessions.length) {
      sessionsList.className = 'empty-state';
      sessionsList.textContent = 'Aucune session pour le moment.';
      return;
    }
    sessionsList.className = '';
    sessionsList.innerHTML = '';
    for (const session of sessions) {
      const node = sessionRowTemplate.content.cloneNode(true);
      node.querySelector('.s-name').textContent = session.name;
      node.querySelector('.s-desc').textContent = session.description || '';
      node.querySelector('.s-owner').textContent = session.ownerUsername;
      node.querySelector('.s-participants').textContent = session.participantCount;
      node.querySelector('.s-resources').textContent = session.resourceCount;
      node.querySelector('.s-expiry').textContent = expiryText(session.expiresAt);
      const link = sessionLink(session.slug);
      node.querySelector('.s-link').value = link;
      node.querySelector('.s-open').href = link;
      node.querySelector('.s-delete').addEventListener('click', async () => {
        if (!window.confirm(`Supprimer la session "${session.name}" ? Cette action est irréversible.`)) return;
        try {
          await adminFetch(`/api/admin/sessions/${session.slug}`, { method: 'DELETE' });
          await Promise.all([refreshSessions(), refreshCreators()]);
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
          await adminFetch(`/api/admin/sessions/${session.slug}/expiry`, {
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

async function tryLogin(password) {
  clearError();
  try {
    await apiFetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    setPassword(password);
    loginView.hidden = true;
    appView.hidden = false;
    logoutBtn.hidden = false;
    await Promise.all([refreshCreators(), refreshSessions()]);
  } catch (err) {
    showError(err.message);
  }
}

for (const btn of document.querySelectorAll('.toggle-password')) {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-label', showing ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
  });
}

document.getElementById('login-btn').addEventListener('click', () => {
  const password = document.getElementById('password').value;
  tryLogin(password);
});
document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});
logoutBtn.addEventListener('click', () => {
  clearPassword();
  appView.hidden = true;
  logoutBtn.hidden = true;
  loginView.hidden = false;
});

(async function init() {
  const ready = await ensureApiBaseConfigured();
  if (!ready && isDesktop()) {
    showError('Aucun serveur configuré. Rechargez la page pour réessayer.');
    return;
  }
  const existing = getPassword();
  if (existing) {
    await tryLogin(existing);
  }
})();
