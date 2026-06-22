# Chekeo Phase 2.2B Polish

## Scope

Correcciones funcionales y UX dirigidas para `internal-chekeo-v2`, sin rediseño completo ni cambios productivos.

## Cambios

- Cocina: se redujo a tres vistas (`Preparación`, `Side Quest`, `Resumen K`), se quitó `Listos` y `Siguiente en cocina`, y cada tarjeta de producción deja una acción principal `Hecha`.
- Pedidos: ticket/WhatsApp queda con copy oficial único, sin selector de plantillas, sin rareza/power/origen y sin botón de compartir imagen.
- Navegación: el botón Atrás cierra primero modales/hojas internas, luego vuelve de submódulo Admin a hub y de pestañas a Home.
- Pagos: tarjetas con sólo `Marcar pagado` y `Más`; copiar WhatsApp, abrir WhatsApp, ver detalle y regresar a pendiente quedan dentro de `Más` o el modal.
- Sorteos: módulos separados en `Campaña`, `Participantes`, `Tickets extra`, `Referidos`, `Assets`, `Ajustes`; `+ tickets` abre una hoja compacta desde la lista.
- Home: se quitó la tira duplicada de comandos y se dejaron métricas accionables de operación.

## Capturas

Guardadas en `docs/assets/chekeo-phase-2-2b-polish/`.

| Vista | Archivo |
| --- | --- |
| Home desktop | `home-desktop.png` |
| Cocina desktop | `cocina-desktop.png` |
| Pedido/ticket desktop | `pedidos-ticket-desktop.png` |
| Pagos desktop | `pagos-desktop.png` |
| Sorteos mobile | `sorteos-mobile.png` |

Nota: se inspeccionó la URL pública `https://burgers-exe-internal-v2-preview.pages.dev/` con PIN `0485`. Como ese deploy todavía no contiene este branch, las capturas finales se tomaron contra `vite preview` local del build interno con mocks ligeros de auth.

## Validación

- `graphify query "Preview-fase2 apps/internal-chekeo-v2 InternalChekeoApp ticket WhatsApp modal back navigation payments raffles kitchen"`
- `npm run typecheck`
- `APP_TARGET=internal npm run build:internal`
- `npx playwright test --config=playwright.internal-kitchen.config.ts`
- Revisión visual Playwright: preview público con PIN `0485` y preview local del branch.
