'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { useTempDatabase, createClient } = require('./helpers');

const tmpDir = useTempDatabase();
const createApp = require('../src/app');

let server, base;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function signedIn(username) {
  const c = createClient(base);
  await c.loadCsrf('/auth/register');
  const res = await c.form('/auth/register', { username, password: 'contrasena123', passwordConfirm: 'contrasena123', next: '/' });
  assert.equal(res.status, 302, `no se pudo registrar ${username}`);
  await c.loadCsrf('/');   // el token cambia al iniciar sesion
  return c;
}
const newTopic = async (c, title) => (await c.json('/topics', 'POST', { title })).body.topic;

describe('servidor y vistas', () => {
  test('la portada responde HTML', async () => {
    const { res, html } = await createClient(base).loadCsrf('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(html, /Temas de aprendizaje/);
  });
  test('una ruta inexistente devuelve 404 con la vista de error', async () => {
    const res = await createClient(base).raw('/no-existe');
    assert.equal(res.status, 404);
    assert.match(await res.text(), /No encontramos/);
  });
  test('no se anuncia el motor y hay cabeceras de seguridad', async () => {
    const res = await createClient(base).raw('/');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  });
});

describe('CRUD de temas', () => {
  test('crear, leer, actualizar y eliminar', async () => {
    const c = await signedIn('crud_user');
    const created = await c.json('/topics', 'POST', { title: 'Aprender HTTP', description: 'Metodos y codigos.' });
    assert.equal(created.status, 201);
    const id = created.body.topic.id;

    assert.equal((await c.json(`/topics/${id}`)).body.topic.title, 'Aprender HTTP');
    const upd = await c.json(`/topics/${id}`, 'PUT', { title: 'Aprender HTTP a fondo', description: 'x' });
    assert.equal(upd.body.topic.title, 'Aprender HTTP a fondo');
    assert.equal((await c.json(`/topics/${id}`, 'DELETE')).status, 200);
    assert.equal((await c.json(`/topics/${id}`)).status, 404);
  });
  test('un titulo demasiado corto se rechaza con 422', async () => {
    const c = await signedIn('short_user');
    const res = await c.json('/topics', 'POST', { title: 'ab' });
    assert.equal(res.status, 422);
    assert.match(res.body.errors[0], /al menos 3/);
  });
  test('la busqueda filtra por titulo', async () => {
    const c = await signedIn('search_user');
    await newTopic(c, 'Fotografia nocturna');
    await newTopic(c, 'Panaderia casera');
    const { body } = await c.json('/?q=nocturna');
    assert.deepEqual(body.topics.map((t) => t.title), ['Fotografia nocturna']);
  });
  test('el formulario clasico con ?_method=PUT actualiza (sin JavaScript)', async () => {
    const c = await signedIn('form_user');
    const t = await newTopic(c, 'Tema por formulario');
    const res = await c.form(`/topics/${t.id}?_method=PUT`, { title: 'Editado por formulario', description: '' });
    assert.equal(res.status, 302);
    assert.equal((await c.json(`/topics/${t.id}`)).body.topic.title, 'Editado por formulario');
  });
});

describe('CRUD de enlaces', () => {
  test('agregar, actualizar y eliminar un enlace', async () => {
    const c = await signedIn('links_user');
    const t = await newTopic(c, 'Tema con enlaces');
    const added = await c.json(`/topics/${t.id}/links`, 'POST', { title: 'Documentacion MDN', url: 'developer.mozilla.org' });
    assert.equal(added.status, 201);
    assert.equal(added.body.link.url, 'https://developer.mozilla.org/');   // sin esquema -> https

    const id = added.body.link.id;
    const upd = await c.json(`/topics/${t.id}/links/${id}`, 'PUT', { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/es/' });
    assert.equal(upd.body.link.title, 'MDN Web Docs');
    assert.equal((await c.json(`/topics/${t.id}/links/${id}`, 'DELETE')).status, 200);
    assert.equal((await c.json(`/topics/${t.id}`)).body.topic.links.length, 0);
  });
  test('una URL con esquema javascript: se rechaza', async () => {
    const c = await signedIn('xss_user');
    const t = await newTopic(c, 'Tema para XSS');
    const res = await c.json(`/topics/${t.id}/links`, 'POST', { title: 'Malicioso', url: 'javascript:alert(document.cookie)' });
    assert.equal(res.status, 422);
    assert.match(res.body.errors.join(' '), /http:\/\/ o https:\/\//);
  });
  test('un enlace sobre un tema inexistente da 404', async () => {
    const c = await signedIn('ghost_user');
    assert.equal((await c.json('/topics/no-existe/links', 'POST', { title: 'Alguno', url: 'https://example.com' })).status, 404);
  });
});

describe('votaciones', () => {
  test('votar suma y volver a votar quita', async () => {
    const c = await signedIn('voter_user');
    const t = await newTopic(c, 'Tema votable');
    const up = await c.json(`/topics/${t.id}/vote`, 'POST');
    assert.deepEqual([up.body.votes, up.body.voted], [1, true]);
    const down = await c.json(`/topics/${t.id}/vote`, 'POST');
    assert.deepEqual([down.body.votes, down.body.voted], [0, false]);
  });
  test('cinco POST seguidos del mismo votante dejan el conteo en 1', async () => {
    const c = await signedIn('spam_user');
    const t = await newTopic(c, 'Tema anti-spam');
    for (let i = 0; i < 5; i += 1) await c.json(`/topics/${t.id}/vote`, 'POST');
    assert.equal((await c.json(`/topics/${t.id}`)).body.topic.votes, 1);
  });
  test('dos visitantes distintos suman dos votos, y votar no requiere cuenta', async () => {
    const owner = await signedIn('two_owner');
    const t = await newTopic(owner, 'Tema de dos votos');
    const anon = createClient(base);
    await anon.loadCsrf('/');
    assert.equal((await anon.json(`/topics/${t.id}/vote`, 'POST')).status, 200);
    assert.equal((await owner.json(`/topics/${t.id}/vote`, 'POST')).body.votes, 2);
  });
  test('la respuesta trae el orden recalculado por el servidor', async () => {
    const c = await signedIn('order_user');
    const a = await newTopic(c, 'Orden A');
    const b = await newTopic(c, 'Orden B');
    const { body } = await c.json(`/topics/${b.id}/vote`, 'POST');
    assert.ok(Array.isArray(body.order));
    assert.ok(body.order.indexOf(b.id) < body.order.indexOf(a.id));
  });
  test('el listado sale ordenado por votos descendentes', async () => {
    const c = createClient(base);
    await c.loadCsrf('/');
    const votes = (await c.json('/')).body.topics.map((t) => t.votes);
    assert.deepEqual(votes, [...votes].sort((x, y) => y - x));
  });
  test('los enlaces tambien se ordenan por votos', async () => {
    const c = await signedIn('link_order_user');
    const t = await newTopic(c, 'Enlaces ordenados');
    await c.json(`/topics/${t.id}/links`, 'POST', { title: 'Primero', url: 'https://a.com' });
    const segundo = (await c.json(`/topics/${t.id}/links`, 'POST', { title: 'Segundo', url: 'https://b.com' })).body.link;
    await c.json(`/topics/${t.id}/links/${segundo.id}/vote`, 'POST');
    assert.equal((await c.json(`/topics/${t.id}`)).body.topic.links[0].title, 'Segundo');
  });
});

describe('autenticacion y permisos', () => {
  test('sin sesion no se puede crear un tema', async () => {
    const c = createClient(base);
    await c.loadCsrf('/');
    assert.equal((await c.json('/topics', 'POST', { title: 'Intento anonimo' })).status, 401);
  });
  test('un usuario no puede editar ni borrar el tema de otro', async () => {
    const dueno = await signedIn('dueno_user');
    const intruso = await signedIn('intruso_user');
    const t = await newTopic(dueno, 'Tema con dueno');
    assert.equal((await intruso.json(`/topics/${t.id}`, 'PUT', { title: 'Secuestrado' })).status, 403);
    assert.equal((await intruso.json(`/topics/${t.id}`, 'DELETE')).status, 403);
    assert.equal((await dueno.json(`/topics/${t.id}`)).body.topic.title, 'Tema con dueno');
  });
  test('no se puede registrar dos veces el mismo usuario', async () => {
    await signedIn('repetido_user');
    const otro = createClient(base);
    await otro.loadCsrf('/auth/register');
    const res = await otro.form('/auth/register', { username: 'Repetido_User', password: 'contrasena123', passwordConfirm: 'contrasena123' });
    assert.equal(res.status, 422);
    assert.match(res.html, /ya esta en uso/);
  });
  test('el login fallido no revela si el usuario existe', async () => {
    await signedIn('existe_user');
    const c = createClient(base);
    await c.loadCsrf('/auth/login');
    const a = await c.form('/auth/login', { username: 'existe_user', password: 'incorrecta' });
    const b = await c.form('/auth/login', { username: 'no_existe_user', password: 'incorrecta' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.match(a.html, /Usuario o contrasena incorrectos/);
    assert.match(b.html, /Usuario o contrasena incorrectos/);
  });
  test('el redirect posterior al login no puede apuntar afuera', async () => {
    const c = createClient(base);
    await c.loadCsrf('/auth/register');
    const res = await c.form('/auth/register', {
      username: 'redirect_user', password: 'contrasena123', passwordConfirm: 'contrasena123',
      next: 'https://sitio-malicioso.example/phishing',
    });
    assert.equal(res.status, 302);
    assert.equal(res.location, '/');
  });
  test('la contrasena nunca se guarda en claro', async () => {
    await signedIn('hash_user');
    const dump = fs.readFileSync(process.env.DATA_FILE, 'utf8');
    assert.ok(!dump.includes('contrasena123'));
    assert.match(dump, /\$2[aby]\$/);
  });
});

describe('proteccion CSRF', () => {
  test('una mutacion sin token se rechaza con 403', async () => {
    const res = await fetch(`${base}/topics`, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ title: 'Sin token' }),
    });
    assert.equal(res.status, 403);
  });
  test('un token de otra identidad no sirve', async () => {
    const anon = createClient(base);
    await anon.loadCsrf('/');
    const user = await signedIn('csrf_user');
    const res = await user.raw('/topics', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': anon.csrf },
      body: JSON.stringify({ title: 'Token prestado' }),
    });
    assert.equal(res.status, 403);
  });
  test('las lecturas no piden token', async () => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
  });
});
