import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const DB_PATH = process.env.TOKEN_MANAGER_DB || new URL('../data/db.json', import.meta.url).pathname;

const emptyDb = () => ({ creators: {}, tokens: {}, sessions: {} });

let writeChain = Promise.resolve();

async function loadDb() {
  if (!existsSync(DB_PATH)) return emptyDb();
  const raw = await readFile(DB_PATH, 'utf-8');
  if (!raw.trim()) return emptyDb();
  try {
    const db = JSON.parse(raw);
    db.creators ||= {};
    db.tokens ||= {};
    db.sessions ||= {};
    return db;
  } catch {
    return emptyDb();
  }
}

async function persist(db) {
  await mkdir(dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// Serializes every read-modify-write so concurrent requests never clobber each other.
function transact(mutator) {
  const result = writeChain.then(async () => {
    const db = await loadDb();
    const output = await mutator(db);
    await persist(db);
    return output;
  });
  writeChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function makeSlug() {
  return randomBytes(4).toString('hex');
}

function summarize(session) {
  return {
    slug: session.slug,
    name: session.name,
    description: session.description,
    createdAt: session.createdAt,
    participantCount: session.participants.length,
    resourceCount: session.resources.length,
  };
}

export const AppError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};

// --- Creators (each creator only ever sees their own sessions) ---

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function publicCreator(creator) {
  return { id: creator.id, username: creator.username, createdAt: creator.createdAt };
}

function issueToken(db, creatorId) {
  const token = randomBytes(24).toString('hex');
  db.tokens[token] = { creatorId, createdAt: new Date().toISOString() };
  return token;
}

export async function createCreator({ username, password }) {
  return transact((db) => {
    const normalized = (username || '').trim();
    if (!normalized) throw new AppError('invalid_username', "Nom d'utilisateur requis.");
    if (!password || password.length < 8) {
      throw new AppError('weak_password', 'Le mot de passe doit contenir au moins 8 caractères.');
    }
    const taken = Object.values(db.creators).some(
      (c) => c.username.toLowerCase() === normalized.toLowerCase()
    );
    if (taken) throw new AppError('username_taken', "Ce nom d'utilisateur est déjà pris.");

    const { salt, hash } = hashPassword(password);
    const creator = {
      id: randomUUID(),
      username: normalized,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    db.creators[creator.id] = creator;
    const token = issueToken(db, creator.id);
    return { creator: publicCreator(creator), token };
  });
}

export async function loginCreator({ username, password }) {
  return transact((db) => {
    const normalized = (username || '').trim().toLowerCase();
    const creator = Object.values(db.creators).find((c) => c.username.toLowerCase() === normalized);
    if (!creator || !verifyPassword(password || '', creator.salt, creator.hash)) {
      throw new AppError('invalid_credentials', 'Identifiants invalides.');
    }
    const token = issueToken(db, creator.id);
    return { creator: publicCreator(creator), token };
  });
}

export async function logoutCreator(token) {
  return transact((db) => {
    delete db.tokens[token];
  });
}

export async function getCreatorFromToken(token) {
  if (!token) return null;
  const db = await loadDb();
  const entry = db.tokens[token];
  if (!entry) return null;
  const creator = db.creators[entry.creatorId];
  return creator ? publicCreator(creator) : null;
}

// --- Site-admin oversight (separate from creator accounts, protected by ADMIN_PASSWORD) ---

export async function listCreatorsSummary() {
  const db = await loadDb();
  return Object.values(db.creators)
    .map((c) => ({
      ...publicCreator(c),
      sessionCount: Object.values(db.sessions).filter((s) => s.ownerId === c.id).length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteCreator(creatorId) {
  return transact((db) => {
    const existed = Boolean(db.creators[creatorId]);
    delete db.creators[creatorId];
    for (const [slug, session] of Object.entries(db.sessions)) {
      if (session.ownerId === creatorId) delete db.sessions[slug];
    }
    for (const [token, entry] of Object.entries(db.tokens)) {
      if (entry.creatorId === creatorId) delete db.tokens[token];
    }
    return existed;
  });
}

export async function listAllSessions() {
  const db = await loadDb();
  return Object.values(db.sessions)
    .map((s) => ({ ...summarize(s), ownerUsername: db.creators[s.ownerId]?.username || '—' }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteSessionAsAdmin(slug) {
  return transact((db) => {
    const existed = Boolean(db.sessions[slug]);
    delete db.sessions[slug];
    return existed;
  });
}

// --- Sessions (created and managed by their owning creator) ---

export async function listSessionsForOwner(ownerId) {
  const db = await loadDb();
  return Object.values(db.sessions)
    .filter((s) => s.ownerId === ownerId)
    .map(summarize)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSession({ ownerId, name, description, participantNames, resourceNames }) {
  return transact((db) => {
    let slug = makeSlug();
    while (db.sessions[slug]) slug = makeSlug();

    const participants = (participantNames || [])
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ id: randomUUID(), name: n }));

    const resourceList = (resourceNames && resourceNames.length ? resourceNames : ['Accès principal'])
      .map((n) => n.trim())
      .filter(Boolean);

    const resources = resourceList.map((n) => ({
      id: randomUUID(),
      name: n,
      status: 'available',
      holder: null,
      justification: null,
      takenAt: null,
    }));

    const session = {
      id: randomUUID(),
      ownerId,
      slug,
      name: name.trim(),
      description: (description || '').trim(),
      participants,
      resources,
      history: [],
      createdAt: new Date().toISOString(),
    };

    db.sessions[slug] = session;
    return session;
  });
}

// Unscoped lookup: used both by owner-checked creator routes and by the public
// session-link routes (the slug itself is the shared secret there).
export async function getSession(slug) {
  const db = await loadDb();
  return db.sessions[slug] || null;
}

export async function deleteSessionOwned(slug, ownerId) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) return false;
    if (session.ownerId !== ownerId) {
      throw new AppError('forbidden', "Vous n'êtes pas propriétaire de cette session.");
    }
    delete db.sessions[slug];
    return true;
  });
}

export async function addParticipant(slug, name) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) return null;
    const participant = { id: randomUUID(), name: name.trim() };
    session.participants.push(participant);
    return session;
  });
}

