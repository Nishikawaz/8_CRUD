'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const config = require('./config');
const routes = require('./routes');
const flash = require('./middleware/flash');
const { identity, verifyCsrf } = require('./middleware/identity');
const { notFound, errorHandler } = require('./middleware/errorHandler');

/**
 * Armado de la app, sin escuchar en ningun puerto (eso es server.js): asi un
 * test la monta en un puerto efimero sin tocar el real.
 *
 * El ORDEN de los middlewares importa:
 *   parsers -> session -> flash -> identity -> verifyCsrf -> rutas
 * identity necesita la sesion para saber quien vota; verifyCsrf necesita el
 * token de identity y el body del parser. Mover identity antes de session
 * deja a todo usuario logueado votando como anonimo, sin ningun error visible.
 */
module.exports = function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    next();
  });

  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(express.json({ limit: '64kb' }));
  // El HTML solo manda GET y POST; ?_method=PUT se traduce a una request PUT real.
  app.use(methodOverride('_method'));

  app.use(session({
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,   // sin sesion para quien solo mira la lista
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.env === 'production', maxAge: config.session.maxAgeMs },
  }));

  app.use(flash);
  app.use(identity);
  app.use(verifyCsrf);

  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: config.env === 'production' ? '7d' : 0,
  }));

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler(config));
  return app;
};
