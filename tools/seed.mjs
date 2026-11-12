// Sube las fotos de data/seed.json (las 37 primeras, del RTF de pepe del 6 de
// noviembre de 2026) por la misma API que usa /admin/, así entran igual que las
// que suba él. Las pasa antes a webp ≤ 2000 px, q85 (lo de imgToWeb), con sharp.
//
//   node tools/seed.mjs <web> <carpeta con las fotos>
//   node tools/seed.mjs http://localhost:8787 ~/Desktop/"PEPE FILES"
//
// La contraseña, de PASSWORD o de .dev.vars. Para si el archivo ya tiene algo
// (para no subirlas dos veces).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const [web, carpeta] = process.argv.slice(2);
if (!web || !carpeta) throw new Error('uso: node tools/seed.mjs <web> <carpeta con las fotos>');
const raiz = new URL('..', import.meta.url).pathname;
const password = process.env.PASSWORD
  ?? /^PASSWORD=(.*)$/m.exec(await readFile(join(raiz, '.dev.vars'), 'utf8').catch(() => ''))?.[1];
if (!password) throw new Error('falta la contraseña: PASSWORD=… o .dev.vars');

const origin = new URL(web).origin;
const ya = await (await fetch(`${origin}/api/archive`)).json();
if (ya.length) throw new Error(`el archivo ya tiene ${ya.length} proyectos: no subo nada`);

const login = await fetch(`${origin}/api/login`, {
  method: 'POST', redirect: 'manual', headers: { origin }, body: new URLSearchParams({ password }),
});
const sesion = login.headers.getSetCookie().find((c) => c.startsWith('pepe='))?.split(';')[0];
if (!sesion) throw new Error(`no he podido entrar (${login.status})`);

const filas = JSON.parse(await readFile(join(raiz, 'data/seed.json'), 'utf8'));
for (const [n, f] of filas.entries()) {
  const { data, info } = await sharp(join(carpeta, f.file)).rotate()
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const body = new FormData();
  body.set('title', f.title);
  body.set('date', f.date);
  body.set('tags', f.tags || '');
  body.set('image', new Blob([data], { type: 'image/webp' }), 'foto.webp');
  body.set('width', info.width);
  body.set('height', info.height);
  const r = await fetch(`${origin}/api/images`, { method: 'POST', headers: { origin, cookie: sesion }, body });
  if (!r.ok) throw new Error(`${f.file}: ${r.status} ${await r.text()}`);
  console.log(`${n + 1}/${filas.length}  ${f.date}  ${f.title}  (${Math.round(data.length / 1024)} KB)`);
}
