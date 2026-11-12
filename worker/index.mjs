/* ============================================================
   worker/index.mjs — el archivo de pepe.
   ------------------------------------------------------------
   Cloudflare sirve public/ (css, js, /login/, 404) sin pasar por
   aquí. Solo llegan las rutas de run_worker_first (wrangler.jsonc):

     /           el archivo, dentro del HTML (se lee sin JS)
     /admin/     subir fotos y corregir nombres, tags y fechas
     /api/*      login, logout, archive, images, projects, export
     /media/*    las fotos, de R2

   Los textos en D1 (las tablas se crean solas) y las fotos en R2.
   Un solo secreto, PASSWORD: la contraseña de /admin/, que firma
   también la sesión (si se cambia, hay que volver a entrar).
   Es el patrón de lasadcum (JAMstack, patrones §10b).
   ============================================================ */
import site from '../data/site.json';
import { agrupar, limpiarTags, portada, admin } from './paginas.mjs';

const SESION = 'pepe';
const DIAS = 60;
const MAX_TITULO = 200;
const MAX_FOTO = 5 * 1024 * 1024;   // ya comprimida en el navegador (public/js/admin.js) pesa mucho menos
const TIPOS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const AHORA = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/* ---------- D1: las tablas se crean la primera vez, sin migrar nada a mano ---------- */
let preparada = null;
function db(env) {
  preparada ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${AHORA}))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      date TEXT NOT NULL,
      image_key TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${AHORA}),
      deleted_at TEXT)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_images_date ON images(date, id)'),
  ]).catch((e) => { preparada = null; throw e; });
  return preparada.then(() => env.DB);
}

// un proyecto sin fotos vivas no sale: borrar su última foto lo quita de la lista
const archivo = async (env) => agrupar((await (await db(env)).prepare(
  `SELECT p.id AS pid, p.title, p.tags, i.id, i.date, i.image_key, i.width, i.height
   FROM images i JOIN projects p ON p.id = i.project_id
   WHERE i.deleted_at IS NULL ORDER BY i.date, i.id`).all()).results);

