// La copia del archivo en el repo, para que nada se quede solo en Cloudflare:
// data/archive.json (los proyectos, con los nombres de la casa) y las fotos en
// assets/img/archive/<año>/<uuid>.webp, igual que en R2. Lee solo lo que la web
// ya enseña (/api/archive y /media/): sin contraseña, y sin las fotos borradas.
// La corre cada noche .github/workflows/copia.yml, que hace commit si algo cambia.
//
//   node tools/copia.mjs [web]     (por defecto, la url de data/site.json)
import { mkdir, readFile, readdir, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import assert from 'node:assert/strict';

const raiz = new URL('..', import.meta.url).pathname;
const site = JSON.parse(await readFile(join(raiz, 'data/site.json'), 'utf8'));
// shortcut: sin dominio, la de workers.dev; al poner url en site.json, sale sola de ahí
const web = (process.argv[2] || site.url || 'https://pepe.manuellatourf.workers.dev').replace(/\/$/, '');
const carpeta = join(raiz, 'assets/img/archive');

const r = await fetch(`${web}/api/archive`);
if (!r.ok) throw new Error(`${web}/api/archive: ${r.status}`);
const proyectos = (await r.json()).sort((a, b) => a.id - b.id);   // por id: el diff no cambia al cambiar el orden de la web
// nada vacío: si la web falla y da una lista vacía, no se borra la copia
if (!proyectos.length) throw new Error('la web no ha dado ningún proyecto: no toco la copia');

const json = proyectos.map((p) => ({
  title: p.title,
  tags: p.tags ? p.tags.split(' ') : [],
  photos: p.images.map((i) => ({ date: i.date, src: `assets/img/archive/${i.src.replace(/^\/media\//, '')}` })),
}));

// las fotos que faltan (las que ya están no cambian nunca: cada una tiene su uuid)
let nuevas = 0;
for (const p of proyectos) for (const i of p.images) {
  const destino = join(raiz, 'assets/img/archive', i.src.replace(/^\/media\//, ''));
  if (await access(destino).then(() => true, () => false)) continue;
  const f = await fetch(`${web}${i.src}`);
  if (!f.ok) throw new Error(`${i.src}: ${f.status}`);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, Buffer.from(await f.arrayBuffer()));
  nuevas++;
}

// las que ya no salen en la web (borradas): fuera de la copia (siguen en el historial de git)
const vivas = new Set(json.flatMap((p) => p.photos.map((f) => join(raiz, f.src))));
const todas = (await readdir(carpeta, { recursive: true, withFileTypes: true }))
  .filter((d) => d.isFile() && !d.name.startsWith('.')).map((d) => join(d.parentPath, d.name));
const sobran = todas.filter((f) => !vivas.has(f));
for (const f of sobran) await rm(f);

await writeFile(join(raiz, 'data/archive.json'), `${JSON.stringify(json, null, 2)}\n`);

// la copia tiene que cuadrar: cada foto del JSON, en su sitio
for (const f of vivas) await access(f);
assert.equal(vivas.size, json.reduce((n, p) => n + p.photos.length, 0));
console.log(`copia de ${web}: ${json.length} proyectos, ${vivas.size} fotos (${nuevas} nuevas, ${sobran.length} quitadas)`);
if (sobran.length) console.log('quitadas:', sobran.map((f) => relative(raiz, f)).join(', '));
