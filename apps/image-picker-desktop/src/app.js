// Portable, fully offline: pas de framework, pas de bundler — mêmes globals que
// token-manager-desktop (window.__TAURI__.*), pas d'imports ES module des plugins.
const { open } = window.__TAURI__.dialog;
const { readDir, readFile, exists } = window.__TAURI__.fs;
// getCurrentWindow() n'a pas d'équivalent testé ailleurs dans ce repo (contrairement à
// dialog/fs) — protégé pour que le reste de l'appli reste utilisable si l'API diffère.
let appWindow = null;
try {
  appWindow = window.__TAURI__.window.getCurrentWindow();
} catch (e) {
  appWindow = null;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
const LAST_FOLDER_KEY = 'distributeur_last_folder';
const UNCATEGORIZED_LABEL = 'Sans catégorie';

const folderPathEl = document.getElementById('folder-path');
const chooseFolderBtn = document.getElementById('choose-folder-btn');
const categoriesSection = document.getElementById('categories-section');
const categoriesListEl = document.getElementById('categories-list');
const toggleAllBtn = document.getElementById('toggle-all-btn');
const drawSection = document.getElementById('draw-section');
const drawBtn = document.getElementById('draw-btn');
const resetBtn = document.getElementById('reset-btn');
const cycleStatusEl = document.getElementById('cycle-status');
const imageDisplayEl = document.getElementById('image-display');
const imageNameEl = document.getElementById('image-name');
const statusEl = document.getElementById('status');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const exitFullscreenBtn = document.getElementById('exit-fullscreen-btn');

// categories: Map<label, { images: string[] (chemins complets), checked: boolean }>
let categories = new Map();
let drawnPaths = new Set();
let currentObjectUrl = null;
let isFullscreen = false;

// Historique de navigation (← →), distinct de drawnPaths (anti-répétition) : peut contenir
// des doublons d'un cycle à l'autre, sert uniquement à revoir les images déjà tirées.
let history = [];
let historyIndex = -1;

function setStatus(text, kind) {
  statusEl.textContent = text || '';
  statusEl.className = 'status' + (kind ? ' status-' + kind : '');
}

// Tauri v2 readDir ne renvoie que des noms, pas de chemin complet : on le
// reconstruit nous-mêmes en détectant le séparateur déjà utilisé par le chemin de base.
function sep(base) {
  return base.includes('\\') && !base.includes('/') ? '\\' : '/';
}

function joinPath(base, name) {
  const s = sep(base);
  return base.endsWith(s) ? base + name : base + s + name;
}

function extensionOf(name) {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function isImage(name) {
  return IMAGE_EXTENSIONS.has(extensionOf(name));
}

async function scanFolder(path) {
  const entries = await readDir(path);
  const next = new Map();

  const rootImages = entries
    .filter((e) => e.isFile && isImage(e.name))
    .map((e) => joinPath(path, e.name));
  if (rootImages.length > 0) {
    next.set(UNCATEGORIZED_LABEL, { images: rootImages, checked: true });
  }

  const dirEntries = entries.filter((e) => e.isDirectory);
  for (const dir of dirEntries) {
    const dirPath = joinPath(path, dir.name);
    let children;
    try {
      children = await readDir(dirPath);
    } catch (e) {
      continue; // dossier illisible (permissions, lien cassé...) — on l'ignore silencieusement
    }
    const images = children
      .filter((e) => e.isFile && isImage(e.name))
      .map((e) => joinPath(dirPath, e.name));
    if (images.length > 0) {
      next.set(dir.name, { images, checked: true });
    }
  }

  categories = next;
}

function eligibleImages() {
  const all = [];
  for (const cat of categories.values()) {
    if (cat.checked) all.push(...cat.images);
  }
  return all;
}

function updateCycleStatus() {
  const total = eligibleImages().length;
  cycleStatusEl.textContent = total === 0
    ? 'Aucune image sélectionnée.'
    : `${drawnPaths.size} / ${total} image(s) tirée(s) dans ce cycle.`;
  drawBtn.disabled = total === 0;
}

function renderCategories() {
  categoriesListEl.innerHTML = '';
  const hasCategories = categories.size > 0;
  categoriesSection.hidden = !hasCategories;
  drawSection.hidden = !hasCategories;
  if (!hasCategories) return;

  for (const [label, cat] of categories) {
    const row = document.createElement('label');
    row.className = 'category-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = cat.checked;
    checkbox.addEventListener('change', () => {
      cat.checked = checkbox.checked;
      resetCycle();
    });
    row.appendChild(checkbox);

    const text = document.createElement('span');
    text.textContent = `${label} (${cat.images.length})`;
    row.appendChild(text);

    categoriesListEl.appendChild(row);
  }

  resetCycle();
}

function resetCycle() {
  drawnPaths.clear();
  history = [];
  historyIndex = -1;
  updateCycleStatus();
}

async function loadFolder(path) {
  setStatus('Analyse du dossier…', 'loading');
  try {
    await scanFolder(path);
    folderPathEl.textContent = path;
    renderCategories();
    localStorage.setItem(LAST_FOLDER_KEY, path);
    const totalImages = [...categories.values()].reduce((n, c) => n + c.images.length, 0);
    setStatus(
      totalImages === 0 ? 'Aucune image trouvée dans ce dossier.' : `${totalImages} image(s) trouvée(s).`,
      totalImages === 0 ? 'error' : 'success'
    );
  } catch (e) {
    setStatus('Erreur lors de la lecture du dossier : ' + e.message, 'error');
  }
}

chooseFolderBtn.addEventListener('click', async () => {
  const picked = await open({ directory: true, multiple: false, title: "Choisir le dossier d'images" });
  if (picked) await loadFolder(picked);
});

toggleAllBtn.addEventListener('click', () => {
  const allChecked = [...categories.values()].every((c) => c.checked);
  for (const cat of categories.values()) cat.checked = !allChecked;
  renderCategories();
});

function mimeFor(name) {
  const ext = extensionOf(name);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'bmp') return 'image/bmp';
  return 'application/octet-stream';
}

async function displayImage(path) {
  try {
    const bytes = await readFile(path);
    const blob = new Blob([bytes], { type: mimeFor(path) });
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);
    imageDisplayEl.src = currentObjectUrl;
    imageDisplayEl.hidden = false;
    imageNameEl.textContent = path.slice(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1);
  } catch (e) {
    setStatus("Impossible de charger l'image : " + e.message, 'error');
  }
}

