# Burgers.exe Environment Matrix

Nota Fase 3: esta matriz fue alineada con auditoria read-only de Wrangler el 2026-07-02. Los nombres de recursos existen, pero los bindings/secrets reales por Pages project deben confirmarse en Cloudflare Dashboard o por una auditoria read-only mas profunda antes de cualquier deploy o escritura.

Nota Fase 5: las superficies Cloudflare legacy quedaron en `legacy/cloudflare/`. Cualquier config bajo `legacy/cloudflare/public-order/wrangler.toml` es historica/riesgo live y no debe usarse para local, preview ni produccion sin aprobacion explicita.

## Reglas globales

- Preview y produccion nunca comparten escritura.
- Preview puede ser 1:1 en funciones, pero con D1 y R2 separados.
- Local nunca debe escribir a produccion por accidente.
- Cualquier configuracion que apunte a produccion debe tratarse como riesgo manual y requerir aprobacion.
- `BOG_INTERNAL_PIN` se documenta solo como nombre de secreto; nunca se guarda su valor.
- `ORDERS_V2_WRITE_ENABLED` debe revisarse por ambiente antes de aceptar pedidos publicos.

## Local public

- App: `apps/public-order-v2`
- Hostname/proyecto Cloudflare: local, sin proyecto Pages obligatorio
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- D1 esperado: local o `burgers-exe-menu-v2-preview` de forma explicita, nunca produccion por default
- R2 esperado: local mock o `burgers-exe-assets-v2-preview` de forma explicita, nunca produccion por default
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS` cuando se prueban Functions reales
- Secrets requeridos: ninguno para el flujo publico
- Escritura publica: desactivada por default; `ORDERS_V2_WRITE_ENABLED` solo para pruebas explicitas
- Que NO debe tener: PIN interno, escritura a D1 produccion, assets R2 produccion por default
- Riesgos: servir solo Vite sin Functions puede ocultar fallos de runtime real
- Checklist de validacion:
  - [ ] El build publico compila.
  - [ ] Si se usan Functions, los bindings locales estan claros.
  - [ ] No apunta a produccion por default.

Nota Fase 1: `.wrangler/`, `.dev.vars` y `wrangler.toml` deben mantenerse fuera del indice de Git. Si existen localmente, tratarlos como configuracion/artefactos locales y revisar manualmente antes de compartir.

## Local internal

- App: `apps/internal-chekeo-v2`
- Hostname/proyecto Cloudflare: local, sin proyecto Pages obligatorio
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- D1 esperado: local o `burgers-exe-menu-v2-preview` de forma explicita, nunca produccion por default
- R2 esperado: local mock o `burgers-exe-assets-v2-preview` de forma explicita, nunca produccion por default
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: `BOG_INTERNAL_PIN`
- Escritura interna: solo contra DB local/preview explicita, nunca produccion por default
- Que NO debe tener: escritura a produccion por default, mezcla de pedidos preview y prod
- Riesgos: correr solo frontend local sin Pages Functions puede dar falsos 404 o auth incompleta
- Checklist de validacion:
  - [ ] El build interno compila.
  - [ ] El auth interno usa solo `BOG_INTERNAL_PIN`.
  - [ ] No usa produccion por accidente.

Nota Fase 1: el runtime local con Pages Functions puede generar `.wrangler/`; esa carpeta no debe versionarse.

## Preview public

- App: `apps/public-order-v2`
- Hostname/proyecto Cloudflare: `burgers-exe-public-v2-preview`
- URL: `https://burgers-exe-public-v2-preview.pages.dev`
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- D1 esperado: `burgers-exe-menu-v2-preview`
- R2 esperado: `burgers-exe-assets-v2-preview`
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: ninguno para flujo publico
- Escritura publica: `ORDERS_V2_WRITE_ENABLED` explicito por ambiente; nunca asumir valor productivo
- Que NO debe tener: PIN interno, D1 produccion, R2 produccion, mezcla con pedidos reales
- Riesgos: si comparte bindings con produccion, contaminar pedidos y catalogo real
- Checklist de validacion:
  - [ ] Confirmar proyecto Pages correcto.
  - [ ] Confirmar D1 preview separado.
  - [ ] Confirmar R2 preview separado.
  - [ ] Confirmar que los pedidos de prueba no llegan a produccion.

## Preview internal

- App: `apps/internal-chekeo-v2`
- Hostname/proyecto Cloudflare: `burgers-exe-internal-v2-preview`
- URL: `https://burgers-exe-internal-v2-preview.pages.dev`
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- D1 esperado: `burgers-exe-menu-v2-preview`
- R2 esperado: `burgers-exe-assets-v2-preview`
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: `BOG_INTERNAL_PIN`
- Escritura interna: solo contra recursos preview
- Que NO debe tener: datos reales de produccion, acceso cruzado a pedidos productivos, bindings live por error
- Riesgos: operar pedidos reales desde un host preview o confundir visualmente el ambiente
- Checklist de validacion:
  - [ ] El ambiente se muestra claramente como PREVIEW.
  - [ ] Usa D1 preview separado.
  - [ ] Usa R2 preview separado.
  - [ ] No opera pedidos de produccion.

## Production public

- App: `apps/public-order-v2`
- Hostname/proyecto Cloudflare: `burgers-exe`
- URL: `https://burgers-exe.pages.dev`
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- D1 esperado: `burgers-exe-menu-live`
- R2 esperado: `burgers-exe-menu-assets`
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: ninguno para el flujo publico
- Escritura publica: `ORDERS_V2_WRITE_ENABLED=true` solo cuando produccion debe aceptar pedidos
- Que NO debe tener: PIN interno, bindings preview, pedidos de prueba, listas de testing mezcladas
- Riesgos: cualquier mezcla con preview rompe integridad operativa y reportes
- Checklist de validacion:
  - [ ] Proyecto Pages correcto.
  - [ ] D1 live correcto.
  - [ ] R2 live correcto.
  - [ ] No existen rutas o flags de testing activas.

## Production internal

- App: `apps/internal-chekeo-v2`
- Hostname/proyecto Cloudflare: `chekeo2-0`
- URL: `https://chekeo2-0.pages.dev`
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- D1 esperado: `burgers-exe-menu-live`
- R2 esperado: `burgers-exe-menu-assets`
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: `BOG_INTERNAL_PIN`
- Escritura interna: acciones internas reales contra D1 produccion despues de auth
- Que NO debe tener: bindings preview, auth alterna, mezcla de pedidos de prueba con pedidos reales
- Riesgos: cualquier error de binding o auth impacta operacion real
- Checklist de validacion:
  - [ ] Proyecto Pages correcto.
  - [ ] D1 live correcto.
  - [ ] R2 live correcto.
  - [ ] `BOG_INTERNAL_PIN` esta configurado.
  - [ ] No opera listas o pedidos preview.

## Separacion obligatoria preview vs produccion

- Preview y produccion nunca comparten escritura.
- Preview puede reflejar las mismas funciones, pero con recursos separados.
- Los pedidos de prueba viven en D1 preview.
- Cualquier copia de datos de produccion a preview debe ser explicita, segura y sin mezclar IDs ni secrets.
- La auditoria detallada vive en `docs/codex-memory/13-cloudflare-environments-audit.md`.
