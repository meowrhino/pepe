// node --test: lo que pinta el archivo, sin Cloudflare
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, limpiarTags, archivo, portada, ordenar, admin } from '../worker/paginas.mjs';

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

test('sin filas de año; fechas con puntos y separadas por /; texto escapado', () => {
  const h = archivo(agrupar(filas));
  assert.doesNotMatch(h, /year/);
  assert.match(h, />2024\.12\.31<\/a> \/ <a[^>]+>2025\.01\.02</);
  assert.match(h, /calçotada &lt;b&gt;/);
  assert.match(h, /#paperwork/);
});

test('órdenes: reciente por la última foto, antiguo por la primera, a–z por nombre; uno raro cae a reciente', () => {
  const p = agrupar(filas);   // 1: 2024-12-31…2025-01-02 · 2: 2025-01-01
  assert.deepEqual(ordenar(p, 'reciente').map((x) => x.id), [1, 2]);
  assert.deepEqual(ordenar(p, 'antiguo').map((x) => x.id), [1, 2]);
  assert.deepEqual(ordenar(p, 'alfa').map((x) => x.title), ['calçotada <b>', 'otro']);
  assert.deepEqual(ordenar(p, 'nada').map((x) => x.id), ordenar(p, 'reciente').map((x) => x.id));
  const solo = [{ id: 1, title: 'b', images: [{ date: '2024-01-01' }] }, { id: 2, title: 'a', images: [{ date: '2025-01-01' }] }];
  assert.deepEqual(ordenar(solo, 'reciente').map((x) => x.id), [2, 1]);
  assert.deepEqual(ordenar(solo, 'antiguo').map((x) => x.id), [1, 2]);
});

test('superpepe marca el orden elegido', () => {
  const h = admin({ title: 'pepe', description: '', intro: [] }, agrupar(filas), '2026-11-12', 'alfa');
  assert.match(h, /data-orden="alfa" aria-pressed="true"/);
  assert.match(h, /data-orden="reciente" aria-pressed="false"/);
  assert.match(h, /<h1>superpepe<\/h1>/);
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
