# Burgers.exe Environment Matrix

## Reglas globales

- Preview y produccion nunca comparten escritura.
- Preview puede ser 1:1 en funciones, pero con D1 y R2 separados.
- Local nunca debe escribir a produccion por accidente.
- Cualquier configuracion que apunte a produccion debe tratarse como riesgo manual y requerir aprobacion.

## Local public

- App: `apps/public-order-v2`
- Hostname/proyecto Cloudflare: local, sin proyecto Pages obligatorio
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- D1 esperado: local o preview explicita, nunca produccion por default
- R2 esperado: local mock o preview explicita, nunca produccion por default
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS` cuando se prueban Functions reales
- Secrets requeridos: ninguno para el flujo publico
- Que NO debe tener: PIN interno, escritura a D1 produccion, assets R2 produccion por default
- Riesgos: servir solo Vite sin Functions puede ocultar fallos de runtime real
- Checklist de validacion:
  - [ ] El build publico compila.
  - [ ] Si se usan Functions, los bindings locales estan claros.
  - [ ] No apunta a produccion por default.

## Local internal

- App: `apps/internal-chekeo-v2`
- Hostname/proyecto Cloudflare: local, sin proyecto Pages obligatorio
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- D1 esperado: local o preview explicita, nunca produccion por default
- R2 esperado: local mock o preview explicita, nunca produccion por default
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: `BOG_INTERNAL_PIN`
- Que NO debe tener: escritura a produccion por default, mezcla de pedidos preview y prod
- Riesgos: correr solo frontend local sin Pages Functions puede dar falsos 404 o auth incompleta
- Checklist de validacion:
  - [ ] El build interno compila.
  - [ ] El auth interno usa solo `BOG_INTERNAL_PIN`.
  - [ ] No usa produccion por accidente.

## Preview public

- App: `apps/public-order-v2`
- Hostname/proyecto Cloudflare: `burgers-exe-public-v2-preview`
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- D1 esperado: D1 preview separado
- R2 esperado: R2 preview separado
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: ninguno para flujo publico
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
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- D1 esperado: el mismo D1 preview del public preview
- R2 esperado: el mismo R2 preview del public preview
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: `BOG_INTERNAL_PIN`
- Que NO debe tener: datos reales de produccion, accesso cruzado a pedidos productivos, bindings live por error
- Riesgos: operar pedidos reales desde un host preview o confundir visualmente el ambiente
- Checklist de validacion:
  - [ ] El ambiente se muestra claramente como PREVIEW.
  - [ ] Usa D1 preview separado.
  - [ ] Usa R2 preview separado.
  - [ ] No opera pedidos de produccion.

## Production public

- App: `apps/public-order-v2`
- Hostname/proyecto Cloudflare: `burgers-exe.pages.dev`
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- D1 esperado: D1 produccion
- R2 esperado: R2 produccion
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: ninguno para el flujo publico
- Que NO debe tener: PIN interno, bindings preview, pedidos de prueba, listas de testing mezcladas
- Riesgos: cualquier mezcla con preview rompe integridad operativa y reportes
- Checklist de validacion:
  - [ ] Proyecto Pages correcto.
  - [ ] D1 live correcto.
  - [ ] R2 live correcto.
  - [ ] No existen rutas o flags de testing activas.

## Production internal

- App: `apps/internal-chekeo-v2`
- Hostname/proyecto Cloudflare: `chekeo2-0.pages.dev`
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- D1 esperado: D1 produccion
- R2 esperado: R2 produccion
- Bindings requeridos: `BOG_MENU_DB`, `BOG_MENU_ASSETS`
- Secrets requeridos: `BOG_INTERNAL_PIN`
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
