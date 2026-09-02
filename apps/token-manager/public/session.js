import { apiFetch, ensureApiBaseConfigured } from './api.js';

const slug = window.location.pathname.split('/').filter(Boolean).pop();
const errorEl = document.getElementById('error');
const nameEl = document.getElementById('session-name');
const descEl = document.getElementById('session-description');
const expiryEl = document.getElementById('session-expiry');
const whoamiSelect = document.getElementById('whoami-select');
const resourcesEl = document.getElementById('resources');
const historyEl = document.getElementById('history');
const resourceTemplate = document.getElementById('resource-template');

const WHOAMI_KEY = `tokenManagerWhoAmI:${slug}`;
let pollTimer = null;
// While a take/release form is open, the periodic poll must not touch the DOM —
// rebuilding the resources list mid-typing was wiping/closing the open textarea.
let formOpen = false;

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
}

function getWhoAmI() {
  return localStorage.getItem(WHOAMI_KEY) || '';
}
function setWhoAmI(id) {
  localStorage.setItem(WHOAMI_KEY, id);
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderWhoami(session) {
  const current = getWhoAmI();
  whoamiSelect.innerHTML = '<option value="">— Sélectionnez votre nom —</option>';
  for (const p of session.participants) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === current) opt.selected = true;
    whoamiSelect.appendChild(opt);
  }
}

function renderResources(session) {
  resourcesEl.innerHTML = '';
  const me = getWhoAmI();
  for (const resource of session.resources) {
    const node = resourceTemplate.content.cloneNode(true);
    node.querySelector('.r-name').textContent = resource.name;
    const badge = node.querySelector('.r-badge');
    const status = node.querySelector('.r-status');
    const actions = node.querySelector('.r-actions');

    if (resource.status === 'available') {
      badge.textContent = 'Disponible';
      badge.classList.add('badge-available');
      status.textContent = '';

      const takeBtn = document.createElement('button');
      takeBtn.className = 'btn-primary';
      takeBtn.textContent = 'Prendre le token';
      takeBtn.disabled = !me;
      takeBtn.title = me ? '' : 'Sélectionnez votre nom pour agir.';
      takeBtn.addEventListener('click', () => showTakeForm(actions, resource));
      actions.appendChild(takeBtn);
    } else {
      badge.textContent = 'Pris';
      badge.classList.add('badge-taken');
      status.textContent = `Par ${resource.holder.name} — ${resource.justification}`;

      if (resource.holder.id === me) {
        const releaseBtn = document.createElement('button');
        releaseBtn.className = 'btn-primary';
        releaseBtn.textContent = 'Reposer le token';
        releaseBtn.addEventListener('click', () => showReleaseForm(actions, resource));
        actions.appendChild(releaseBtn);
      }
    }

    resourcesEl.appendChild(node);
  }
}

function showTakeForm(container, resource) {
  formOpen = true;
  container.innerHTML = '';
  const field = document.createElement('div');
  field.className = 'field';
  field.innerHTML = `
    <label>Justification (pourquoi prenez-vous ce token ?)</label>
    <textarea placeholder="Ex : ajout du KPI marge sur la page 2"></textarea>
  `;
  const textarea = field.querySelector('textarea');
  const submit = document.createElement('button');
  submit.className = 'btn-primary';
  submit.textContent = 'Confirmer';
  submit.addEventListener('click', async () => {
    clearError();
    try {
      await apiFetch(`/api/sessions/${slug}/resources/${resource.id}/take`, {
        method: 'POST',
        body: JSON.stringify({ participantId: getWhoAmI(), justification: textarea.value }),
      });
      formOpen = false;
      await refresh();
    } catch (err) {
      showError(err.message);
    }
  });
  const cancel = document.createElement('button');
  cancel.className = 'btn-secondary';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', async () => {
    formOpen = false;
    await refresh();
  });
  container.appendChild(field);
  container.appendChild(submit);
  container.appendChild(cancel);
}

function showReleaseForm(container, resource) {
  formOpen = true;
  container.innerHTML = '';
  const field = document.createElement('div');
  field.className = 'field';
  field.innerHTML = `
    <label>Qu'avez-vous fait ? (comme un message de commit)</label>
    <textarea placeholder="Ex : ajout du KPI marge, publié sur le service Power BI"></textarea>
  `;
  const textarea = field.querySelector('textarea');
  const submit = document.createElement('button');
  submit.className = 'btn-primary';
  submit.textContent = 'Reposer';
  submit.addEventListener('click', async () => {
    clearError();
    try {
      await apiFetch(`/api/sessions/${slug}/resources/${resource.id}/release`, {
        method: 'POST',
        body: JSON.stringify({ participantId: getWhoAmI(), message: textarea.value }),
      });
      formOpen = false;
      await refresh();
    } catch (err) {
      showError(err.message);
    }
  });
  const cancel = document.createElement('button');
  cancel.className = 'btn-secondary';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', async () => {
    formOpen = false;
    await refresh();
  });
  container.appendChild(field);
  container.appendChild(submit);
  container.appendChild(cancel);
}

function renderHistory(session) {
  const entries = session.history || [];
  if (!entries.length) {
    historyEl.className = 'empty-state';
    historyEl.textContent = 'Aucune activité pour le moment.';
    return;
  }
  historyEl.className = '';
  historyEl.innerHTML = '';
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'history-item';
    const icon = entry.action === 'take' ? '📥' : '📤';
    const verb = entry.action === 'take' ? 'a pris' : 'a reposé';
    row.innerHTML = `
      <span class="history-icon">${icon}</span>
      <div>
        <div><strong>${entry.participant}</strong> ${verb} <em>${entry.resourceName}</em></div>
        <div>${entry.message}</div>
        <div class="history-meta">${formatTimestamp(entry.timestamp)}</div>
      </div>
    `;
    historyEl.appendChild(row);
  }
}

async function refresh() {
  if (formOpen) return;
  try {
    const session = await apiFetch(`/api/sessions/${slug}`);
    clearError();
    nameEl.textContent = session.name;
    descEl.textContent = session.description || '';
    expiryEl.textContent = session.expiresAt
      ? `Cette session sera automatiquement supprimée le ${new Date(session.expiresAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}.`
      : '';
    renderWhoami(session);
    renderResources(session);
    renderHistory(session);
  } catch (err) {
    showError(err.message);
  }
}

whoamiSelect.addEventListener('change', () => {
  setWhoAmI(whoamiSelect.value);
  refresh();
});

(async function init() {
  if (!slug) {
    showError('Aucune session spécifiée.');
    return;
  }
  const ready = await ensureApiBaseConfigured();
  if (!ready) {
    showError('Aucun serveur configuré.');
    return;
  }
  await refresh();
  pollTimer = setInterval(refresh, 5000);
})();

window.addEventListener('beforeunload', () => {
  if (pollTimer) clearInterval(pollTimer);
});
