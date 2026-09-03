'use strict';

const config = require('../config');
const User = require('../models/User');
const { validateCredentials } = require('../middleware/validate');

/** Solo rutas internas: un `next` con host ajeno vuelve al login un redirector abierto. */
const safeNext = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/');

const form = (res, view, extra) => res.render(`auth/${view}`, { values: {}, errors: [], ...extra });

exports.loginForm = (req, res) => form(res, 'login', { title: 'Iniciar sesion', next: safeNext(req.query.next) });
exports.registerForm = (req, res) => form(res, 'register', { title: 'Crear cuenta', next: safeNext(req.query.next) });

/** Regenera la sesion al autenticar: corta cualquier fijacion de sesion previa. */
function startSession(req, res, next, user, target) {
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = user;
    req.session.flash = { message: `Hola, ${user.username}.`, kind: 'ok' };
    req.session.save((e) => (e ? next(e) : res.redirect(target)));
  });
}

exports.register = async (req, res, next) => {
  const target = safeNext(req.body.next);
  const { errors, data } = validateCredentials(req.body, { confirm: true });
  if (!errors.length && User.findByUsername(data.username)) errors.push('Ese nombre de usuario ya esta en uso.');

  const fail = (errs) =>
    res.status(422).render('auth/register', { title: 'Crear cuenta', values: { username: data.username }, errors: errs, next: target });

  if (errors.length) return fail(errors);
  try {
    startSession(req, res, next, await User.create(data), target);
  } catch (err) {
    if (err.code === 'USERNAME_TAKEN') return fail([err.message]);
    next(err);
  }
};

exports.login = async (req, res, next) => {
  const target = safeNext(req.body.next);
  const username = String(req.body.username || '').trim();
  const user = await User.verify(username, req.body.password);
  if (!user) {
    // Mismo mensaje exista o no el usuario: distinguirlos regala nombres validos.
    return res.status(401).render('auth/login', {
      title: 'Iniciar sesion', values: { username }, errors: ['Usuario o contrasena incorrectos.'], next: target,
    });
  }
  startSession(req, res, next, user, target);
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(config.session.name);
    res.redirect('/');
  });
};
