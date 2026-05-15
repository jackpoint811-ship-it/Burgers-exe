# Cloudflare Internal Chekeo Migration — Phase 0 Audit

## 1. Objetivo
Migrar el panel interno **Chekeo** a una app independiente en **Cloudflare Pages** (futura ruta `cloudflare/internal-chekeo/`), separada del flujo público `cloudflare/public-order/`, manteniendo inicialmente **Google Sheets + Google Apps Script** como backend operativo.

Esta Fase 0 es exclusivamente de **auditoría y planeación**. No incluye implementación funcional.

## 2. Estado actual
- Stack actual: **Google Sheets + Google Apps Script Web App + frontend HTML/CSS/JS embebido** (`Index.html`, `styles.html`, `scripts.html`).
- La Web App se renderiza vía `doGet()` en `Code.gs` usando `Index` (`HtmlService.createTemplateFromFile('Index').evaluate()`).
- `doPost()` delega en `bogHandleJsonPost_()` y actualmente solo acepta `action === 'createPublicOrder'` (flujo Cloudflare público).
- `BOG_ACTIVE_ENV` controla el entorno activo (`TEST`/`PROD`) desde constantes del backend.
- `TEST` opera sobre hoja **Chekeo Nuevo**.
- `PROD` opera sobre hoja **Chekeo**.
- **No se debe cambiar `BOG_ACTIVE_ENV` durante esta migración sin autorización explícita.**

## 3. UI actual del panel interno (mapa desde `Index.html`)
- **Header**:
  - Branding Burger-OG.
  - Botón `Sincronizar` (`#syncButton`).
- **Toast global**: `#toast`.
- **Tabs principales**:
  - `Inicio`.
  - `Pedidos`.
  - `Cocina`.
  - `Otros`.
- **Bottom nav** (`.bottom-nav`) con botones para las 4 tabs.
- **Modal de detalle de pedido**: `#orderDetailModal`.
- **Modal de confirmación**: `#confirmModal`.
- **Secciones dentro de “Otros”**:
  - Cierre y Resumen.
  - Archivables.
  - No archivables.
  - Resumen diario operativo.
  - Histórico.
  - Sistema / Ajustes.
  - Diagnóstico avanzado.

## 4. Estado frontend actual (mapa desde `scripts.html`)
- **Estado global (`APP_STATE`)**:
  - `orders`, `summary`, `history`, `closePreview`, `health`.
  - estado de tabs/filtros (`activeTab`, `activeOrdersFilter`, `kitchenMode`, filtros de cocina).
  - estado de UI (`loading`, `detailOrderId`, `confirmAction`, `ticketCanvas`).
  - estado de diagnósticos/config (`bankConfig`, `bankConfigOk`, `productionValidation`, `migrationPreview`).
- **Filtros de pedidos**:
  - Chips por estado (incluye `all`, pendientes de pago, alertas y estados de pedido).
- **Filtros de cocina**:
  - Modo pedidos vs. guarniciones.
  - filtros por hamburguesa y por tipo de guarnición.
- **Estados de loading**:
  - Control granular por llave (`sync`, `write`, etc.) con bloqueo de acciones sensibles.
- **Flujo de `initApp()`**:
  1. Bind de eventos UI.
  2. Carga de `healthCheck`.
  3. Carga de resumen/cierre/histórico/configuración/diagnóstico.
  4. Carga de pedidos (`getAppOrders`) y render inicial.
- **Flujo de render**:
  - Render por tab: home quick summary, pedidos, cocina, cierre/resumen/histórico/diagnósticos.
- **Flujo de write actions**:
  - Acciones operativas con bloqueo de concurrencia y refresh de datos al completar.
- **Flujo de confirmación**:
  - Modal confirmatorio para acciones críticas (archivar/cerrar, entre otras).
- **Manejo toast/error**:
  - `showToast(...)` para feedback de éxito/error/info.
  - `renderError(...)` normaliza errores backend/frontend.

## 5. Dependencias `google.script.run`

