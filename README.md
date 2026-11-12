# pepe

El archivo de pepe (pepe.work): una lista de proyectos, cada uno con sus tags y una fecha
por foto. La foto sale al pasar por la fecha (al lado del cursor) y en grande al hacer
clic o tocarla en el móvil.

Es el patrón de **lasadcum** (JAMstack, `patrones.md` §10b) llevado a toda la web:

- **Un Worker** (`worker/index.mjs`) pinta la portada con el archivo dentro (se lee sin JS),
  `/admin/`, `/api/*` y `/media/*`. Lo estático, de `public/`.
- **Los textos en D1** (`projects`, `images`; las tablas se crean solas) y **las fotos en R2**
  (`pepe-archive`, `<año>/<uuid>.webp`). Nada del archivo pasa por GitHub.
- **`/admin/`** con contraseña (secreto `PASSWORD`): la foto se comprime en el navegador
  (imgToWeb: webp ≤ 2000 px, q85), pepe pone el proyecto, la fecha y los tags. Si el proyecto
  ya existe, la foto se le añade.
- `data/site.json`: el título y la intro (`intro`, una lista de párrafos). Mientras esté
  vacía, el bloque «pepe» no sale. Sin `url`, `noindex`.
- `data/seed.json`: las 37 primeras fotos (RTF del 6 de noviembre de 2026), emparejadas por
  orden con los archivos. Se suben con `tools/seed.mjs` por la misma API que `/admin/`.

Para pepe: **[GUIA.md](GUIA.md)**.

## Trabajar en local

```bash
npm install                      # sharp, solo para tools/seed.mjs
echo "PASSWORD=algo" > .dev.vars
npm run dev                      # http://localhost:8787, D1 y R2 locales en .wrangler/
node tools/seed.mjs http://localhost:8787 ~/Desktop/"PEPE FILES"
npm test
```

## Publicar

`npm run deploy`. La primera vez en una cuenta nueva:

1. `npx wrangler@4 r2 bucket create pepe-archive` (R2 tiene que estar activado).
2. `npx wrangler@4 deploy` (crea la D1 `pepe-archive` sola).
3. `npx wrangler@4 secret put PASSWORD`.
4. `node tools/seed.mjs https://<la web> <carpeta con las fotos>` (para si ya hay algo).

Ahora está en la cuenta de manu: https://pepe.manuellatourf.workers.dev. **Traspaso** a la de
pepe: pasar D1 (`wrangler d1 export` → `d1 execute --file`) y las fotos de R2, volver a poner
`PASSWORD` y conectar pepe.work en *Workers → pepe → Domains & Routes*. Al tener dominio,
`url` en `data/site.json` (quita el `noindex`).
