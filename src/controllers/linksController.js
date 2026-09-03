'use strict';

const Topic = require('../models/Topic');
const { validateLink } = require('../middleware/validate');
const { wantsJson } = require('../middleware/auth');

const flag = (link, voterId) => ({ ...link, hasVoted: link.voters.includes(voterId) });

function rejected(req, res, errors) {
  if (wantsJson(req)) return res.status(422).json({ ok: false, errors });
  req.flash(errors.join(' '), 'error');
  res.redirect(`/topics/${req.params.topicId}`);
}

exports.create = async (req, res, next) => {
  if (!Topic.findById(req.params.topicId)) return next();
  const { errors, data } = validateLink(req.body);
  if (errors.length) return rejected(req, res, errors);

  const link = await Topic.addLink(req.params.topicId, { ...data, authorId: req.user.id });
  if (!link) return next();
  if (wantsJson(req)) return res.status(201).json({ ok: true, link: flag(link, req.voterId) });
  req.flash('Enlace agregado.');
  res.redirect(`/topics/${req.params.topicId}`);
};

exports.update = async (req, res, next) => {
  const { errors, data } = validateLink(req.body);
  if (errors.length) return rejected(req, res, errors);

  const link = await Topic.updateLink(req.params.topicId, req.params.linkId, data);
  if (!link) return next();
  if (wantsJson(req)) return res.json({ ok: true, link: flag(link, req.voterId) });
  req.flash('Enlace actualizado.');
  res.redirect(`/topics/${req.params.topicId}`);
};

exports.destroy = async (req, res, next) => {
  const link = await Topic.removeLink(req.params.topicId, req.params.linkId);
  if (!link) return next();
  if (wantsJson(req)) return res.json({ ok: true, id: link.id, topicId: req.params.topicId });
  req.flash('Enlace eliminado.');
  res.redirect(`/topics/${req.params.topicId}`);
};
