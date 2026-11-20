// Client de l'API du jeu QR ordonné (Azure Static Web App, dépôt squirrellab-qr-api).
//
// Toutes les requêtes sont « simples » au sens CORS (GET, ou POST en text/plain sans en-tête
// personnalisé) : la passerelle Azure Static Web Apps répond elle-même aux préflights OPTIONS
// sans en-têtes CORS, donc application/json ou un en-tête x-… serait bloqué par le navigateur.
// Le serveur parse le corps JSON quel que soit le Content-Type.
const DEFAULT_API = 'https://green-pond-050ebe803.8.azurestaticapps.net/api';

export const API_BASE = ((import.meta.env && import.meta.env.PUBLIC_QR_API) || DEFAULT_API).replace(/\/$/, '');

async function request(path, init) {
  let res;
  try {
    res = await fetch(API_BASE + path, init);
  } catch {
    return {
      status: 0,
      ok: false,
      data: { error: 'network', message: 'Connexion impossible. Vérifie ton réseau et réessaie.' },
      text: '',
    };
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, text };
}

export const apiGet = (path) => request(path);

export const apiPost = (path, body) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body),
  });

// ── Admin : le mot de passe voyage dans le corps JSON ────────────────────────
const PW_KEY = 'sl_qr_admin_pw';

export function savedPassword() {
  try {
    return sessionStorage.getItem(PW_KEY) || localStorage.getItem(PW_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberPassword(password, persist) {
  try {
    sessionStorage.setItem(PW_KEY, password);
    if (persist) localStorage.setItem(PW_KEY, password);
    else localStorage.removeItem(PW_KEY);
  } catch {
    /* stockage indisponible : le mot de passe sera redemandé */
  }
}

export function forgetPassword() {
  try {
    sessionStorage.removeItem(PW_KEY);
    localStorage.removeItem(PW_KEY);
  } catch {
    /* rien à faire */
  }
}

export const adminPost = (password, path, body = {}) => apiPost('/manage' + path, { ...body, password });
