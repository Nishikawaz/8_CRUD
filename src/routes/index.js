'use strict';

const express = require('express');
const topics = require('../controllers/topicsController');
const links = require('../controllers/linksController');
const votes = require('../controllers/votesController');
const auth = require('../controllers/authController');
const { requireAuth, requireGuest } = require('../middleware/auth');
const { requireTopicOwner, requireLinkOwner } = require('../middleware/ownership');

const r = express.Router();

/*
 * Temas (REST). `/topics/new` va ANTES de `/topics/:id`: al reves, Express
 * tomaria "new" como id y el formulario de alta seria un 404.
 */
r.get('/', topics.index);
r.get('/topics', (req, res) => res.redirect('/'));
r.get('/topics/new', requireAuth, topics.newForm);
r.post('/topics', requireAuth, topics.create);
r.get('/topics/:id', topics.show);
r.get('/topics/:id/edit', requireAuth, requireTopicOwner, topics.editForm);
r.put('/topics/:id', requireAuth, requireTopicOwner, topics.update);
r.patch('/topics/:id', requireAuth, requireTopicOwner, topics.update);
r.delete('/topics/:id', requireAuth, requireTopicOwner, topics.destroy);

/* Enlaces, anidados en su tema */
r.post('/topics/:topicId/links', requireAuth, links.create);
r.put('/topics/:topicId/links/:linkId', requireAuth, requireLinkOwner, links.update);
r.patch('/topics/:topicId/links/:linkId', requireAuth, requireLinkOwner, links.update);
r.delete('/topics/:topicId/links/:linkId', requireAuth, requireLinkOwner, links.destroy);

/*
 * Votos: POST porque alternan estado (no son idempotentes a nivel HTTP). Lo
 * idempotente es el conteo por votante, y eso lo garantiza el modelo. Sin
 * sesion: votar es la interaccion de menor friccion de la app.
 */
r.post('/topics/:id/vote', votes.topic);
r.post('/topics/:topicId/links/:linkId/vote', votes.link);

/* Sesion */
r.get('/auth/login', requireGuest, auth.loginForm);
r.post('/auth/login', requireGuest, auth.login);
r.get('/auth/register', requireGuest, auth.registerForm);
r.post('/auth/register', requireGuest, auth.register);
r.post('/auth/logout', auth.logout);

r.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

module.exports = r;