/* ---------- la sesión: una cookie con la hora, firmada con la contraseña ---------- */
async function firmar(env, msg) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// sin salir antes al primer carácter distinto: no dice por el tiempo cuánto se ha acertado
function iguales(a, b) {
  let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
async function dentro(req, env) {
  if (!env.PASSWORD) return false;
  const c = /(?:^|;\s*)pepe=(\d+)\.([0-9a-f]+)/.exec(req.headers.get('cookie') || '');
  return !!c && Date.now() - Number(c[1]) < DIAS * 864e5 && iguales(c[2], await firmar(env, c[1]));
}
const cookie = (valor, edad) => `${SESION}=${valor}; Path=/; Max-Age=${edad}; HttpOnly; Secure; SameSite=Strict`;
// lo que escribe tiene que venir de la propia web (un formulario de otra no puede)
const deAqui = (req) => req.headers.get('origin') === new URL(req.url).origin;

const texto = (msg, status) => new Response(msg, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const ir = (url, extra = {}) => new Response(null, { status: 303, headers: { location: url, ...extra } });
const html = (body) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

/* ---------- lo que llega de los formularios ---------- */
class Aviso extends Error {}   // un error de pepe al rellenar: sale tal cual, con 400
function titulo(f) {
  const t = String(f.get('title') || '').replace(/\s+/g, ' ').trim();
  if (!t) throw new Aviso('falta el nombre del proyecto');
  if (t.length > MAX_TITULO) throw new Aviso(`el nombre es demasiado largo (máx. ${MAX_TITULO})`);
  return t;
}
function dia(f) {
  const d = String(f.get('date') || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new Aviso('la fecha no es válida');
  return d;
}

async function login(req, env) {
  if (!deAqui(req)) return texto('no', 403);
  if (!env.PASSWORD) return texto('Falta el secreto PASSWORD en Cloudflare: Workers → pepe → Settings → Variables and Secrets (GUIA).', 500);
  // sin los espacios de los lados: un espacio de más al pegarla no deja fuera
  const pw = String((await req.formData()).get('password') || '').trim();
  let libre = true;   // diez intentos por minuto y por IP (wrangler.jsonc → ratelimits)
  try { libre = (await env.LOGIN_LIMIT?.limit({ key: req.headers.get('cf-connecting-ip') || 'local' }))?.success ?? true; }
  catch (e) { console.error('sin límite de intentos:', e); }
  if (libre && iguales(pw, env.PASSWORD.trim())) {
    const ahora = String(Date.now());
    return ir('/admin/', { 'set-cookie': cookie(`${ahora}.${await firmar(env, ahora)}`, DIAS * 86400) });
  }
  console.log('login fallido', { libre });   // nada de la contraseña en los Logs
  await new Promise((r) => setTimeout(r, 1000));
  const res = await env.ASSETS.fetch(new Request(new URL('/login/', req.url)));
  return new HTMLRewriter().on('.error', { element: (el) => { el.removeAttribute('hidden'); } })
    .transform(new Response(res.body, { status: 401, headers: res.headers }));
}

// una foto nueva: al proyecto con ese nombre si ya existe, si no, a uno nuevo
async function subir(req, env) {
  const f = await req.formData();
  const title = titulo(f), date = dia(f), tags = limpiarTags(f.get('tags'));
  const img = f.get('image');
  if (!img || typeof img !== 'object' || !img.size) throw new Aviso('falta la foto');
  const ext = TIPOS[img.type];
  if (!ext) throw new Aviso('la foto tiene que ser webp, jpg o png');
  if (img.size > MAX_FOTO) throw new Aviso('la foto pesa demasiado (máx. 5 MB)');
  const w = Number(f.get('width')), h = Number(f.get('height'));
  if (![w, h].every((n) => Number.isInteger(n) && n > 0 && n <= 10000)) throw new Aviso('faltan las medidas de la foto');

  const d1 = await db(env);
  let p = await d1.prepare('SELECT id, tags FROM projects WHERE title = ? ORDER BY id LIMIT 1').bind(title).first();
  if (p) {
    const juntas = limpiarTags(`${p.tags} ${tags}`);
    if (juntas !== p.tags) await d1.prepare('UPDATE projects SET tags = ? WHERE id = ?').bind(juntas, p.id).run();
  } else {
    p = await d1.prepare('INSERT INTO projects (title, tags) VALUES (?, ?) RETURNING id').bind(title, tags).first();
  }
  const key = `${date.slice(0, 4)}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, await img.arrayBuffer(), { httpMetadata: { contentType: img.type } });
  const fila = await d1.prepare('INSERT INTO images (project_id, date, image_key, width, height) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(p.id, date, key, w, h).first();
  return Response.json({ project: p.id, image: fila.id, src: `/media/${key}` }, { status: 201 });
}

async function editarProyecto(id, req, env) {
  const f = await req.formData();
  const r = await (await db(env)).prepare('UPDATE projects SET title = ?, tags = ? WHERE id = ?')
    .bind(titulo(f), limpiarTags(f.get('tags')), id).run();
  return r.meta.changes ? Response.json({ ok: true }) : texto('no está', 404);
}

async function editarFoto(id, req, env) {
  const r = await (await db(env)).prepare('UPDATE images SET date = ? WHERE id = ? AND deleted_at IS NULL')
    .bind(dia(await req.formData()), id).run();
  return r.meta.changes ? Response.json({ ok: true }) : texto('no está', 404);
}

// borrar es borrado blando: la foto deja de salir, pero sigue en D1 y R2 (y en /api/export)
async function borrarFoto(id, env) {
  const r = await (await db(env)).prepare(`UPDATE images SET deleted_at = ${AHORA} WHERE id = ? AND deleted_at IS NULL`).bind(id).run();
  return r.meta.changes ? Response.json({ ok: true }) : texto('no está', 404);
}

async function media(key, env) {
  const viva = await (await db(env)).prepare('SELECT 1 FROM images WHERE image_key = ? AND deleted_at IS NULL').bind(key).first();
  const o = viva && await env.MEDIA.get(key);
  if (!o) return texto('no está', 404);
  const headers = new Headers();
  o.writeHttpMetadata(headers);
  headers.set('etag', o.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(o.body, { headers });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname, m = req.method;
    try {
      if (p === '/') return html(portada(site, await archivo(env)));
      // las claves (2025/<uuid>.webp) no llevan nada que descodificar
      if (p.startsWith('/media/') && (m === 'GET' || m === 'HEAD')) return media(p.slice(7), env);
      if (p === '/api/archive' && m === 'GET') return Response.json(await archivo(env));
      if (p === '/api/login' && m === 'POST') return login(req, env);
      if (p === '/api/logout' && m === 'POST') return ir('/', { 'set-cookie': cookie('', 0) });

      // a partir de aquí, con la contraseña
      const ok = await dentro(req, env);
      if (p === '/admin/') return ok ? html(admin(site, await archivo(env), new Date().toISOString().slice(0, 10))) : ir('/login/');
      if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
      if (!ok) return texto('hay que entrar con la contraseña (vuelve a /admin/)', 401);
      if (p === '/api/export' && m === 'GET') {
        const d1 = await db(env);
        const [projects, images] = await Promise.all(['projects', 'images'].map(async (t) => (await d1.prepare(`SELECT * FROM ${t} ORDER BY id`).all()).results));
        return Response.json({ projects, images }, { headers: { 'content-disposition': `attachment; filename="pepe-${new Date().toISOString().slice(0, 10)}.json"` } });
      }
      if (!deAqui(req)) return texto('no', 403);
      if (p === '/api/images' && m === 'POST') return await subir(req, env);
      const [, tipo, id] = /^\/api\/(projects|images)\/(\d+)$/.exec(p) || [];
      if (tipo === 'projects' && m === 'PATCH') return await editarProyecto(Number(id), req, env);
      if (tipo === 'images' && m === 'PATCH') return await editarFoto(Number(id), req, env);
      if (tipo === 'images' && m === 'DELETE') return await borrarFoto(Number(id), env);
      return texto('no está', 404);
    } catch (e) {
      // los de los formularios (falta el nombre, fecha mala…) se le enseñan a pepe tal cual
      if (e instanceof Aviso) return texto(e.message, 400);
      console.error(e);
      return texto(`error del archivo: ${e.message}`, 500);
    }
  },
};
