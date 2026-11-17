# pepe, para Claude

El archivo de pepe, hecho por meowrhino con la receta del estudio
([meowrhino/JAMstack](https://github.com/meowrhino/JAMstack), patrones §10b, «la web entera
así»). Se habla en castellano. Cómo está hecha: [README.md](README.md); lo que hace pepe:
[GUIA.md](GUIA.md).

Aquí no hay build: la web la pinta un Worker (`worker/index.mjs`, con las plantillas de
`worker/paginas.mjs`) desde D1 y R2, y pepe sube y corrige todo desde `/admin/`. Lo único que
corre en GitHub es la copia del domingo.

## Si la copia del domingo falla

La web no se entera: sigue igual. Lo que falta es la copia en el repo.

1. **El error**: la Action abre un issue con la etiqueta `copia` y las últimas líneas dentro:
   `gh issue list --label copia` y `gh issue view <n>`. El registro entero: `gh run list
   --workflow=copia.yml -L 3` y `gh run view <id> --log-failed`.
2. **Reprodúcelo aquí**: `node tools/copia.mjs`. Lee lo mismo que en GitHub (la `url` de
   `data/site.json`, o la de workers.dev si no hay) y dice lo mismo.
3. **Casi siempre es la web, no la copia**:
   - «/api/archive: 5xx» o «fetch failed»: la web estaba caída o el dominio ha cambiado.
     Mira la web en el navegador y, si cambió el dominio, la `url` de `data/site.json`.
   - «la web no ha dado ningún proyecto: no toco la copia»: la lista vino vacía. Puede ser un
     fallo de D1 o que pepe lo ha borrado todo; pregúntale antes de tocar nada.
   - «/media/…: 404»: una foto que la lista dice que está y R2 no tiene. Mira en Cloudflare
     → R2 → `pepe-archive`.
   - Un fallo en `git push`: alguien subió algo a la vez; vuelve a lanzarla (*Run workflow*).
4. **Comprueba**: `node tools/copia.mjs` termina con «copia de …: N proyectos, N fotos».

No edites `data/archive.json` ni `assets/img/archive/` a mano: los rehace la copia. No
borres fotos ni proyectos. Cuando la copia vuelve a ir, la Action cierra el issue sola.

## Si la web falla

Los errores del Worker, en Cloudflare → Workers → pepe → Logs (`observability` está
encendido). En local: `npm run dev` con `.dev.vars` (`PASSWORD=…`) y `npm test` (las
plantillas, sin Cloudflare). Publicar: `npm run deploy`, solo cuando lo pida manu.

Commit y push solo cuando te lo pidan: mensaje en castellano diciendo qué se arregla.
