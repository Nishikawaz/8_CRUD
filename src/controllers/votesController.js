'use strict';

const Topic = require('../models/Topic');
const { wantsJson } = require('../middleware/auth');

/**
 * La respuesta trae `order`: el orden COMPLETO recalculado por el servidor.
 * El cliente no lo deduce del contador nuevo — habria dos implementaciones
 * del mismo criterio y bastaria olvidar el desempate en una para que la lista
 * quedara distinta a la que se ve al recargar. El cliente solo mueve nodos.
 */

exports.topic = async (req, res, next) => {
  const r = await Topic.toggleVote(req.params.id, req.voterId);
  if (!r) return next();
  if (wantsJson(req)) {
    return res.json({ ok: true, type: 'topic', ...r, order: Topic.all().map((t) => t.id) });
  }
  res.redirect(req.get('referer') || '/');
};

exports.link = async (req, res, next) => {
  const { topicId, linkId } = req.params;
  const r = await Topic.toggleLinkVote(topicId, linkId, req.voterId);
  if (!r) return next();
  if (wantsJson(req)) {
    const order = Topic.findById(topicId)?.links.map((l) => l.id) ?? [];
    return res.json({ ok: true, type: 'link', ...r, order });
  }
  res.redirect(req.get('referer') || `/topics/${topicId}`);
};
