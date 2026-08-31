import { apiFetch, ensureApiBaseConfigured, isDesktop } from './api.js';

const PASSWORD_KEY = 'tokenManagerAdminPassword';
const errorEl = document.getElementById('error');
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const logoutBtn = document.getElementById('logout-btn');
const sessionsList = document.getElementById('sessions-list');
const rowTemplate = document.getElementById('session-row-template');

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
  const origin = window.location.origin;
  return `${origin}/session/${slug}`;
}

async function refreshSessions() {
  sessionsList.textContent = 'Chargement…';
  try {
    const sessions = await adminFetch('/api/admin/sessions');
    if (!sessions.length) {
      sessionsList.innerHTML = '';
      sessionsList.className = 'empty-state';
      sessionsList.textContent = 'Aucune session pour le moment.';
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
      const link = sessionLink(session.slug);
      const linkInput = node.querySelector('.s-link');
      linkInput.value = link;
      node.querySelector('.s-open').href = link;
      node.querySelector('.s-copy').addEventListener('click', async () => {
        await navigator.clipboard.writeText(link);
      });
      node.querySelector('.s-delete').addEventListener('click', async () => {
        if (!window.confirm(`Supprimer la session "${session.name}" ? Cette action est irréversible.`)) return;
        try {
          await adminFetch(`/api/admin/sessions/${session.slug}`, { method: 'DELETE' });
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

  if (!name.trim()) {
    showError('Le nom de la session est requis.');
    return;
  }

  try {
    await adminFetch('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, description, participants, resources }),
    });
    document.getElementById('new-name').value = '';
    document.getElementById('new-description').value = '';
    document.getElementById('new-participants').value = '';
    document.getElementById('new-resources').value = '';
    await refreshSessions();
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
    await refreshSessions();
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById('login-btn').addEventListener('click', () => {
  const password = document.getElementById('password').value;
  tryLogin(password);
});
document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});
document.getElementById('create-btn').addEventListener('click', handleCreate);
logoutBtn.addEventListener('click', () => {
  clearPassword();
  appView.hidden = true;
  logoutBtn.hidden = true;
  loginView.hidden = false;
});

(async function init() {
  const ready = await ensureApiBaseConfigured();
  if (!ready && isDesktop()) {
    showError("Aucun serveur configuré. Rechargez la page pour réessayer.");
    return;
  }
  const existing = getPassword();
  if (existing) {
    await tryLogin(existing);
  }
})();
