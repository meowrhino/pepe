// /admin/: subir fotos y corregir nombres, tags y fechas (el Worker, worker/index.mjs).
// La foto se pasa en el navegador a webp ≤ 2000 px, q85, con el conversor de imgToWeb, que
// se carga de su web: aquí no hay copia, y lo que cambie en meowrhino/imgToWeb
// (js/converter.js) llega solo. Hace webp también en Safari y el iPhone (su códec en wasm);
// si ni eso carga, sale jpg.
const nueva = document.querySelector('form.nueva');
const IMGTOWEB = 'https://meowrhino.github.io/imgToWeb/js/converter.js';

async function comprimir(file) {
  const { convertToWebp } = await import(IMGTOWEB).catch(() => {
    throw new Error('no se ha podido cargar el conversor (imgToWeb); recarga la página');
  });
  const { blob, dimensions } = await convertToWebp(file, { quality: 0.85, maxDimension: 2000, jpegFallback: true });
  return { b: blob, w: dimensions.width, h: dimensions.height };
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
  if (!confirm(`¿Borrar «${nombre}» entero (${n === 1 ? 'su foto' : `sus ${n} fotos`})? Deja de salir en la web y va a la papelera, abajo del todo.`)) return;
  try {
    await enviar(`/api/projects/${b.dataset.id}`, 'DELETE');
    recargar();
  } catch (err) { alert(`no se ha borrado: ${err.message}`); }
}));

document.querySelectorAll('.borrar').forEach((b) => b.addEventListener('click', async () => {
  const ultima = b.closest('.fotos').querySelectorAll('form.foto').length === 1;
  if (!confirm(`¿Borrar esta foto?${ultima ? ' Es la única del proyecto: el proyecto también deja de salir.' : ''} Va a la papelera, abajo del todo.`)) return;
  try {
    await enviar(`/api/images/${b.closest('form').dataset.id}`, 'DELETE');
    recargar(b.closest('details').id.slice(1));
  } catch (err) { alert(`no se ha borrado: ${err.message}`); }
}));

// la papelera: «recuperar» deshace ese borrado (la foto, o el proyecto entero) y lo abre
document.querySelectorAll('.recuperar').forEach((b) => b.addEventListener('click', async () => {
  b.disabled = true;
  try {
    const { project } = await (await enviar(`/api/images/${b.dataset.id}/recuperar`, 'POST')).json();
    recargar(project);
  } catch (err) {
    b.disabled = false;
    alert(`no se ha recuperado: ${err.message}`);
  }
}));
