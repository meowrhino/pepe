# Guía: cómo se actualiza el archivo de pepe

> **La regla de oro**: todo se hace desde **superpepe**, en `/admin/` (pepe.work/admin/), con la
> contraseña, desde el ordenador o desde el móvil. No hay que tocar ningún archivo.
> Lo que publicas sale **al momento**.

---

## 1. Subir una foto

1. Entra en `/admin/` con la contraseña (la sesión dura 60 días en ese navegador).
2. **+ foto**: elige una de la galería o hazla en el momento (en el móvil te deja elegir).
   Sale en pequeño para que veas que es la buena.
   Puede ser jpg, png, HEIC del iPhone o tiff: la web la reduce sola (máx. 2000 px).
3. **proyecto**: el nombre, tal como quieres que salga en la lista.
   - Si el proyecto **ya existe**, al escribir te sale en una lista: elígelo y la foto se le
     **añade** (en la web: `2025.01.08 / 2025.04.02`) y debajo pone «ya existe». Tiene que
     estar escrito **igual**, letra a letra.
   - Si no existe, se crea uno nuevo.
4. **fecha**: la que tú decidas que es la de esa foto (no la de hoy por fuerza).
5. **tags** (opcional): separados por espacios, con o sin `#`: `#paperwork #proyecto`.
   Salen en minúsculas y sin repetir.
6. **publicar**. La página se recarga y la foto ya está en la web.

## 2. Corregir algo

Debajo del formulario están todos los proyectos, en el orden de la web. Con **buscar** dejas
solo los que tienen esa palabra en el nombre o en los tags.

| qué | dónde | luego |
|---|---|---|
| el nombre de un proyecto | su primera casilla | **guardar** (al lado) |
| sus tags | la segunda casilla (sin `#`, separados por espacios) | **guardar** |
| la fecha de una foto | la casilla de fecha debajo de la foto | **guardar** (debajo) |
| quitar una foto | **borrar**, debajo de la foto | se pide confirmación |

**guardar** se enciende cuando cambias algo; al guardarlo pone **guardado ✓**.
Un proyecto al que le borras todas sus fotos desaparece de la lista.

**Borrar no es para siempre**: la foto deja de salir, pero se guarda. Si te equivocas,
pídenoslo y la recuperamos.

## 3. El orden

En superpepe, encima de la lista: **orden de la web**. Lo que elijas cambia la web y la
lista de superpepe a la vez:

| orden | cómo |
|---|---|
| **más reciente** (el de siempre) | arriba, el proyecto con la foto más nueva. Si añades una foto a un proyecto viejo, sube arriba |
| **más antiguo** | arriba, el proyecto con la foto más vieja |
| **a–z** | por el nombre |

Dentro de un proyecto, sus fechas van siempre de la más antigua a la más nueva.

## 4. Si algo sale mal

- **«no se ha subido: …»**: el mensaje dice qué falta (el nombre, la fecha, la foto…).
  Rellénalo y vuelve a darle.
- **«hay que entrar con la contraseña»**: la sesión ha caducado. Vuelve a `/admin/`.
- **La contraseña no entra**: mira que no haya un espacio de más. Tras diez intentos
  fallidos, espera un minuto.
- Cualquier otra cosa: haz una captura y pásanosla.

## 5. Una copia de todo

`/api/export` (con la sesión abierta) baja un archivo con todos los nombres, tags, fechas y
la ruta de cada foto, también de las borradas. Las fotos en sí están en Cloudflare →
R2 → `pepe-archive`.
