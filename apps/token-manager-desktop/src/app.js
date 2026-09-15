// Pas de serveur : l'état vit dans un fichier JSON posé sur un dossier partagé (OneDrive,
// réseau...). Chaque action relit le fichier avant d'écrire pour réduire (sans l'éliminer) le
// risque d'écrasement si deux personnes agissent au même instant — un compromis volontaire
// pour rester simple plutôt que d'implémenter un vrai verrou distribué.
const { open, save } = window.__TAURI__.dialog;
const { readTextFile, writeTextFile, exists } = window.__TAURI__.fs;

const LAST_FILE_KEY = 'tokenManagerDesktop:lastFile';
const POLL_MS = 4000;

const errorEl = document.getElementById('error');
const launcherView = document.getElementById('launcher-view');
const createView = document.getElementById('create-view');
const sessionView = document.getElementById('session-view');

const nameEl = document.getElementById('session-name');
const descEl = document.getElementById('session-description');
const pathEl = document.getElementById('session-path');
const whoamiSelect = document.getElementById('whoami-select');
const resourcesEl = document.getElementById('resources');
const historyEl = document.getElementById('history');
const resourceTemplate = document.getElementById('resource-template');

let filePath = null;
let data = null;
let pollTimer = null;
let formOpen = false;

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
}

function showView(view) {
  launcherView.hidden = view !== 'launcher';
  createView.hidden = view !== 'create';
  sessionView.hidden = view !== 'session';
}

function whoamiKey() {
  return `tokenManagerDesktop:whoami:${filePath}`;
}
function getWhoAmI() {
  return localStorage.getItem(whoamiKey()) || '';
}
function setWhoAmI(id) {
  localStorage.setItem(whoamiKey(), id);
}

function newId() {
  return crypto.randomUUID();
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

// --- Fichier ---

async function readData(path) {
  const raw = await readTextFile(path);
  return JSON.parse(raw);
}

async function persist() {
  await writeTextFile(filePath, JSON.stringify(data, null, 2));
}

async function openFile(path) {
  try {
    data = await readData(path);
  } catch (err) {
    showError(`Impossible d'ouvrir ce fichier : ${err}`);
    return false;
  }
  filePath = path;
  localStorage.setItem(LAST_FILE_KEY, path);
  clearError();
  render();
  showView('session');
  startPolling();
  return true;
}

function closeFile() {
  stopPolling();
  filePath = null;
  data = null;
  showView('launcher');
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (formOpen || !filePath) return;
    try {
      data = await readData(filePath);
      clearError();
      render();
    } catch (err) {
      showError(`Le fichier est devenu inaccessible : ${err}`);
    }
  }, POLL_MS);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// --- Rendu ---

function render() {
  nameEl.textContent = data.name;
  descEl.textContent = data.description || '';
  pathEl.textContent = filePath;
  renderWhoami();
  renderResources();
  renderHistory();
}

function renderWhoami() {
  const current = getWhoAmI();
  whoamiSelect.innerHTML = '<option value="">— Sélectionnez votre nom —</option>';
  for (const p of data.participants) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === current) opt.selected = true;
    whoamiSelect.appendChild(opt);
  }
}