| Área | Función frontend | Método Apps Script llamado | Tipo | Argumentos | Riesgo al migrar | Fase futura sugerida |
|---|---|---|---|---|---|---|
| Inicio/Sistema | `loadHealth_` | `healthCheck` | read | — | Arranque sin health válido | Fase 3 |
| Sync | `syncOrders` | `syncOrdersFromMaster` | write | — | Diferencias de locking/tiempos | Fase 5 |
| Pedidos | `loadOrders_` | `getAppOrders` | read | — | Contrato de lista/ordenamiento | Fase 3 |
| Pedidos detalle | (detalle/modal) | `getOrderDetail` | read | `orderId` | Divergencia de shape en detalle | Fase 4 |
| Ticket cliente | `sendClientTicket...` | `getClientTicketData` | read | `orderId` | Datos incompletos para ticket/WA | Fase 5 |
| Pedidos | `updateOrderStatus` | `updateOrderStatus` | write | `orderId`, `nextStatus` | Cambios de estado inconsistentes | Fase 5 |
| Pedidos | `updateOrderOperationalData` | `updateOrderOperationalData` | write | `orderId`, `payload` | Escrituras parciales/campos faltantes | Fase 5 |
| Pagos | (flujo pago) | `updateOrderPayment` | write | `orderId`, `paymentStatus`, `paymentMethod` | Desalineación reglas de pago | Fase 5 |
| Pagos | `markOrderPaid` | `markOrderPaid` | write | `orderId` | Atajo de pago sin validaciones equivalentes | Fase 5 |
| Cocina | `markOrderSideReady` | `markOrderSideReady` | write | `orderId` | Estado cocina no sincronizado UI/backend | Fase 5 |
| Pedidos | `updateOrderNotes` | `updateOrderNotes` | write | `orderId`, `noteInternal`, `noteClient` | Pérdida de notas por contrato | Fase 5 |
| Ticket | `markTicketSent` | `markTicketSent` | write | `orderId` | Marcado enviado sin trazabilidad | Fase 5 |
| Otros/Resumen | `loadSummary_` | `getDailySummary` | read | — | Cálculos distintos en RPC | Fase 3 |
| Otros/Ajustes | `loadBankConfig_` | `getBankConfig` | read | — | Validación bancaria inconsistente | Fase 3 |
| Otros/Cierre | `loadClosePreview_` | `getCloseDayPreview` | read | — | Preview incorrecto previo a cierre | Fase 3 |
| Otros/Cierre | `writeDailySummary` | `writeDailySummary` | write | — | Doble escritura de corte | Fase 6 |
| Otros/Cierre | `archiveCompletedOrders` | `archiveCompletedOrders` | write | — | Archivado irreversible no controlado | Fase 6 |
| Otros/Cierre | `closeDay` | `closeDay` | write | — | Operación compuesta de alto riesgo | Fase 6 |
| Otros/Histórico | `loadHistoryPreview_` | `getHistoryPreview` | read | — | Resumen histórico inconsistente | Fase 3/4 |
| Diagnóstico | `loadProductionValidation_` | `validateProductionReadiness` | read | — | Señales de readiness no equivalentes | Fase 6 |
| Diagnóstico | `loadMigrationPreview_` | `getProductionMigrationPreview` | read | — | Preview migración ambiguo | Fase 6 |
| Diagnóstico | `prepareProductionSheets` | `prepareProductionSheets` | write | — | Alteraciones de estructura por error | Fase 6 (controlado) |
| Histórico | (consulta histórico) | `getHistoryOrders` | read | `limit` | Paginación/volumen diferente | Fase 6 |

## 6. Backend actual (mapa desde `Code.gs`)
- Entrada Web App:
  - `doGet`: render HTML del panel (`Index`) y endpoint `?format=json` para health.
  - `doPost`: delega a `bogHandleJsonPost_`.
  - `bogHandleJsonPost_`: hoy solo procesa `createPublicOrder` (Cloudflare público).
- Lecturas:
  - `healthCheck`
  - `getAppOrders`
  - `getOrderDetail`
  - `getClientTicketData`
  - `getDailySummary`
  - `getBankConfig`
  - `getCloseDayPreview`
  - `getHistoryPreview`
  - `validateProductionReadiness`
  - `getProductionMigrationPreview`
  - `getHistoryOrders`
- Escrituras:
  - `syncOrdersFromMaster`
  - `updateOrderStatus`
  - `updateOrderOperationalData`
  - `updateOrderPayment`
  - `markOrderPaid`
  - `markOrderSideReady`
  - `updateOrderNotes`
  - `markTicketSent`
  - `writeDailySummary`
  - `archiveCompletedOrders`
  - `closeDay`
  - `prepareProductionSheets`
- Wrappers transversales:
  - `bogPublicRead_` (envoltura de lectura con envelope `{ok,data,message}`).
  - `bogPublicWrite_` (envoltura con `LockService` para escritura segura).

## 7. Public order boundary
- `cloudflare/public-order/` **ya existe** y opera el flujo público.
- No se debe mezclar con `internal-chekeo`.
- `public-order` debe permanecer **intacto** durante todas las fases de esta migración.
- `internal-chekeo` debe construirse como app separada e independiente.

## 8. Propuesta de arquitectura futura
Arquitectura objetivo (fases futuras):

**Cloudflare Pages `internal-chekeo`**  
→ **PIN/session**  
→ **`/api/rpc`**  
→ **Apps Script `internalApi`**  
→ **Google Sheets**

Aclaraciones de seguridad/alcance:
- No se usará Cloudflare Access en este alcance.
- Sí se usará PIN interno (fase futura).
- Sesión por cookie `HttpOnly` + `Secure` + `SameSite=Lax` (fase futura).
- Secret server-to-server entre Cloudflare y Apps Script.
- Nunca exponer secrets al frontend.

