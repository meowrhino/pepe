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

export const archivo = (proyectos) => proyectos.map(fila).join('\n');

/** Los órdenes que pepe elige en superpepe (D1 → settings.order). Dentro de un proyecto, las fechas van siempre de la más antigua a la más nueva. */
export const ORDENES = {
  reciente: { nombre: 'más reciente', cmp: (a, b) => b.images.at(-1).date.localeCompare(a.images.at(-1).date) || b.id - a.id },
  antiguo: { nombre: 'más antiguo', cmp: (a, b) => a.images[0].date.localeCompare(b.images[0].date) || a.id - b.id },
  alfa: { nombre: 'a–z', cmp: (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true }) || a.id - b.id },
};
export const ordenar = (proyectos, orden) => [...proyectos].sort((ORDENES[orden] ?? ORDENES.reciente).cmp);

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
${intro || `<h1 class="oculto">${esc(site.title)}</h1>\n`}<main>
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

export function admin(site, proyectos, hoy, orden) {
  const titulos = [...new Set(proyectos.map((p) => p.title))];
  const fotos = proyectos.reduce((n, p) => n + p.images.length, 0);
  const elegido = ORDENES[orden] ? orden : 'reciente';
  // un recuadro por proyecto; data-title, para el buscador (public/js/admin.js)
  const lista = proyectos.map((p) => `<li class="caja" data-title="${esc(p.title)}">
<form class="proyecto" data-id="${p.id}">
<label>nombre <input name="title" value="${esc(p.title)}" required maxlength="200"></label>
<label>tags <input name="tags" value="${esc(p.tags)}" placeholder="sin tags"></label>
<button disabled>guardar</button>
</form>
<ul class="fotos">
${p.images.map((i) => `<li>
<a href="${esc(i.src)}" target="_blank" title="abrir la foto"><img src="${esc(i.src)}" alt="" loading="lazy" width="${i.width}" height="${i.height}"></a>
<form class="foto" data-id="${i.id}">
<input type="date" name="date" value="${i.date}" aria-label="fecha" required>
<div class="botones"><button disabled>guardar</button><button type="button" class="borrar">borrar</button></div>
</form>
</li>`).join('\n')}
<li class="anadir">
<form class="subir">
<input type="hidden" name="project" value="${p.id}">
<label class="elegir"><input type="file" name="image" accept="image/*,.heic,.heif,.tif,.tiff"><span>+ añadir foto</span><img class="previa" alt="" hidden></label>
<div class="si-foto" hidden>
<input type="date" name="date" value="${hoy}" aria-label="fecha" required>
<div class="botones"><button>subir</button></div>
<p class="estado" role="status"></p>
</div>
</form>
</li>
</ul>
<p class="pie">${p.images.length === 1 ? '1 foto' : `${p.images.length} fotos`} <button type="button" class="borrar-proyecto" data-id="${p.id}" data-n="${p.images.length}">borrar proyecto</button></p>
</li>`).join('\n');
  return `${cabeza(site, 'superpepe', { index: false })}
<body class="admin">
<header>
<h1>superpepe</h1>
<nav><a href="/" target="_blank">ver la web ↗</a><form method="post" action="/api/logout"><button>salir</button></form></nav>
</header>
<section class="caja nueva-caja">
<h2>proyecto nuevo</h2>
<form class="subir nueva">
<label class="elegir grande"><input type="file" name="image" accept="image/*,.heic,.heif,.tif,.tiff"><span>+ foto</span><img class="previa" alt="" hidden></label>
<div class="campos">
<label>nombre <input name="title" list="titulos" required maxlength="200" autocomplete="off"></label>
<datalist id="titulos">${titulos.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
<p class="existe" hidden>ese proyecto ya existe: la foto se le añade</p>
<label>fecha <input type="date" name="date" value="${hoy}" required></label>
<label>tags <input name="tags" placeholder="#paperwork" autocomplete="off"></label>
<div class="botones"><button class="principal">publicar</button></div>
<p class="estado" role="status"></p>
</div>
</form>
</section>
<div class="herramientas">
<div class="orden" role="group" aria-label="orden de la web"><span>orden de la web</span>
${Object.entries(ORDENES).map(([k, o]) => `<button type="button" data-orden="${k}" aria-pressed="${k === elegido}">${o.nombre}</button>`).join('')}
</div>
<input type="search" class="buscar" placeholder="buscar…" aria-label="buscar un proyecto">
<p class="cuenta">${proyectos.length} proyectos · ${fotos} fotos</p>
</div>
<ol class="proyectos">
${lista}
</ol>
<script src="/js/admin.js" defer></script>
</body>
</html>`;
}