function renderResources() {
  resourcesEl.innerHTML = '';
  const me = getWhoAmI();
  for (const resource of data.resources) {
    const node = resourceTemplate.content.cloneNode(true);
    node.querySelector('.r-name').textContent = resource.name;
    const icon = node.querySelector('.r-icon');
    const badge = node.querySelector('.r-badge');
    const status = node.querySelector('.r-status');
    const actions = node.querySelector('.r-actions');

    if (resource.status === 'available') {
      icon.src = '/token-dispo.webp';
      icon.alt = 'Token disponible';
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
      icon.src = '/token-vide.webp';
      icon.alt = 'Token utilisé';
      badge.textContent = 'Pris';
      badge.classList.add('badge-taken');
      status.textContent = `Par ${resource.holder.name} — ${resource.holder.justification}`;

      if (resource.holder.participantId === me) {
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

function renderHistory() {
  const entries = data.history || [];
  if (!entries.length) {
    historyEl.className = 'empty-state';
    historyEl.textContent = 'Aucune activité pour le moment.';
    return;
  }
  historyEl.className = '';
  historyEl.innerHTML = '';
  for (const entry of [...entries].reverse()) {
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

// --- Actions ---

async function withFreshData(mutator) {
  clearError();
  try {
    data = await readData(filePath);
    mutator(data);
    await persist();
  } catch (err) {
    showError(`Action impossible : ${err}`);
    throw err;
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
    const me = getWhoAmI();
    const participant = data.participants.find((p) => p.id === me);
    try {
      await withFreshData((fresh) => {
        const r = fresh.resources.find((x) => x.id === resource.id);
        if (!r || r.status !== 'available') throw new Error('Ce token vient d\'être pris par quelqu\'un d\'autre — relancez.');
        r.status = 'taken';
        r.holder = { participantId: me, name: participant.name, justification: textarea.value };
        fresh.history.push({
          action: 'take',
          participant: participant.name,
          resourceName: r.name,
          message: textarea.value,
          timestamp: new Date().toISOString(),
        });
      });
      formOpen = false;
      render();
    } catch {
      // l'erreur est déjà affichée par withFreshData
    }
  });
  const cancel = document.createElement('button');
  cancel.className = 'btn-secondary';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', () => {
    formOpen = false;
    render();
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
    const me = getWhoAmI();
    try {
      await withFreshData((fresh) => {
        const r = fresh.resources.find((x) => x.id === resource.id);
        if (!r || r.status !== 'taken' || r.holder.participantId !== me) {
          throw new Error('Ce token n\'est plus dans l\'état attendu — relancez.');
        }
        const holderName = r.holder.name;
        r.status = 'available';
        r.holder = null;
        fresh.history.push({
          action: 'release',
          participant: holderName,
          resourceName: r.name,
          message: textarea.value,
          timestamp: new Date().toISOString(),
        });
      });
      formOpen = false;
      render();
    } catch {
      // l'erreur est déjà affichée par withFreshData
    }
  });
  const cancel = document.createElement('button');
  cancel.className = 'btn-secondary';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', () => {
    formOpen = false;
    render();
  });
  container.appendChild(field);
  container.appendChild(submit);
  container.appendChild(cancel);
}

document.getElementById('add-participant-btn').addEventListener('click', async () => {
  const input = document.getElementById('add-participant-input');
  const name = input.value.trim();
  if (!name) return;
  await withFreshData((fresh) => {
    fresh.participants.push({ id: newId(), name });
  });
  input.value = '';
  render();
});

document.getElementById('add-resource-btn').addEventListener('click', async () => {
  const input = document.getElementById('add-resource-input');
  const name = input.value.trim();
  if (!name) return;
  await withFreshData((fresh) => {
    fresh.resources.push({ id: newId(), name, status: 'available', holder: null });
  });
  input.value = '';
  render();
});

whoamiSelect.addEventListener('change', () => {
  setWhoAmI(whoamiSelect.value);
  render();
});

document.getElementById('switch-file-btn').addEventListener('click', closeFile);

// --- Écran de lancement ---

document.getElementById('open-btn').addEventListener('click', async () => {
  const picked = await open({
    multiple: false,
    filters: [{ name: 'Session de tokens', extensions: ['json'] }],
    title: 'Ouvrir un fichier de session',
  });
  if (picked) await openFile(picked);
});

document.getElementById('create-btn').addEventListener('click', () => {
  showView('create');
});
document.getElementById('create-cancel-btn').addEventListener('click', () => {
  showView('launcher');
});

document.getElementById('create-confirm-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-name').value.trim();
  if (!name) {
    showError('Le nom de la session est requis.');
    return;
  }
  const description = document.getElementById('new-description').value.trim();
  const participantNames = document.getElementById('new-participants').value
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const resourceNames = document.getElementById('new-resources').value
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const savePath = await save({
    filters: [{ name: 'Session de tokens', extensions: ['json'] }],
    defaultPath: `${name.replace(/[\\/:*?"<>|]/g, '_')}.token.json`,
    title: 'Choisir où enregistrer le fichier de session (dossier partagé recommandé)',
  });
  if (!savePath) return;

  const initial = {
    version: 1,
    name,
    description,
    participants: participantNames.map((n) => ({ id: newId(), name: n })),
    resources: (resourceNames.length ? resourceNames : ['Accès principal']).map((n) => ({
      id: newId(),
      name: n,
      status: 'available',
      holder: null,
    })),
    history: [],
  };

  clearError();
  try {
    data = initial;
    filePath = savePath;
    await persist();
  } catch (err) {
    showError(`Impossible de créer le fichier : ${err}`);
    return;
  }

  localStorage.setItem(LAST_FILE_KEY, savePath);
  showView('session');
  render();
  startPolling();
});

// --- Démarrage ---

(async function init() {
  const last = localStorage.getItem(LAST_FILE_KEY);
  if (last && (await exists(last).catch(() => false))) {
    const ok = await openFile(last);
    if (ok) return;
  }
  showView('launcher');
})();
