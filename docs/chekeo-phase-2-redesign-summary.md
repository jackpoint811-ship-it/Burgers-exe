# Fase 2 - Rediseño UX/UI Chekeo Burgers.exe

Fecha: 2026-06-21
Rama: `feature/chekeo-phase-2-control-room-redesign`

## Alcance

Se rediseñó `apps/internal-chekeo-v2` como una consola operativa dark "Control Room": menos pantallas duplicadas, más densidad útil, navegación por prioridad operativa y estados vacíos compactos. No se cambiaron endpoints, contratos de API, autenticación por PIN, ni origen de datos.

## Cambios principales

- Shell: header compacto con marca Bx, entorno, fuente de datos, sesión, refresh, link público y salida.
- Navegación: `Home` pasó a `Operación`; tabs principales quedan como `Operación`, `Pedidos`, `Cocina`, `Pagos`, `Admin`.
- Operación: tablero de prioridad con métricas, comandos directos, siguiente acción y Mini Resumen K.
- Pedidos: cola compacta con filtros en drawer, estado vacío único y panel de detalle rápido para acciones principales.
- Cocina: vista abre con "Siguiente en cocina" y preparación por item; el Resumen K queda como subvista secundaria.
- Pagos: bandeja enfocada en cobros pendientes, sin tarjetas de cero cuando no hay datos.
- Admin: hub de módulos secundarios; los submódulos usan "Volver al hub" y selector compacto en lugar de repetir una botonera completa.
- Catálogo: tarjetas largas se convirtieron en filas densas; assets/datos técnicos quedan colapsados.
- Sorteos: submódulos `Campaña`, `Participantes`, `Referidos`, `Assets`, `Ajustes`; se agregó fallback visible para imágenes rotas y avisos de ajustes manuales junto al formulario.
- Cierre: estados y métricas sólo aparecen cuando hay datos reales en el rango.

## Evidencia visual

Antes: `docs/assets/chekeo-phase-1-audit/`

Después: `docs/assets/chekeo-phase-2-redesign/`

Capturas generadas:

- `login-mobile-390.png`
- `operacion-mobile-390.png`
- `pedidos-mobile-320.png`
- `pedidos-mobile-390.png`
- `pedidos-mobile-430.png`
- `pedidos-desktop.png`
- `cocina-mobile-390.png`
- `pagos-mobile-390.png`
- `admin-mobile-390.png`
- `catalogo-mobile-390.png`
- `sorteos-mobile-390.png`
- `corte-mobile-390.png`
- `desktop-general.png`
- `redesign-metadata.json`

La metadata reporta 13 capturas, `horizontalOverflow: false` en todas, sin offenders fuera de viewport y sin errores/warnings de consola.

## Validación real

- Capturas tomadas con frontend local `http://127.0.0.1:5174/`.
- Todas las rutas `/api/**` se proxyearon a `https://burgers-exe-internal-v2-preview.pages.dev`.
- PIN usado en la validación: `BOG_INTERNAL_PIN`.
- Primer acceso de capturas autenticó con PIN; las capturas posteriores reutilizaron la sesión preview del mismo contexto de API.
- No se creó servidor falso ni se inyectaron datos falsos para las capturas.

## Herramientas y fuentes usadas

- Graphify: consultas iniciales sobre `InternalChekeoApp`, `OrdersBoard`, `KitchenQueue`, `PaymentNotesPanel`, `AdminWorkspace`.
- UI UX Pro Max: búsqueda de patrones para dashboard operativo dark, mobile-first y accesibilidad.
- Design Taste Frontend: aplicado como filtro de calidad visual; no se usó para convertir la app en landing.
- Playwright: pruebas internas y capturas visuales.
- Open Design: intentado, pero el daemon local no respondió en `http://127.0.0.1:7456`.

No se instalaron dependencias nuevas.

## Checks

- `npm run typecheck` - pasa.
- `APP_TARGET=internal npm run build:internal` - pasa; Vite mantiene warning de chunk JS > 500 kB.
- `npx playwright test --config=playwright.internal-kitchen.config.ts` - 7 passed, 1 skipped (`admin-only` sólo corre con `VITE_INTERNAL_AUTH_MODE`).

## Riesgos y Fase 3

- El bundle interno sigue sobre 500 kB minificado; conviene evaluar code-splitting por módulos Admin/Catálogo/Sorteos.
- Preview real estaba sin pedidos/pagos activos durante las capturas; las pruebas Playwright cubren estados con datos mediante mocks de test, pero la evidencia visual real muestra principalmente estados vacíos.
- Admin todavía concentra módulos con mucha longitud vertical; Fase 3 puede profundizar en edición por drawer/modal y permisos granulares.
- El badge visual muestra `LOCAL` porque el frontend se ejecutó localmente para capturas; los datos y acciones fueron contra D1 preview.
