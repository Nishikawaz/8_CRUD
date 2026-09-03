'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** Base temporal por archivo de test. Se fija ANTES de requerir nada de src/. */
function useTempDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crud-test-'));
  process.env.DATA_FILE = path.join(dir, 'db.json');
  process.env.SESSION_SECRET = 'test-secret';
  return dir;
}

/** Cliente HTTP minimo que recuerda cookies y el token CSRF, como un navegador. */
function createClient(baseUrl) {
  const jar = new Map();
  let csrf = null;

  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const absorb = (res) => {
    for (const line of res.headers.getSetCookie?.() || []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  };

  async function raw(url, options = {}) {
    const headers = { ...options.headers };
    if (jar.size) headers.cookie = cookieHeader();
    // Token propio solo como valor por defecto: un test puede mandar uno ajeno.
    if (csrf && !('x-csrf-token' in headers)) headers['x-csrf-token'] = csrf;
    const res = await fetch(baseUrl + url, { ...options, headers, redirect: 'manual' });
    absorb(res);
    return res;
  }

  async function loadCsrf(url = '/') {
    const res = await raw(url);
    const html = await res.text();
    csrf = html.match(/name="csrf-token" content="([^"]+)"/)?.[1] || null;
    return { res, html };
  }

  async function json(url, method = 'GET', body) {
    const res = await raw(url, {
      method,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    return { status: res.status, body: payload };
  }

  async function form(url, fields) {
    const body = new URLSearchParams(fields);
    if (csrf) body.set('_csrf', csrf);
    const res = await raw(url, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(),
    });
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  }

  return { raw, json, form, loadCsrf, get csrf() { return csrf; } };
}

module.exports = { useTempDatabase, createClient };
