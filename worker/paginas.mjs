/* ============================================================
   worker/paginas.mjs — el HTML de pepe, sin nada de Cloudflare.
   El Worker le pasa las filas de D1 y esto devuelve la página
   entera, con el archivo dentro (se lee sin JS).
   ============================================================ */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 2025-01-08 → 2025.01.08, como en la lista de pepe */
export const fecha = (d) => d.replaceAll('-', '.');

/** "#Paperwork, proyecto" → "paperwork proyecto": sin #, en minúsculas, sin repetir, máx. 10 */
export function limpiarTags(s) {
  const tags = String(s || '').toLowerCase().split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 10).join(' ');
}

/** Las filas de D1 (una por imagen, ordenadas por fecha) → proyectos en el orden de su primera foto. */
export function agrupar(filas) {
  const porId = new Map();
  for (const f of filas) {
    if (!porId.has(f.pid)) porId.set(f.pid, { id: f.pid, title: f.title, tags: f.tags, images: [] });
    porId.get(f.pid).images.push({ id: f.id, date: f.date, src: `/media/${f.image_key}`, width: f.width, height: f.height });
  }
  return [...porId.values()];
}

const tagsHtml = (tags) => (tags ? tags.split(' ').map((t) => `#${esc(t)}`).join(' ') : '');

function fila(p) {
  const fechas = p.images.map((i) =>
    `<a href="${esc(i.src)}" data-w="${i.width}" data-h="${i.height}" data-alt="${esc(`${p.title}, ${fecha(i.date)}`)}">${fecha(i.date)}</a>`,
  ).join(' / ');
  return `<li><span class="title">${esc(p.title)}</span><span class="tags">${tagsHtml(p.tags)}</span><span class="dates">${fechas}</span></li>`;
}

/** La lista, con una fila con el año cada vez que cambia (el de la primera foto del proyecto). */
export function archivo(proyectos) {
  let año = '';
  return proyectos.map((p) => {
    const a = p.images[0].date.slice(0, 4);
    const cabecera = a !== año ? `<li class="year"><span class="dates">${a}</span></li>\n` : '';
    año = a;
    return cabecera + fila(p);
  }).join('\n');
}

function cabeza(site, titulo, { index = true } = {}) {
  const robots = site.url && index ? '' : '\n<meta name="robots" content="noindex">';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(site.description)}">${robots}
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/css/style.css">
</head>`;
}

export function portada(site, proyectos) {
  // el bloque "pepe" y sus párrafos salen solo cuando data/site.json → intro tiene algo
  const intro = site.intro?.length
    ? `<header class="intro">\n<h1>${esc(site.title)}</h1>\n${site.intro.map((p) => `<p>${esc(p)}</p>`).join('\n')}\n</header>\n`
    : '';
  return `${cabeza(site, site.title)}
<body>
${intro}<main>
<h2>archive</h2>
<ol class="archive">
${archivo(proyectos)}
</ol>
</main>
<figure class="preview" hidden><img alt=""></figure>
<script src="/js/main.js" defer></script>
</body>
</html>`;
}

export function admin(site, proyectos, hoy) {
  const titulos = [...new Set(proyectos.map((p) => p.title))];
  const lista = proyectos.map((p) => `<li>
<form class="proyecto" data-id="${p.id}">
<input name="title" value="${esc(p.title)}" aria-label="nombre del proyecto" required maxlength="200">
<input name="tags" value="${esc(p.tags)}" aria-label="tags" placeholder="tags">
<button>guardar</button>
</form>
<ul class="fotos">
${p.images.map((i) => `<li>
<a href="${esc(i.src)}" target="_blank"><img src="${esc(i.src)}" alt="" loading="lazy" width="${i.width}" height="${i.height}"></a>
<form class="foto" data-id="${i.id}">
<input type="date" name="date" value="${i.date}" aria-label="fecha" required>
<button>guardar</button>
<button type="button" class="borrar">borrar</button>
</form>
</li>`).join('\n')}
</ul>
</li>`).join('\n');
  return `${cabeza(site, `${site.title} · admin`, { index: false })}
<body class="admin">
<header>
<h1>${esc(site.title)} · admin</h1>
<form method="post" action="/api/logout"><button>salir</button></form>
</header>
<form class="nueva" action="/api/images">
<label>foto <input type="file" name="image" accept="image/*,.heic,.heif,.tif,.tiff" required></label>
<label>proyecto <input name="title" list="titulos" required maxlength="200" autocomplete="off"></label>
<datalist id="titulos">${titulos.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
<label>fecha <input type="date" name="date" value="${hoy}" required></label>
<label>tags <input name="tags" placeholder="#paperwork" autocomplete="off"></label>
<button>publicar</button>
<p class="estado" role="status"></p>
</form>
<p class="nota">Si el proyecto ya existe (sale en la lista al escribir), la foto se le añade. Para cambiar un nombre, tags o fechas: abajo, y «guardar».</p>
<ol class="proyectos">
${lista}
</ol>
<script src="/js/admin.js" defer></script>
</body>
</html>`;
}
