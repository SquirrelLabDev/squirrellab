import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createCreator,
  loginCreator,
  logoutCreator,
  getCreatorFromToken,
  listCreatorsSummary,
  deleteCreator,
  listAllSessions,
  deleteSessionAsAdmin,
  setSessionExpiry,
  sweepExpiredSessions,
  listSessionsForOwner,
  createSession,
  getLiveSession,
  deleteSessionOwned,
  addParticipant,
  removeParticipant,
  addResource,
  takeResource,
  releaseResource,
  AppError,
} from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const app = express();
app.use(express.json());

// Site-owner oversight: a single shared secret (this deployment's operator), separate
// from creator accounts. Sees every creator/session and can delete any of them.
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'server_not_configured', message: "ADMIN_PASSWORD n'est pas configuré sur le serveur." });
  }
  const provided = req.get('x-admin-password') || '';
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized', message: 'Mot de passe admin invalide.' });
  }
  next();
}

// Creator accounts: each person who sets up sessions for their team only ever sees
// and manages their own — never another creator's.
async function requireCreator(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const creator = await getCreatorFromToken(token);
  if (!creator) return res.status(401).json({ error: 'unauthorized' });
  req.creator = creator;
  next();
}

function publicSession(session) {
  const { id, ownerId, ...rest } = session;
  return rest;
}

const MAX_EXPIRY_DAYS = 3650; // 10 years

// undefined -> caller's default; '' or 0 -> never expires; else a validated day count.
function parseExpiryDays(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: 0 };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_EXPIRY_DAYS) {
    return { ok: false };
  }
  return { ok: true, value: n };
}

function handleAppError(res, err) {
  if (err instanceof AppError) {
    const status =
      err.code === 'not_found'
        ? 404
        : err.code === 'forbidden'
        ? 403
        : err.code === 'invalid_credentials' || err.code === 'unauthorized'
        ? 401
        : err.code === 'invalid_username' || err.code === 'weak_password' || err.code === 'username_taken'
        ? 400
        : 409;
    res.status(status).json({ error: err.code, message: err.message });
    return true;
  }
  return false;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// --- Creator accounts (self-service sign-up, scoped to their own sessions) ---

app.post('/api/creators/signup', async (req, res, next) => {
  const { username, password } = req.body || {};
  try {
    const { creator, token } = await createCreator({ username, password });
    res.status(201).json({ creator, token });
  } catch (err) {
    if (!handleAppError(res, err)) next(err);
  }
});

app.post('/api/creators/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  try {
    const { creator, token } = await loginCreator({ username, password });
    res.json({ creator, token });
  } catch (err) {
    if (!handleAppError(res, err)) next(err);
  }
});

app.post('/api/creators/logout', requireCreator, async (req, res) => {
  const token = (req.get('authorization') || '').slice(7);
  await logoutCreator(token);
  res.status(204).end();
});

// --- Creator-scoped session management (requires a creator's own token) ---

app.get('/api/creator/sessions', requireCreator, async (req, res) => {
  res.json(await listSessionsForOwner(req.creator.id));
});

app.post('/api/creator/sessions', requireCreator, async (req, res) => {
  const { name, description, participants, resources, expiryDays } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'invalid_name', message: 'Le nom de la session est requis.' });
  }
  const parsedExpiry = parseExpiryDays(expiryDays);
  if (!parsedExpiry.ok) {
    return res.status(400).json({ error: 'invalid_expiry', message: `Le délai doit être un nombre de jours entre 0 et ${MAX_EXPIRY_DAYS}.` });
  }
  const session = await createSession({
    ownerId: req.creator.id,
    name,
    description,
    participantNames: participants,
    resourceNames: resources,
    expiryDays: parsedExpiry.value,
  });
  res.status(201).json(publicSession(session));
});

async function ownedSessionOr404(req, res) {
  const session = await getLiveSession(req.params.slug);
  if (!session || session.ownerId !== req.creator.id) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  return session;
}

