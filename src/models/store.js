'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');

/**
 * Persistencia: un JSON en disco, cargado una vez en memoria.
 *
 * Dos garantias:
 *  - Escritura atomica (archivo temporal + rename en el mismo directorio):
 *    un corte a mitad de escritura no deja un db.json truncado.
 *  - Mutaciones en serie: `await` intercala requests, y dos
 *    leer-modificar-escribir concurrentes perderian una de las dos escrituras.
 */

const EMPTY = { users: [], topics: [] };

let state = null;
let queue = Promise.resolve();

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function normalizeLink(l) {
  return {
    id: l.id || newId(),
    title: String(l.title || ''),
    url: String(l.url || ''),
    voters: Array.isArray(l.voters) ? l.voters : [],
    votes: Array.isArray(l.voters) ? l.voters.length : 0,
    authorId: l.authorId ?? null,
    createdAt: l.createdAt || now(),
    updatedAt: l.updatedAt || l.createdAt || now(),
  };
}

function normalizeTopic(t) {
  return {
    id: t.id || newId(),
    title: String(t.title || ''),
    description: String(t.description || ''),
    voters: Array.isArray(t.voters) ? t.voters : [],
    votes: Array.isArray(t.voters) ? t.voters.length : 0,
    authorId: t.authorId ?? null,
    createdAt: t.createdAt || now(),
    updatedAt: t.updatedAt || t.createdAt || now(),
    links: (Array.isArray(t.links) ? t.links : []).map(normalizeLink),
  };
}

function normalize(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    users: (Array.isArray(d.users) ? d.users : []).map((u) => ({
      id: u.id || newId(),
      username: String(u.username || ''),
      passwordHash: String(u.passwordHash || ''),
      createdAt: u.createdAt || now(),
    })),
    topics: (Array.isArray(d.topics) ? d.topics : []).map(normalizeTopic),
  };
}

function load() {
  try {
    return normalize(JSON.parse(fs.readFileSync(config.dataFile, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Un JSON corrupto se aparta con fecha en vez de pisarse en silencio.
      const aside = `${config.dataFile}.corrupto.${Date.now()}`;
      try { fs.renameSync(config.dataFile, aside); } catch { /* sin permisos: seguimos vacios */ }
      console.error(`[store] ${config.dataFile} ilegible (${err.message}); apartado en ${aside}`);
    }
    return structuredClone(EMPTY);
  }
}

function getState() {
  if (!state) state = load();
  return state;
}

async function persist() {
  const dir = path.dirname(config.dataFile);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.db.${process.pid}.${Date.now()}.tmp`);
  await fsp.writeFile(tmp, JSON.stringify(getState(), null, 2), { mode: 0o600 });
  await fsp.rename(tmp, config.dataFile);
}

/** Corre `fn(state)` en exclusion mutua y persiste. Devuelve lo que devuelva fn. */
function mutate(fn) {
  const run = queue.then(async () => {
    const result = await fn(getState());
    await persist();
    return result;
  });
  queue = run.catch(() => {});   // una mutacion fallida no bloquea la cola
  return run;
}

module.exports = { getState, mutate, newId, now };
