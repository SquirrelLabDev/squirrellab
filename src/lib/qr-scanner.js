// Lecture de QR codes dans la page (caméra via getUserMedia, décodage jsQR) : le joueur enchaîne les
// QR codes sans quitter la page ni rouvrir l'appareil photo. jsQR est chargé à la demande.

let decoderPromise = null;
function loadDecoder() {
  if (!decoderPromise) decoderPromise = import('jsqr').then((m) => m.default);
  return decoderPromise;
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function decode(jsQR, source, sw, sh, maxSide, tryInverted) {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(source, 0, 0, w, h);
  const result = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
    inversionAttempts: tryInverted ? 'attemptBoth' : 'dontInvert',
  });
  return result ? result.data : null;
}

export function cameraSupported() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Démarre la caméra arrière sur `video` et appelle onText(texte) pour chaque QR code lu.
// Si onText renvoie true, le scan s'arrête. Renvoie { stop }.
export async function startCameraScan(video, onText) {
  const jsQR = await loadDecoder();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute('playsinline', '');
  await video.play();

  let stopped = false;
  let timer = null;
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };

  const tick = () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const text = decode(jsQR, video, video.videoWidth, video.videoHeight, 720, false);
      if (text && onText(text) === true) return stop();
    }
    timer = setTimeout(tick, 150);
  };
  tick();
  return { stop };
}

// Secours quand la caméra est refusée ou indisponible : décode une photo prise avec l'appareil.
export async function decodePhoto(file) {
  const jsQR = await loadDecoder();
  const bitmap = await createImageBitmap(file);
  try {
    return decode(jsQR, bitmap, bitmap.width, bitmap.height, 1600, true);
  } finally {
    if (bitmap.close) bitmap.close();
  }
}

// Extrait { g, s } d'un QR code du jeu ; null pour tout autre contenu.
export function parseGameTarget(text) {
  try {
    const url = new URL(text);
    if (!/^\/qr\/?$/.test(url.pathname)) return null;
    if (url.origin !== location.origin && url.hostname !== 'squirrellab.fr') return null;
    const g = (url.searchParams.get('g') || '').trim();
    const s = (url.searchParams.get('s') || '').trim();
    return g && s ? { g, s } : null;
  } catch {
    return null;
  }
}