app.get('/api/creator/sessions/:slug', requireCreator, async (req, res) => {
  const session = await ownedSessionOr404(req, res);
  if (session) res.json(publicSession(session));
});

app.delete('/api/creator/sessions/:slug', requireCreator, async (req, res, next) => {
  try {
    const deleted = await deleteSessionOwned(req.params.slug, req.creator.id);
    if (!deleted) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (err) {
    if (!handleAppError(res, err)) next(err);
  }
});

app.post('/api/creator/sessions/:slug/participants', requireCreator, async (req, res) => {
  if (!(await ownedSessionOr404(req, res))) return;
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'invalid_name' });
  const session = await addParticipant(req.params.slug, name);
  res.status(201).json(publicSession(session));
});

app.delete('/api/creator/sessions/:slug/participants/:participantId', requireCreator, async (req, res) => {
  if (!(await ownedSessionOr404(req, res))) return;
  const session = await removeParticipant(req.params.slug, req.params.participantId);
  res.json(publicSession(session));
});

app.post('/api/creator/sessions/:slug/resources', requireCreator, async (req, res) => {
  if (!(await ownedSessionOr404(req, res))) return;
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'invalid_name' });
  const session = await addResource(req.params.slug, name);
  res.status(201).json(publicSession(session));
});

// --- Site-admin oversight API (sees/deletes everything, creates nothing) ---

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'server_not_configured' });
  }
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({ ok: true });
});

app.get('/api/admin/creators', requireAdmin, async (req, res) => {
  res.json(await listCreatorsSummary());
});

app.delete('/api/admin/creators/:id', requireAdmin, async (req, res) => {
  const existed = await deleteCreator(req.params.id);
  if (!existed) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

app.get('/api/admin/sessions', requireAdmin, async (req, res) => {
  res.json(await listAllSessions());
});

app.delete('/api/admin/sessions/:slug', requireAdmin, async (req, res) => {
  const existed = await deleteSessionAsAdmin(req.params.slug);
  if (!existed) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

app.patch('/api/admin/sessions/:slug/expiry', requireAdmin, async (req, res) => {
  const parsedExpiry = parseExpiryDays(req.body?.expiryDays ?? null);
  if (!parsedExpiry.ok) {
    return res.status(400).json({ error: 'invalid_expiry', message: `Le délai doit être un nombre de jours entre 0 et ${MAX_EXPIRY_DAYS}.` });
  }
  const session = await setSessionExpiry(req.params.slug, parsedExpiry.value);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json(publicSession(session));
});

// --- Public / participant API (the share link itself is the secret) ---

app.get('/api/sessions/:slug', async (req, res) => {
  const session = await getLiveSession(req.params.slug);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json(publicSession(session));
});

app.post('/api/sessions/:slug/resources/:resourceId/take', async (req, res, next) => {
  const { participantId, justification } = req.body || {};
  try {
    const session = await takeResource(req.params.slug, req.params.resourceId, { participantId, justification });
    res.json(publicSession(session));
  } catch (err) {
    if (!handleAppError(res, err)) next(err);
  }
});

app.post('/api/sessions/:slug/resources/:resourceId/release', async (req, res, next) => {
  const { participantId, message } = req.body || {};
  try {
    const session = await releaseResource(req.params.slug, req.params.resourceId, { participantId, message });
    res.json(publicSession(session));
  } catch (err) {
    if (!handleAppError(res, err)) next(err);
  }
});

// --- Static frontend ---

app.use(express.static(PUBLIC_DIR));

app.get('/session/:slug', (req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'session.html'));
});

app.get('/espace', (req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'creator.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'admin.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function sweep() {
  sweepExpiredSessions().catch((err) => console.error('Échec du nettoyage des sessions expirées :', err));
}

app.listen(PORT, () => {
  console.log(`Gestionnaire de tokens en écoute sur http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn("ADMIN_PASSWORD n'est pas défini : l'espace d'administration du site est désactivé.");
  }
  sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS);
});
