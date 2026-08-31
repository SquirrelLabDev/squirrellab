import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

const DB_PATH = process.env.TOKEN_MANAGER_DB || new URL('../data/db.json', import.meta.url).pathname;

const emptyDb = () => ({ sessions: {} });

let writeChain = Promise.resolve();

async function loadDb() {
  if (!existsSync(DB_PATH)) return emptyDb();
  const raw = await readFile(DB_PATH, 'utf-8');
  if (!raw.trim()) return emptyDb();
  try {
    return JSON.parse(raw);
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

export async function listSessions() {
  const db = await loadDb();
  return Object.values(db.sessions)
    .map(summarize)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSession({ name, description, participantNames, resourceNames }) {
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

export async function getSession(slug) {
  const db = await loadDb();
  return db.sessions[slug] || null;
}

export async function deleteSession(slug) {
  return transact((db) => {
    const existed = Boolean(db.sessions[slug]);
    delete db.sessions[slug];
    return existed;
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

export const TokenError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};

export async function takeResource(slug, resourceId, { participantId, justification }) {
  return transact((db) => {
    const session = db.sessions[slug];
    if (!session) throw new TokenError('not_found', 'Session introuvable.');
    const resource = session.resources.find((r) => r.id === resourceId);
    if (!resource) throw new TokenError('not_found', 'Ressource introuvable.');
    const participant = findParticipant(session, participantId);
    if (!participant) throw new TokenError('unknown_participant', 'Participant inconnu pour cette session.');
    if (resource.status === 'taken') {
      throw new TokenError('already_taken', `Déjà pris par ${resource.holder.name}.`);
    }
    if (!justification || !justification.trim()) {
      throw new TokenError('missing_justification', 'Une justification est requise.');
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
    if (!session) throw new TokenError('not_found', 'Session introuvable.');
    const resource = session.resources.find((r) => r.id === resourceId);
    if (!resource) throw new TokenError('not_found', 'Ressource introuvable.');
    const participant = findParticipant(session, participantId);
    if (!participant) throw new TokenError('unknown_participant', 'Participant inconnu pour cette session.');
    if (resource.status !== 'taken') {
      throw new TokenError('not_taken', 'Cette ressource est déjà disponible.');
    }
    if (resource.holder.id !== participant.id) {
      throw new TokenError('not_holder', `Seul·e ${resource.holder.name} peut reposer ce token.`);
    }
    if (!message || !message.trim()) {
      throw new TokenError('missing_message', 'Une description du travail effectué est requise.');
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
