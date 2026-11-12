// node --test: lo que pinta el archivo, sin Cloudflare
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, limpiarTags, archivo, portada } from '../worker/paginas.mjs';

const filas = [
  { pid: 1, title: 'calçotada <b>', tags: 'paperwork', id: 1, date: '2024-12-31', image_key: 'a.webp', width: 10, height: 20 },
  { pid: 2, title: 'otro', tags: '', id: 2, date: '2025-01-01', image_key: 'b.webp', width: 10, height: 20 },
  { pid: 1, title: 'calçotada <b>', tags: 'paperwork', id: 3, date: '2025-01-02', image_key: 'c.webp', width: 10, height: 20 },
];

test('agrupa por proyecto en el orden de su primera foto', () => {
  const p = agrupar(filas);
  assert.deepEqual(p.map((x) => x.id), [1, 2]);
  assert.deepEqual(p[0].images.map((i) => i.id), [1, 3]);
});

test('una fila de año cuando cambia, fechas con puntos y separadas por /, texto escapado', () => {
  const h = archivo(agrupar(filas));
  assert.equal((h.match(/class="year"/g) || []).length, 2);
  assert.match(h, />2024\.12\.31<\/a> \/ <a[^>]+>2025\.01\.02</);
  assert.match(h, /calçotada &lt;b&gt;/);
  assert.match(h, /#paperwork/);
});

test('tags: sin #, minúsculas, sin repetir', () => {
  assert.equal(limpiarTags('#Paperwork, proyecto #paperwork  ##x<y'), 'paperwork proyecto xy');
  assert.equal(limpiarTags(''), '');
});

test('sin intro no sale el bloque pepe; sin url, noindex', () => {
  const site = { title: 'pepe', description: 'd', url: '', intro: [] };
  assert.doesNotMatch(portada(site, []), /class="intro"/);
  assert.match(portada(site, []), /noindex/);
  assert.match(portada({ ...site, intro: ['hola'] }, []), /<h1>pepe<\/h1>\n<p>hola<\/p>/);
});
