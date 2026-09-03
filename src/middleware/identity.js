'use strict';

const crypto = require('node:crypto');
const config = require('../config');

/**
 * Quien vota, y el token CSRF.
 *
 * Votar no exige cuenta: cada visitante recibe una cookie firmada con un id
 * anonimo, que es la clave de deduplicacion del voto. La firma no vuelve el
 * voto infalsificable (borrar la cookie = votar de nuevo, como en cualquier
 * encuesta sin login); lo que impide es fabricar ids en un bucle sin la
 * clave del servidor.
 */

const sign = (v) => crypto.createHmac('sha256', config.session.secret).update(v).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch { /* se deja crudo */ }
    if (k) out[k] = v;
  }
  return out;
}

function readVisitor(raw) {
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 0) return null;
  const id = raw.slice(0, i);
  return safeEqual(raw.slice(i + 1), sign(id)) ? id : null;
}

function identity(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let visitorId = readVisitor(cookies[config.visitorCookie]);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    res.cookie(config.visitorCookie, `${visitorId}.${sign(visitorId)}`, {
      httpOnly: true, sameSite: 'lax', secure: config.env === 'production',
      maxAge: config.session.maxAgeMs, path: '/',
    });
  }

  const user = req.session?.user || null;
  req.user = user;
  // Con sesion se vota como la cuenta; sin ella, como el visitante anonimo.
  // Son identidades distintas a proposito: el voto sigue a la cuenta.
  req.voterId = user ? `user:${user.id}` : `anon:${visitorId}`;
  // Token ligado a la identidad: cambia al entrar o salir, que es justo
  // cuando conviene que el anterior deje de servir.
  req.csrfToken = sign(`csrf:${req.voterId}`);

  Object.assign(res.locals, { currentUser: user, csrfToken: req.csrfToken });
  next();
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function verifyCsrf(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const sent = req.get('x-csrf-token') || req.body?._csrf || req.query._csrf || '';
  if (safeEqual(sent, req.csrfToken)) return next();
  const err = new Error('Token de seguridad invalido. Recarga la pagina e intenta de nuevo.');
  err.status = 403;
  next(err);
}

module.exports = { identity, verifyCsrf };
