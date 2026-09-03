'use strict';

const { wantsJson } = require('./auth');

function notFound(req, res, next) {
  const err = new Error(`No encontramos ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/** Los 5xx se loguean enteros; al cliente en produccion le llega un generico. */
const errorHandler = (config) => (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[error]', err);
  const message = status >= 500 && config.env === 'production'
    ? 'Algo fallo de nuestro lado. Intenta de nuevo en un momento.'
    : err.message;

  if (wantsJson(req)) return res.status(status).json({ ok: false, error: message });
  res.status(status).render('error', {
    title: `Error ${status}`, status, message,
    stack: config.env === 'development' ? err.stack : null,
  });
};

module.exports = { notFound, errorHandler };
