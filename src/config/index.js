'use strict';

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/** Unico punto que lee process.env. El resto de la app consume este objeto. */
module.exports = {
  root: ROOT,
  env: process.env.NODE_ENV || 'development',

  // Loopback por defecto: en un VPS, 0.0.0.0 publica el puerto saltando el firewall.
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT) || 3302,

  dataFile: process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json'),

  session: {
    name: 'crud.sid',
    secret: process.env.SESSION_SECRET || 'secreto-de-desarrollo-cambiar-en-produccion',
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  },

  visitorCookie: 'crud.visitor',

  limits: {
    title: { min: 3, max: 120 },
    description: { max: 1000 },
    url: { max: 2048 },
    username: { min: 3, max: 32 },
    password: { min: 8, max: 128 },
  },
};
