import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  listSessions,
  createSession,
  getSession,
  deleteSession,
  addParticipant,
  removeParticipant,
  addResource,
  takeResource,
  releaseResource,
  TokenError,
} from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const app = express();
app.use(express.json());

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'server_not_configured', message: 'ADMIN_PASSWORD n\'est pas configuré sur le serveur.' });
  }
  const provided = req.get('x-admin-password') || '';
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized', message: 'Mot de passe admin invalide.' });
  }
  next();
}

function publicSession(session) {
  const { id, ...rest } = session;
  return rest;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// --- Admin API ---

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

app.get('/api/admin/sessions', requireAdmin, async (req, res) => {
  res.json(await listSessions());
});

app.post('/api/admin/sessions', requireAdmin, async (req, res) => {
  const { name, description, participants, resources } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'invalid_name', message: 'Le nom de la session est requis.' });
  }
  const session = await createSession({
    name,
    description,
    participantNames: participants,
    resourceNames: resources,
  });
  res.status(201).json(publicSession(session));
});

app.get('/api/admin/sessions/:slug', requireAdmin, async (req, res) => {
  const session = await getSession(req.params.slug);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json(publicSession(session));
});

app.delete('/api/admin/sessions/:slug', requireAdmin, async (req, res) => {
  const existed = await deleteSession(req.params.slug);
  if (!existed) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

app.post('/api/admin/sessions/:slug/participants', requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'invalid_name' });
  }
  const session = await addParticipant(req.params.slug, name);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.status(201).json(publicSession(session));
});

app.delete('/api/admin/sessions/:slug/participants/:participantId', requireAdmin, async (req, res) => {
  const session = await removeParticipant(req.params.slug, req.params.participantId);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json(publicSession(session));
});

app.post('/api/admin/sessions/:slug/resources', requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'invalid_name' });
  }
  const session = await addResource(req.params.slug, name);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.status(201).json(publicSession(session));
});

// --- Public / participant API (the share link is the secret) ---

app.get('/api/sessions/:slug', async (req, res) => {
  const session = await getSession(req.params.slug);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json(publicSession(session));
});

app.post('/api/sessions/:slug/resources/:resourceId/take', async (req, res) => {
  const { participantId, justification } = req.body || {};
  try {
    const session = await takeResource(req.params.slug, req.params.resourceId, { participantId, justification });
    res.json(publicSession(session));
  } catch (err) {
    if (err instanceof TokenError) {
      const status = err.code === 'not_found' ? 404 : 409;
      return res.status(status).json({ error: err.code, message: err.message });
    }
    throw err;
  }
});

app.post('/api/sessions/:slug/resources/:resourceId/release', async (req, res) => {
  const { participantId, message } = req.body || {};
  try {
    const session = await releaseResource(req.params.slug, req.params.resourceId, { participantId, message });
    res.json(publicSession(session));
  } catch (err) {
    if (err instanceof TokenError) {
      const status = err.code === 'not_found' ? 404 : 409;
      return res.status(status).json({ error: err.code, message: err.message });
    }
    throw err;
  }
});

// --- Static frontend ---

app.use(express.static(PUBLIC_DIR));

app.get('/session/:slug', (req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'session.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'admin.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`Gestionnaire de tokens en écoute sur http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD n\'est pas défini : les routes admin sont désactivées.');
  }
});