## 9. Plan por fases

### Fase 0 — Auditoría y plan
- Entregable: solo este documento.

### Fase 1 — Scaffold Cloudflare interno
- Crear `cloudflare/internal-chekeo` básico (estático).
- Sin API.
- Sin PIN.
- Sin tocar Apps Script.

### Fase 2 — PIN/session aislado
- Agregar auth por PIN en Cloudflare.
- Endpoints: `/api/auth`, `/api/session`, `/api/logout`.
- Sin conectar datos reales.

### Fase 3 — RPC read-only mínimo
- Agregar `/api/rpc`.
- Agregar Apps Script `internalApi`.
- Solo métodos read-only:
  - `healthCheck`
  - `getAppOrders`
  - `getDailySummary`
  - `getBankConfig`

### Fase 4 — Panel read-only
- Migrar UI de Inicio/Pedidos/Cocina/Otros en modo lectura.
- Sin acciones write.

### Fase 5 — Acciones operativas
- Estados de pedido.
- Pago.
- Notas.
- Ticket.
- WhatsApp.
- Cocina.

### Fase 6 — Cierre, resumen e histórico
- `writeDailySummary`.
- `archiveCompletedOrders`.
- `closeDay`.
- Histórico.
- Diagnósticos.

### Fase 7 — Hardening y deploy final
- Loading states.
- Mobile QA.
- Seguridad.
- Variables.
- Rollback.
- Checklist final.

## 10. Riesgos

| Riesgo | Impacto | Mitigación | Fase donde se atiende |
|---|---|---|---|
| Inicializar app antes de sesión válida | Exposición de UI/acciones sin auth | Guard de sesión antes de bootstrap/render | Fase 2-4 |
| Duplicar listeners | Doble ejecución de acciones write | Patrón único de bind + idempotencia de handlers | Fase 4-5 |
| Exponer PIN o secrets en frontend | Riesgo crítico de seguridad | Secret solo server-side + cookies HttpOnly | Fase 2-3 |
| Mezclar `public-order` con `internal-chekeo` | Regresiones en flujo público | Repositorio lógico separado y reglas de límites | Fase 1-7 |
| Cambiar `BOG_ACTIVE_ENV` accidentalmente | Escritura en entorno incorrecto | Política explícita: no tocar env sin autorización | Fase 0-7 |
| Romper Web App actual | Caída operativa del negocio | Migración paralela sin reemplazo temprano | Fase 1-6 |
| Acciones write sin confirmación | Errores operativos irreversibles | Confirm modal obligatorio + bloqueo de loading | Fase 5-6 |
| Migrar demasiadas cosas en un solo PR | Alto riesgo y difícil rollback | PRs pequeños por fase/capacidad | Fase 1-7 |
| Falta de rollback | Recuperación lenta ante fallos | Plan de rollback por fase y checklist | Fase 7 |
| Diferencias `google.script.run` vs `fetch` RPC | Errores de contrato y manejo de errores | Definir envelope RPC equivalente `{ok,data,error}` | Fase 3-5 |

## 11. Criterios para aprobar Fase 0
- Solo se creó documentación.
- No se cambió código funcional.
- No se tocó `cloudflare/public-order`.
- No se tocó `legacy/`.
- No se tocó `BOG_ACTIVE_ENV`.
- No se modificaron hojas ni contratos de Sheets.
- El documento incluye matriz `google.script.run`.
- El documento incluye plan por fases.
- El documento incluye riesgos y mitigaciones.

## 12. Siguiente paso
La siguiente fase será **Fase 1**: crear scaffold estático de `cloudflare/internal-chekeo` **sin backend y sin PIN**.

---

## Criterios de aceptación del PR (verificación explícita)
- Solo debe agregarse `docs/cloudflare-internal-chekeo-phase-0-audit.md`.
- No debe modificarse `Code.gs`.
- No debe modificarse `Index.html`.
- No debe modificarse `scripts.html`.
- No debe modificarse `styles.html`.
- No debe modificarse `cloudflare/public-order/`.
- No debe modificarse `legacy/`.
- No debe crearse `cloudflare/internal-chekeo` todavía.
- No debe agregarse `backend_internal_api_service.gs`.
- No debe cambiarse `BOG_ACTIVE_ENV`.
- PR title sugerido: **Document Phase 0 audit for internal Chekeo Cloudflare migration**.

## Fase 1 status
- Scaffold estático creado en `cloudflare/internal-chekeo`.
- Sin backend.
- Sin PIN.
- Sin API.
- Siguiente fase: **Fase 2 PIN/session aislado**.

## Fase 2 status
- PIN/session aislado creado.
- Endpoints `/api/auth`, `/api/session`, `/api/logout` creados.
- Sin RPC.
- Sin Apps Script.
- Sin datos reales.
- Siguiente fase: **Fase 3 RPC read-only mínimo**.
