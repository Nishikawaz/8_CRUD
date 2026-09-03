'use strict';

const { limits } = require('../config');

/**
 * Validacion del servidor: la unica en la que la app confia. La del cliente
 * (public/js/app.js) es comodidad; cualquiera manda un POST con curl.
 */

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

function lengthError(label, value, { min = 0, max }) {
  if (value.length < min) return `${label} debe tener al menos ${min} caracteres.`;
  if (value.length > max) return `${label} no puede superar los ${max} caracteres.`;
  return null;
}

/**
 * Solo http y https. Un `javascript:` guardado como enlace y puesto en un
 * href es XSS almacenado, y el escapado de EJS no lo evita: el texto en si es
 * inofensivo, el esquema es el problema.
 */
function normalizeUrl(raw) {
  let value = clean(raw);
  if (!value) return { error: 'La URL es obligatoria.' };
  if (value.length > limits.url.max) return { error: `La URL no puede superar los ${limits.url.max} caracteres.` };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;   // "mdn.dev" -> https://mdn.dev

  let parsed;
  try { parsed = new URL(value); } catch { return { error: 'La URL no tiene un formato valido.' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Solo se permiten enlaces http:// o https://' };
  if (!parsed.hostname.includes('.')) return { error: 'La URL debe tener un dominio valido.' };
  return { value: parsed.toString() };
}

function validateTopic(body) {
  const title = clean(body.title);
  const description = clean(body.description);
  const errors = [
    lengthError('El titulo', title, limits.title),
    lengthError('La descripcion', description, limits.description),
  ].filter(Boolean);
  return { errors, data: { title, description } };
}

function validateLink(body) {
  const title = clean(body.title);
  const url = normalizeUrl(body.url);
  const errors = [lengthError('El titulo del enlace', title, limits.title), url.error].filter(Boolean);
  return { errors, data: { title, url: url.value || clean(body.url) } };
}

function validateCredentials(body, { confirm = false } = {}) {
  const username = clean(body.username);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = [];

  const nameErr = lengthError('El usuario', username, limits.username);
  if (nameErr) errors.push(nameErr);
  else if (!/^[\w.-]+$/.test(username)) errors.push('El usuario solo admite letras, numeros y . _ -');

  const passErr = lengthError('La contrasena', password, limits.password);
  if (passErr) errors.push(passErr);
  if (confirm && password !== body.passwordConfirm) errors.push('Las contrasenas no coinciden.');

  return { errors, data: { username, password } };
}

module.exports = { clean, normalizeUrl, validateTopic, validateLink, validateCredentials };
