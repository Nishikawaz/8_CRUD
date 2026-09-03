'use strict';

const Topic = require('../models/Topic');
const { validateTopic } = require('../middleware/validate');
const { wantsJson } = require('../middleware/auth');

/**
 * Cada accion atiende a dos clientes: el navegador sin JS (render/redirect)
 * y el fetch del frontend (JSON). La app funciona sin JavaScript; el JS
 * solo evita la recarga.
 */

/** Marca para la vista si el visitante actual ya voto cada item. */
const withVoteFlags = (topic, voterId) => ({
  ...topic,
  hasVoted: topic.voters.includes(voterId),
  links: topic.links.map((l) => ({ ...l, hasVoted: l.voters.includes(voterId) })),
});

exports.withVoteFlags = withVoteFlags;

exports.index = (req, res) => {
  const q = req.query.q || '';
  const topics = Topic.search(q).map((t) => withVoteFlags(t, req.voterId));
  if (wantsJson(req)) return res.json({ ok: true, topics });
  res.render('topics/index', { title: 'Temas de aprendizaje', topics, q });
};

exports.show = (req, res, next) => {
  const topic = Topic.findById(req.params.id);
  if (!topic) return next();
  const view = withVoteFlags(topic, req.voterId);
  if (wantsJson(req)) return res.json({ ok: true, topic: view });
  res.render('topics/show', { title: topic.title, topic: view });
};

exports.newForm = (req, res) => res.render('topics/new', { title: 'Nuevo tema', values: {}, errors: [] });

exports.editForm = (req, res) =>
  res.render('topics/edit', { title: `Editar: ${req.topic.title}`, topic: req.topic, values: req.topic, errors: [] });

exports.create = async (req, res) => {
  const { errors, data } = validateTopic(req.body);
  if (errors.length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors });
    return res.status(422).render('topics/new', { title: 'Nuevo tema', values: data, errors });
  }
  const topic = await Topic.create({ ...data, authorId: req.user.id });
  if (wantsJson(req)) return res.status(201).json({ ok: true, topic: withVoteFlags(topic, req.voterId) });
  req.flash('Tema creado.');
  res.redirect(`/topics/${topic.id}`);
};

exports.update = async (req, res, next) => {
  const { errors, data } = validateTopic(req.body);
  if (errors.length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors });
    return res.status(422).render('topics/edit', {
      title: `Editar: ${req.topic.title}`, topic: req.topic, values: { ...req.topic, ...data }, errors,
    });
  }
  const topic = await Topic.update(req.params.id, data);
  if (!topic) return next();
  if (wantsJson(req)) return res.json({ ok: true, topic: withVoteFlags(topic, req.voterId) });
  req.flash('Tema actualizado.');
  res.redirect(`/topics/${topic.id}`);
};

exports.destroy = async (req, res, next) => {
  const removed = await Topic.remove(req.params.id);
  if (!removed) return next();
  if (wantsJson(req)) return res.json({ ok: true, id: removed.id });
  req.flash('Tema eliminado.');
  res.redirect('/');
};
