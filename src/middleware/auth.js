'use strict';

/** Una request de fetch/API recibe JSON; una de navegacion, un redirect. */
const wantsJson = (req) =>
  req.xhr || req.path.startsWith('/api/') || (req.get('accept') || '').includes('application/json');

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (wantsJson(req)) return res.status(401).json({ ok: false, error: 'Necesitas iniciar sesion.' });
  res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
}

const requireGuest = (req, res, next) => (req.user ? res.redirect('/') : next());

module.exports = { wantsJson, requireAuth, requireGuest };
