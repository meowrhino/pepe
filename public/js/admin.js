// /admin/: subir fotos y corregir nombres, tags y fechas (el Worker, worker/index.mjs).
// La foto se pasa en el navegador a webp ≤ 2000 px, q85, con lo de imgToWeb
// (copiado de lasadcum, js/admin.js): HEIC con heic2any y TIFF con UTIF, que se
// cargan solo si hacen falta. Safari no sabe hacer webp con canvas (ni ningún
// navegador del iPhone): ahí lo hace js/webp/, el códec de Squoosh en wasm
// (@jsquash/webp 1.5.0, Apache-2.0; como notas8 y lasadcum), y si no carga, sale jpg.
const nueva = document.querySelector('form.nueva');
const WEBP = new URL('webp/', document.currentScript.src);   // al lado de este fichero

// las librerías de imgToWeb, con SRI para no ejecutar nada alterado
const LIBS = {
  heic2any: ['https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
    'sha384-OTofQ0MEeiSgh62havBcemCIK0gqj809wX6UA0uPISNMRnR6NZyCdGzX3SbLrgwL'],
  UTIF: ['https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js',
    'sha384-RyBmXHdfZ/Uon+ud+/AqSyWpUWnKYt2tkRG/P4gWoRUGDU+qIAV3tGBPNlYTBZEF'],
};
const cargar = (nom) => window[nom] ? Promise.resolve(window[nom]) : new Promise((ok, ko) => {
  const s = Object.assign(document.createElement('script'), { src: LIBS[nom][0], integrity: LIBS[nom][1], crossOrigin: 'anonymous' });
  s.onload = () => ok(window[nom]);
  s.onerror = () => { s.remove(); ko(new Error(`no se ha podido cargar ${nom}`)); };
  document.head.append(s);
});

// con <img> el navegador aplica la orientación EXIF, como al mostrarla
const leer = (blob) => new Promise((ok, ko) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); ok(img); };
  img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('el navegador no sabe leer esta imagen')); };
  img.src = url;
});

async function abrir(file) {
  if (file.type === 'image/tiff' || /\.tiff?$/i.test(file.name)) {
    const UTIF = await cargar('UTIF');
    const buf = await file.arrayBuffer();
    const [p] = UTIF.decode(buf);
    if (!p) throw new Error('tiff sin imágenes');
    UTIF.decodeImage(buf, p);
    const c = Object.assign(document.createElement('canvas'), { width: p.width, height: p.height });
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(p)), p.width, p.height), 0, 0);
    return c;
  }
  try { return await leer(file); }
  catch (e) {
    // HEIC (fotos de iPhone): Safari lo lee; Chrome y Firefox, con heic2any
    if (!/^image\/hei[cf]$/.test(file.type) && !/\.hei[cf]$/i.test(file.name)) throw e;
    const out = await (await cargar('heic2any'))({ blob: file, toType: 'image/png' });
    return leer(Array.isArray(out) ? out[0] : out);
  }
}

// el códec se carga la primera vez que hace falta (280 KB) y se queda
let codec = null;
async function webpWasm(c) {
  codec ??= Promise.all([import(new URL('webp_enc.js', WEBP)), import(new URL('meta.js', WEBP))])
    .then(async ([enc, meta]) => [await enc.default({ noInitialRun: true }), meta.defaultOptions])
    .catch((e) => { codec = null; throw e; });
  const [m, opciones] = await codec;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const out = m.encode(d.data, d.width, d.height, { ...opciones, quality: 85 });
  if (!out?.byteLength) throw new Error('webp vacío');
  return new Blob([out], { type: 'image/webp' });
}

async function comprimir(file) {
  const src = await abrir(file);
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, 2000 / Math.max(w0, h0));
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w0 * k)), height: Math.max(1, Math.round(h0 * k)) });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';   // con el de por defecto, una reducción grande sale con dientes
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const blob = (tipo) => new Promise((ok) => c.toBlob(ok, tipo, 0.85));
  let b = await blob('image/webp');
  if (b?.type !== 'image/webp') b = await webpWasm(c).catch((e) => { console.warn('sin webp en wasm:', e); return null; });
  if (b?.type !== 'image/webp') b = await blob('image/jpeg');
  if (!b) throw new Error('el navegador no ha podido hacer la imagen');
  return { b, w: c.width, h: c.height };
}

// tras guardar, subir o borrar se recarga con ese proyecto abierto (#p<n>, en worker/paginas.mjs)
document.getElementById(location.hash.slice(1))?.setAttribute('open', '');
const recargar = (pid) => { if (pid) location.hash = `p${pid}`; location.reload(); };

async function enviar(url, method, body) {
  const r = await fetch(url, { method, body });
  if (!r.ok) throw new Error(await r.text());
  return r;
}