export async function removeParticipant(slug, participantId) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) return null;
    session.participants = session.participants.filter((p) => p.id !== participantId);
    return session;
  });
}

export async function addResource(slug, name) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) return null;
    const resource = {
      id: randomUUID(),
      name: name.trim(),
      status: 'available',
      holder: null,
      justification: null,
      takenAt: null,
    };
    session.resources.push(resource);
    return session;
  });
}

function findParticipant(session, participantId) {
  return session.participants.find((p) => p.id === participantId) || null;
}

// --- Token take/release (public: reachable by anyone with the session link) ---

export async function takeResource(slug, resourceId, { participantId, justification }) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) throw new AppError('not_found', 'Session introuvable.');
    const resource = session.resources.find((r) => r.id === resourceId);
    if (!resource) throw new AppError('not_found', 'Ressource introuvable.');
    const participant = findParticipant(session, participantId);
    if (!participant) throw new AppError('unknown_participant', 'Participant inconnu pour cette session.');
    if (resource.status === 'taken') {
      throw new AppError('already_taken', `Déjà pris par ${resource.holder.name}.`);
    }
    if (!justification || !justification.trim()) {
      throw new AppError('missing_justification', 'Une justification est requise.');
    }

    resource.status = 'taken';
    resource.holder = { id: participant.id, name: participant.name };
    resource.justification = justification.trim();
    resource.takenAt = new Date().toISOString();

    session.history.unshift({
      id: randomUUID(),
      resourceId: resource.id,
      resourceName: resource.name,
      participant: participant.name,
      action: 'take',
      message: resource.justification,
      timestamp: resource.takenAt,
    });

    return session;
  });
}

export async function releaseResource(slug, resourceId, { participantId, message }) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) throw new AppError('not_found', 'Session introuvable.');
    const resource = session.resources.find((r) => r.id === resourceId);
    if (!resource) throw new AppError('not_found', 'Ressource introuvable.');
    const participant = findParticipant(session, participantId);
    if (!participant) throw new AppError('unknown_participant', 'Participant inconnu pour cette session.');
    if (resource.status !== 'taken') {
      throw new AppError('not_taken', 'Cette ressource est déjà disponible.');
    }
    if (resource.holder.id !== participant.id) {
      throw new AppError('not_holder', `Seul·e ${resource.holder.name} peut reposer ce token.`);
    }
    if (!message || !message.trim()) {
      throw new AppError('missing_message', 'Une description du travail effectué est requise.');
    }

    const releasedAt = new Date().toISOString();

    session.history.unshift({
      id: randomUUID(),
      resourceId: resource.id,
      resourceName: resource.name,
      participant: participant.name,
      action: 'release',
      message: message.trim(),
      timestamp: releasedAt,
    });

    resource.status = 'available';
    resource.holder = null;
    resource.justification = null;
    resource.takenAt = null;

    return session;
  });
}
