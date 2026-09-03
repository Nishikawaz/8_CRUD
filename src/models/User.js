'use strict';

const bcrypt = require('bcryptjs');
const { getState, mutate, newId, now } = require('./store');

const ROUNDS = 10;
// Hash valido de una clave imposible; sirve para que un login contra un usuario
// inexistente tarde lo mismo que uno real y no revele si el nombre existe.
const DUMMY_HASH = bcrypt.hashSync('nunca-coincide-con-nada', ROUNDS);

const publicView = (u) => ({ id: u.id, username: u.username, createdAt: u.createdAt });
const key = (name) => String(name || '').trim().toLowerCase();

const findByUsername = (name) =>
  getState().users.find((u) => u.username.toLowerCase() === key(name)) || null;

const findById = (id) => getState().users.find((u) => u.id === id) || null;

async function create({ username, password }) {
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  return mutate((s) => {
    // Se revalida dentro de la mutacion: entre el chequeo del controlador y
    // este punto otra request pudo registrar el mismo nombre.
    if (s.users.some((u) => u.username.toLowerCase() === key(username))) {
      const err = new Error('Ese nombre de usuario ya esta en uso.');
      err.code = 'USERNAME_TAKEN';
      throw err;
    }
    const u = { id: newId(), username: username.trim(), passwordHash, createdAt: now() };
    s.users.push(u);
    return publicView(u);
  });
}

async function verify(username, password) {
  const u = findByUsername(username);
  const ok = await bcrypt.compare(String(password || ''), u ? u.passwordHash : DUMMY_HASH);
  return ok && u ? publicView(u) : null;
}

module.exports = { findByUsername, findById, create, verify, publicView };
