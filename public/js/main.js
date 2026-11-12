// La foto de cada fecha. Sin JS, la fecha es un enlace a la foto.
// Con ratón: al pasar por encima sale a un lado. Al hacer clic (o tocar en el
// móvil), sale en grande, y otro clic (o Esc) la cierra.
const fig = document.querySelector('.preview');
const img = fig?.querySelector('img');
let activa = null;

function ver(a, fija) {
  activa?.classList.remove('activa');
  activa = a;
  a.classList.add('activa');
  img.src = a.href;
  img.alt = a.dataset.alt || '';
  img.width = a.dataset.w;
  img.height = a.dataset.h;
  fig.classList.toggle('fija', fija);
  if (fija) fig.style.transform = '';
  fig.hidden = false;   // con width/height puestos, mide lo que medirá antes de cargar
}
// al pasar, a la derecha del cursor; si no cabe, a la izquierda. Y siempre dentro de la pantalla
function mover(e) {
  if (fig.hidden || fig.classList.contains('fija')) return;
  const { width: w, height: h } = fig.getBoundingClientRect();
  const x = e.clientX + 24 + w < innerWidth ? e.clientX + 24 : Math.max(0, e.clientX - 24 - w);
  const y = Math.min(Math.max(8, e.clientY - h / 2), innerHeight - h - 8);
  fig.style.transform = `translate(${x}px, ${y}px)`;
}
function cerrar() {
  fig.hidden = true;
  fig.style.transform = '';
  fig.classList.remove('fija');
  activa?.classList.remove('activa');
  activa = null;
}

if (fig) {
  const raton = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.archive .dates a').forEach((a) => {
    a.addEventListener('mouseenter', (e) => { if (raton.matches && !fig.classList.contains('fija')) { ver(a, false); mover(e); } });
    a.addEventListener('mousemove', mover);
    a.addEventListener('mouseleave', () => { if (!fig.classList.contains('fija')) cerrar(); });
    a.addEventListener('click', (e) => { e.preventDefault(); ver(a, true); });
  });
  fig.addEventListener('click', cerrar);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}
