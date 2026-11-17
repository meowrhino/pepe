# Guía: cómo se actualiza el archivo de pepe

> **La regla de oro**: todo se hace desde **superpepe**, en `/admin/` (pepe.work/admin/), con la
> contraseña, desde el ordenador o desde el móvil. No hay que tocar ningún archivo.
> Lo que publicas sale **al momento**.

---

## 1. Subir una foto

Entra en `pepe.work/admin` con la contraseña (la sesión dura 60 días en ese navegador).

**A un proyecto nuevo** (el botón de arriba, **+ proyecto nuevo**, que se abre):

1. **+ foto**: elige una de la galería o hazla en el momento (en el móvil te deja elegir).
   Sale en pequeño para que veas que es la buena. Puede ser jpg, png, HEIC del iPhone o
   tiff: la web la reduce sola (máx. 2000 px).
2. **nombre**: tal como quieres que salga en la lista.
3. **fecha**: la que tú decidas que es la de esa foto (no la de hoy por fuerza).
4. **tags** (opcional): separados por espacios, con o sin `#`: `#paperwork #proyecto`.
   Salen en minúsculas y sin repetir.
5. **publicar**. La página se recarga con ese proyecto abierto y la foto ya está en la web.

Si escribes el nombre de un proyecto que **ya existe**, debajo pone «ese proyecto ya existe»
y la foto se le añade a ese (sin mirar mayúsculas).

**A un proyecto que ya está**: tócalo en la lista para abrirlo, **+ añadir foto** → elige la foto → pon la
fecha → **subir**. Sale al lado de las otras, y en la web, `2025.01.08 / 2025.04.02`.

## 2. Corregir y borrar

Debajo, la lista de proyectos igual que en la web (nombre · tags · fechas) y en su orden.
Toca uno para abrirlo: sale en un recuadro con sus fotos y todo lo de cambiar; tócalo otra
vez para cerrarlo. Con **buscar** dejas solo los que tienen esa palabra en el nombre o en
los tags.

| qué | dónde | luego |
|---|---|---|
| el nombre de un proyecto | arriba, **nombre** | **guardar** (al lado) |
| sus tags | **tags** (sin `#`, separados por espacios) | **guardar** |
| la fecha de una foto | la fecha debajo de la foto | **guardar** (debajo) |
| quitar una foto | **borrar**, debajo de la foto | pide confirmación |
| quitar un proyecto entero | **borrar proyecto**, abajo | pide confirmación |

**guardar** se enciende cuando cambias algo; al guardarlo, la página se recarga con el
proyecto abierto y el cambio ya está en la lista y en la web. Dos
proyectos no pueden llamarse igual: si lo intentas, te lo dice.

**Cómo funciona borrar**:
- Un proyecto existe mientras tenga alguna foto. Si le borras la última, deja de salir
  (te avisa antes).
- **borrar proyecto** borra todas sus fotos de golpe: es lo mismo.
- **Nada se borra para siempre**: deja de salir en la web, pero se guarda. Si te equivocas,
  pídenoslo y lo recuperamos. Si luego subes una foto con el nombre de un proyecto borrado,
  vuelve con esa foto sola (y sus tags).

## 3. El orden

En superpepe, encima de la lista: **orden de la web**. Lo que elijas cambia la web y la
lista de superpepe a la vez:

| orden | cómo |
|---|---|
| **más reciente** (el de siempre) | arriba, el proyecto con la foto más nueva. Si añades una foto a un proyecto viejo, sube arriba |
| **más antiguo** | arriba, el proyecto con la foto más vieja |
| **a–z** | por el nombre |

Dentro de un proyecto, sus fechas van siempre de la más antigua a la más nueva.

No hay orden a mano: si quieres que un proyecto salga más arriba o más abajo, cámbiale la
fecha a sus fotos.

## 4. Si algo sale mal

- **«no se ha subido: …»**: el mensaje dice qué falta (el nombre, la fecha, la foto…).
  Rellénalo y vuelve a darle.
- **«hay que entrar con la contraseña»**: la sesión ha caducado. Vuelve a `pepe.work/admin`.
- **La contraseña no entra**: mira que no haya un espacio de más. Tras diez intentos
  fallidos, espera un minuto.
- Cualquier otra cosa: haz una captura y pásanosla.

## 5. Una copia de todo

**Cada domingo, todo lo que sale en la web se copia a tu GitHub**, solo: los nombres, tags
y fechas en `data/archive.json`, y las fotos en `assets/img/archive/`. No tienes que hacer
nada. Si quieres la copia al momento: en GitHub, *Actions* → «copia del archivo» →
*Run workflow*.

**La copia no se edita**: va de la web a GitHub, no al revés. Si cambias `archive.json` o
pones una foto en `assets/img/archive/`, no sale en la web, y el domingo siguiente se
rehace y se pierde. Para subir o corregir algo, siempre superpepe.

Lo borrado sale de la copia, pero no se pierde: `/api/export` (con la sesión abierta) baja
un archivo con todo, también lo borrado, y las fotos siguen en Cloudflare → R2 →
`pepe-archive`.