// subir una foto: el formulario de arriba (proyecto nuevo, o uno que ya existe por el nombre)
// y el «+ añadir foto» de cada recuadro (lleva el número del proyecto). Los dos, igual.
document.querySelectorAll('form.subir').forEach((f) => {
  const previa = f.querySelector('.previa');
  const estado = f.querySelector('.estado');
  const resto = f.querySelector('.si-foto');   // en los recuadros, la fecha y «subir» salen al elegir la foto

  // la foto elegida, en pequeño, antes de subirla (un HEIC en Chrome no se ve aquí, pero se sube bien)
  f.image.addEventListener('change', () => {
    const file = f.image.files[0];
    if (previa.src) URL.revokeObjectURL(previa.src);
    previa.hidden = !file;
    if (file) previa.src = URL.createObjectURL(file);
    if (resto) resto.hidden = !file;
    f.classList.toggle('con-foto', !!file);
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = f.image.files[0];
    if (!file) { estado.textContent = 'falta la foto'; return; }
    const boton = f.querySelector('button');
    boton.disabled = true;
    estado.textContent = 'subiendo…';
    try {
      const datos = new FormData(f);
      const { b, w, h } = await comprimir(file);
      datos.set('image', b, 'foto');
      datos.set('width', w);
      datos.set('height', h);
      const { project } = await (await enviar('/api/images', 'POST', datos)).json();
      recargar(project);
    } catch (err) {
      estado.textContent = `no se ha subido: ${err.message}`;
      boton.disabled = false;
    }
  });
});

// avisa si el nombre es de un proyecto que ya existe (la foto se le añadirá; sin mirar mayúsculas)
const existe = nueva?.querySelector('.existe');
const limpio = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
nueva?.title.addEventListener('input', () => {
  const t = limpio(nueva.title.value);
  existe.hidden = ![...document.querySelectorAll('#titulos option')].some((o) => limpio(o.value) === t);
});

// corregir un proyecto (nombre, tags) o la fecha de una foto: «guardar» se enciende al cambiar algo
for (const [sel, ruta] of [['form.proyecto', 'projects'], ['form.foto', 'images']]) {
  document.querySelectorAll(sel).forEach((f) => {
    const boton = f.querySelector('button:not(.borrar)');
    f.addEventListener('input', () => { boton.disabled = false; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      boton.disabled = true;
      try {
        await enviar(`/api/${ruta}/${f.dataset.id}`, 'PATCH', new FormData(f));
        recargar(f.closest('details').id.slice(1));   // la línea de arriba (y el orden) cambian
      } catch (err) {
        boton.disabled = false;
        alert(`no se ha guardado: ${err.message}`);
      }
    });
  });
}

// el orden de la web (y de esta lista): se guarda en el servidor y se recarga
document.querySelectorAll('[data-orden]').forEach((b) => b.addEventListener('click', async () => {
  if (b.getAttribute('aria-pressed') === 'true') return;
  const datos = new FormData();
  datos.set('order', b.dataset.orden);
  try {
    await enviar('/api/settings', 'PATCH', datos);
    location.reload();
  } catch (err) { alert(`no se ha cambiado el orden: ${err.message}`); }
}));

const lista = document.querySelector('.proyectos');

// buscar: deja solo los proyectos cuyo nombre o tags lo contienen (sin mirar acentos)
const plano = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
document.querySelector('.buscar')?.addEventListener('input', (e) => {
  const q = plano(e.target.value.trim());
  for (const li of lista.children) li.hidden = !!q && !plano(`${li.dataset.title} ${li.querySelector('[name=tags]').value}`).includes(q);
});

document.querySelectorAll('.borrar-proyecto').forEach((b) => b.addEventListener('click', async () => {
  const nombre = b.closest('li').dataset.title, n = Number(b.dataset.n);
  if (!confirm(`¿Borrar «${nombre}» entero (${n === 1 ? 'su foto' : `sus ${n} fotos`})? Deja de salir en la web (se puede recuperar pidiéndolo).`)) return;
  try {
    await enviar(`/api/projects/${b.dataset.id}`, 'DELETE');
    recargar();
  } catch (err) { alert(`no se ha borrado: ${err.message}`); }
}));

document.querySelectorAll('.borrar').forEach((b) => b.addEventListener('click', async () => {
  const ultima = b.closest('.fotos').querySelectorAll('form.foto').length === 1;
  if (!confirm(`¿Borrar esta foto?${ultima ? ' Es la única del proyecto: el proyecto también deja de salir.' : ''} Se puede recuperar pidiéndolo.`)) return;
  try {
    await enviar(`/api/images/${b.closest('form').dataset.id}`, 'DELETE');
    recargar(b.closest('details').id.slice(1));
  } catch (err) { alert(`no se ha borrado: ${err.message}`); }
}));
