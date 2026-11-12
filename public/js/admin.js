// /admin/: subir fotos y corregir nombres, tags y fechas (el Worker, worker/index.mjs).
// La foto se pasa en el navegador a webp ≤ 2000 px, q85, con lo de imgToWeb
// (copiado de lasadcum, js/admin.js): HEIC con heic2any y TIFF con UTIF, que se
// cargan solo si hacen falta. Safari no sabe hacer webp (ni en iPhone): ahí sale
// jpg, que el Worker también acepta.
const nueva = document.querySelector('form.nueva');
const estado = nueva?.querySelector('.estado');

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
  if (b?.type !== 'image/webp') b = await blob('image/jpeg');
  if (!b) throw new Error('el navegador no ha podido hacer la imagen');
  return { b, w: c.width, h: c.height };
}

async function enviar(url, method, body) {
  const r = await fetch(url, { method, body });
  if (!r.ok) throw new Error(await r.text());
  return r;
}

nueva?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = nueva.querySelector('button');
  boton.disabled = true;
  estado.textContent = 'subiendo…';
  try {
    const datos = new FormData(nueva);
    const { b, w, h } = await comprimir(nueva.image.files[0]);
    datos.set('image', b, 'foto');
    datos.set('width', w);
    datos.set('height', h);
    await enviar('/api/images', 'POST', datos);
    location.reload();
  } catch (err) {
    estado.textContent = `no se ha subido: ${err.message}`;
    boton.disabled = false;
  }
});

// la foto elegida, en pequeño, antes de publicar
const previa = nueva?.querySelector('.previa');
nueva?.image.addEventListener('change', () => {
  const file = nueva.image.files[0];
  if (previa.src) URL.revokeObjectURL(previa.src);
  previa.hidden = !file;
  if (file) previa.src = URL.createObjectURL(file);   // HEIC en Chrome no se ve aquí, pero se sube bien
});

// avisa si el nombre es de un proyecto que ya existe (la foto se le añadirá)
const existe = nueva?.querySelector('.existe');
const titulos = () => new Set([...document.querySelectorAll('#titulos option')].map((o) => o.value));
nueva?.title.addEventListener('input', () => { existe.hidden = !titulos().has(nueva.title.value.replace(/\s+/g, ' ').trim()); });

// corregir un proyecto (nombre, tags) o la fecha de una foto: «guardar» se enciende al cambiar algo
for (const [sel, ruta] of [['form.proyecto', 'projects'], ['form.foto', 'images']]) {
  document.querySelectorAll(sel).forEach((f) => {
    const boton = f.querySelector('button:not(.borrar)');
    f.addEventListener('input', () => { boton.disabled = false; boton.textContent = 'guardar'; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      boton.disabled = true;
      try {
        await enviar(`/api/${ruta}/${f.dataset.id}`, 'PATCH', new FormData(f));
        boton.textContent = 'guardado ✓';
        if (ruta === 'projects') f.closest('li').dataset.title = f.title.value;
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

document.querySelectorAll('.borrar').forEach((b) => b.addEventListener('click', async () => {
  if (!confirm('¿Borrar esta foto? Deja de salir en la web (se puede recuperar pidiéndolo).')) return;
  try {
    await enviar(`/api/images/${b.closest('form').dataset.id}`, 'DELETE');
    location.reload();
  } catch (err) { alert(`no se ha borrado: ${err.message}`); }
}));
