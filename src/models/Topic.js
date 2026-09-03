'use strict';

const { getState, mutate, newId, now } = require('./store');

/**
 * Temas y enlaces.
 *
 * Criterio de orden, unico para los dos niveles: mas votos primero; a igual
 * cantidad, el mas antiguo primero. El desempate hace el orden ESTABLE — sin
 * el, dos items con los mismos votos podrian cambiar de lugar entre recargas.
 *
 * `votes` se deriva de `voters.length` y jamas se incrementa aparte. Votar es
 * alternar: doble click, reintento de red o dos pestanas no inflan el conteo.
 */
const byVotes = (a, b) =>
  b.votes - a.votes || new Date(a.createdAt) - new Date(b.createdAt);

const snapshotLink = (l) => ({ ...l, voters: [...l.voters] });
const snapshot = (t) => ({
  ...t,
  voters: [...t.voters],
  links: [...t.links].sort(byVotes).map(snapshotLink),
});

const rawTopic = (id) => getState().topics.find((t) => t.id === id);

// ---------------------------------------------------------------- lectura

const all = () => [...getState().topics].sort(byVotes).map(snapshot);

const findById = (id) => {
  const t = rawTopic(id);
  return t ? snapshot(t) : null;
};

function search(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return all();
  const hit = (s) => s.toLowerCase().includes(q);
  return all().filter(
    (t) => hit(t.title) || hit(t.description) || t.links.some((l) => hit(l.title))
  );
}

function findLink(topicId, linkId) {
  const l = rawTopic(topicId)?.links.find((x) => x.id === linkId);
  return l ? snapshotLink(l) : null;
}

// ------------------------------------------------------------------ temas

const create = ({ title, description = '', authorId = null }) =>
  mutate((s) => {
    const t = {
      id: newId(), title, description, voters: [], votes: 0, authorId,
      createdAt: now(), updatedAt: now(), links: [],
    };
    s.topics.push(t);
    return snapshot(t);
  });

const update = (id, { title, description }) =>
  mutate((s) => {
    const t = s.topics.find((x) => x.id === id);
    if (!t) return null;
    if (title !== undefined) t.title = title;
    if (description !== undefined) t.description = description;
    t.updatedAt = now();
    return snapshot(t);
  });

const remove = (id) =>
  mutate((s) => {
    const i = s.topics.findIndex((x) => x.id === id);
    if (i < 0) return null;
    return snapshot(s.topics.splice(i, 1)[0]);
  });

// ---------------------------------------------------------------- enlaces

const addLink = (topicId, { title, url, authorId = null }) =>
  mutate((s) => {
    const t = s.topics.find((x) => x.id === topicId);
    if (!t) return null;
    const l = { id: newId(), title, url, voters: [], votes: 0, authorId, createdAt: now(), updatedAt: now() };
    t.links.push(l);
    return snapshotLink(l);
  });

const updateLink = (topicId, linkId, { title, url }) =>
  mutate((s) => {
    const l = s.topics.find((x) => x.id === topicId)?.links.find((x) => x.id === linkId);
    if (!l) return null;
    if (title !== undefined) l.title = title;
    if (url !== undefined) l.url = url;
    l.updatedAt = now();
    return snapshotLink(l);
  });

const removeLink = (topicId, linkId) =>
  mutate((s) => {
    const t = s.topics.find((x) => x.id === topicId);
    const i = t ? t.links.findIndex((x) => x.id === linkId) : -1;
    if (i < 0) return null;
    return snapshotLink(t.links.splice(i, 1)[0]);
  });

// ------------------------------------------------------------------ votos

function toggle(target, voterId) {
  const i = target.voters.indexOf(voterId);
  if (i < 0) target.voters.push(voterId);
  else target.voters.splice(i, 1);
  target.votes = target.voters.length;
  target.updatedAt = now();
  return { id: target.id, votes: target.votes, voted: i < 0 };
}

const toggleVote = (topicId, voterId) =>
  mutate((s) => {
    const t = s.topics.find((x) => x.id === topicId);
    return t ? toggle(t, voterId) : null;
  });

const toggleLinkVote = (topicId, linkId, voterId) =>
  mutate((s) => {
    const l = s.topics.find((x) => x.id === topicId)?.links.find((x) => x.id === linkId);
    return l ? { ...toggle(l, voterId), topicId } : null;
  });

module.exports = {
  byVotes, all, search, findById, findLink,
  create, update, remove,
  addLink, updateLink, removeLink,
  toggleVote, toggleLinkVote,
};