async function drawNewImage() {
  let pool = eligibleImages().filter((p) => !drawnPaths.has(p));
  if (pool.length === 0) {
    pool = eligibleImages();
    drawnPaths.clear();
    if (pool.length === 0) return;
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  drawnPaths.add(chosen);
  history.push(chosen);
  historyIndex = history.length - 1;
  updateCycleStatus();
  await displayImage(chosen);
}

async function showHistoryAt(index) {
  if (index < 0 || index >= history.length) return;
  historyIndex = index;
  await displayImage(history[index]);
}

function goBack() {
  if (historyIndex > 0) showHistoryAt(historyIndex - 1);
}

function goForward() {
  if (historyIndex < history.length - 1) showHistoryAt(historyIndex + 1);
  else drawNewImage();
}

drawBtn.addEventListener('click', drawNewImage);

resetBtn.addEventListener('click', resetCycle);

async function toggleFullscreen(value) {
  if (!appWindow) {
    setStatus('Plein écran indisponible sur cette version.', 'error');
    return;
  }
  try {
    await appWindow.setFullscreen(value);
    isFullscreen = value;
    document.body.classList.toggle('fullscreen-mode', value);
    fullscreenBtn.textContent = value ? 'Quitter le plein écran' : 'Plein écran';
  } catch (e) {
    setStatus('Impossible de passer en plein écran : ' + e.message, 'error');
  }
}

fullscreenBtn.addEventListener('click', () => toggleFullscreen(!isFullscreen));
exitFullscreenBtn.addEventListener('click', () => toggleFullscreen(false));

function isInteractiveTarget(el) {
  return !!el && ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullscreen(!isFullscreen);
  } else if (e.key === 'Escape' && isFullscreen) {
    toggleFullscreen(false);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    goBack();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    goForward();
  } else if ((e.key === ' ' || e.key === 'Enter') && !isInteractiveTarget(document.activeElement)) {
    // Sur un bouton/case à cocher focus, Espace/Entrée déclenchent déjà son action native
    // (click) — n'intercepter ici que quand le focus n'est sur aucun contrôle, pour éviter
    // un double tirage.
    e.preventDefault();
    goForward();
  }
});

async function init() {
  const last = localStorage.getItem(LAST_FOLDER_KEY);
  if (last) {
    try {
      if (await exists(last)) {
        await loadFolder(last);
        return;
      }
    } catch (e) {
      // dossier mémorisé plus accessible (supprimé, lecteur démonté...) — on repart à vide
    }
  }
  setStatus('Choisis un dossier pour commencer.', '');
}

init();
