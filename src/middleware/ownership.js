'use strict';

const Topic = require('../models/Topic');
const { wantsJson } = require('./auth');

/**
 * Solo el autor edita o borra lo suyo. El contenido del seed no tiene autor
 * (`authorId: null`) y lo puede editar cualquier usuario registrado.
 */
const owns = (item, user) => item.authorId === null || (user && item.authorId === user.id);

function deny(req, res) {
  const msg = 'Solo el autor puede modificar este contenido.';
  if (wantsJson(req)) return res.status(403).json({ ok: false, error: msg });
  req.flash(msg, 'error');
  res.redirect(req.get('referer') || '/');
}

function requireTopicOwner(req, res, next) {
  const topic = Topic.findById(req.params.id ?? req.params.topicId);
  if (!topic) return next();
  if (!owns(topic, req.user)) return deny(req, res);
  req.topic = topic;
  next();
}

function requireLinkOwner(req, res, next) {
  const link = Topic.findLink(req.params.topicId, req.params.linkId);
  if (!link) return next();
  if (!owns(link, req.user)) return deny(req, res);
  req.link = link;
  next();
}

module.exports = { requireTopicOwner, requireLinkOwner };
