#!/usr/bin/env node
'use strict';

/**
 * Datos de ejemplo. No pisa nada salvo --force (y en ese caso respalda antes).
 *   node scripts/seed.js [--force]
 */
const fs = require('node:fs');
const config = require('../src/config');
const { getState, mutate } = require('../src/models/store');
const Topic = require('../src/models/Topic');

const SEED = [
  { title: 'Como programar como un ninja', votes: 12,
    description: 'Atajos, habitos y herramientas para escribir codigo rapido sin dejar un desastre atras.',
    links: [
      ['The Pragmatic Programmer', 'https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/', 7],
      ['Atajos de teclado que valen la pena', 'https://www.jetbrains.com/help/idea/mastering-keyboard-shortcuts.html', 4],
      ['Refactoring', 'https://refactoring.com/', 2],
    ] },
  { title: 'Dominar el arte de preparar cafe', votes: 8,
    description: 'Del molido a la extraccion. Por que tu cafe sabe amargo y que cambiar primero.',
    links: [
      ['Guia de extraccion de James Hoffmann', 'https://www.youtube.com/@jameshoffmann', 9],
      ['Tabla de molienda por metodo', 'https://www.baristahustle.com/blog/grind-size-guide/', 3],
    ] },
  { title: 'HTTP de punta a punta', votes: 15,
    description: 'Metodos, codigos de estado, cabeceras y cache: lo que hay que entender antes de escribir una API.',
    links: [
      ['MDN — Metodos de peticion HTTP', 'https://developer.mozilla.org/es/docs/Web/HTTP/Methods', 11],
      ['MDN — Codigos de estado', 'https://developer.mozilla.org/es/docs/Web/HTTP/Status', 6],
      ['RFC 9110 — HTTP Semantics', 'https://www.rfc-editor.org/rfc/rfc9110.html', 1],
    ] },
  { title: 'Arquitectura MVC sin misticismos', votes: 6,
    description: 'Que va en el modelo, que en el controlador, y por que la vista no deberia saber de la base.',
    links: [['Catalogo de patrones de Fowler', 'https://martinfowler.com/eaaCatalog/', 5]] },
  { title: 'JavaScript puro: el DOM sin frameworks', votes: 9,
    description: 'querySelector, delegacion de eventos y animaciones FLIP. Se puede hacer mucho antes de instalar nada.',
    links: [
      ['MDN — Introduccion al DOM', 'https://developer.mozilla.org/es/docs/Web/API/Document_Object_Model/Introduction', 8],
      ['FLIP your animations', 'https://aerotwist.com/blog/flip-your-animations/', 4],
    ] },
];

/** Votos de ejemplo como votantes ficticios: el modelo deriva votes de voters.length. */
const stuff = (topicId, linkId, n) => mutate((s) => {
  const t = s.topics.find((x) => x.id === topicId);
  const target = linkId ? t?.links.find((l) => l.id === linkId) : t;
  if (!target) return;
  for (let i = 0; i < n; i += 1) target.voters.push(`seed:${target.id}:${i}`);
  target.votes = target.voters.length;
});

(async () => {
  const force = process.argv.includes('--force');
  if (getState().topics.length && !force) {
    console.log(`Ya hay ${getState().topics.length} tema(s) en ${config.dataFile}. Usa --force para reemplazarlos.`);
    return;
  }
  if (force && fs.existsSync(config.dataFile)) {
    const bak = `${config.dataFile}.bak.${Date.now()}`;
    fs.copyFileSync(config.dataFile, bak);
    console.log(`Respaldo en ${bak}`);
    await mutate((s) => { s.topics = []; });
  }
  for (const item of SEED) {
    const t = await Topic.create({ title: item.title, description: item.description });
    for (const [title, url, votes] of item.links) {
      const l = await Topic.addLink(t.id, { title, url });
      await stuff(t.id, l.id, votes);
    }
    await stuff(t.id, null, item.votes);
  }
  console.log(`Sembrados ${SEED.length} temas en ${config.dataFile}.`);
})().catch((e) => { console.error(e); process.exit(1); });
