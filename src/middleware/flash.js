'use strict';

/** Mensaje de un solo uso entre redirects. Se lee y se borra en la misma request. */
module.exports = function flash(req, res, next) {
  res.locals.flash = req.session?.flash || null;
  if (req.session?.flash) delete req.session.flash;
  req.flash = (message, kind = 'ok') => { if (req.session) req.session.flash = { message, kind }; };
  next();
};
