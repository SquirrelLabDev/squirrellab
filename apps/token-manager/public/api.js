// Shared fetch helper. On the website this app is same-origin, so apiBase is empty.
// In the portable desktop build (Tauri) the frontend is loaded from disk, so the
// user configures which server to talk to — stored locally on their machine.
const IS_DESKTOP = typeof window !== 'undefined' && Boolean(window.__TAURI__);
const STORAGE_KEY = 'tokenManagerApiBase';

export function getApiBase() {
  if (!IS_DESKTOP) return '';
  try {
    return (localStorage.getItem(STORAGE_KEY) || '').replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function setApiBase(url) {
  try {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''));
  } catch {
    /* ignore */
  }
}

export function isDesktop() {
  return IS_DESKTOP;
}

export async function ensureApiBaseConfigured() {
  if (!IS_DESKTOP) return true;
  if (getApiBase()) return true;
  const url = window.prompt(
    "Adresse du serveur du gestionnaire de tokens (ex: https://token-manager.squirrellab.fr)"
  );
  if (!url || !url.trim()) return false;
  setApiBase(url.trim());
  return true;
}

export async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const message = (body && body.message) || `Erreur ${res.status}`;
    const error = new Error(message);
    error.code = body && body.error;
    error.status = res.status;
    throw error;
  }
  return body;
}
