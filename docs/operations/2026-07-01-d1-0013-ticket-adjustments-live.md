# D1 Live Record: 0013 Ticket Adjustments Migration

## 1. Resumen

La migracion `0013_v2_raffles_ticket_adjustments.sql` ya fue aplicada manualmente en la base D1 live de produccion. Este registro deja evidencia operativa para evitar que alguien vuelva a ejecutar la migracion sobre `burgers-exe-menu-live` por error.

## 2. Base afectada

- Base: `burgers-exe-menu-live`
- Tabla: `raffle_ticket_adjustments_v2`
- Entorno: live/production D1

## 3. Metodo usado

La aplicacion se hizo con `wrangler d1 execute --file`, apuntando al `wrangler.toml` operativo ya existente para `cloudflare/public-order`.

No se uso `wrangler d1 migrations apply`.

No se incluyen secretos ni credenciales en este documento.

## 4. Resultado de ejecucion

- `Processed 5 queries`
- `Executed 5 queries in 8.32ms`
- `Rows read: 7`
- `Rows written: 6`
- `changed_db: true`

Wrangler mostro solo el warning operativo normal sobre disponibilidad temporal de D1 durante import. No hubo errores.

## 5. Esquema confirmado

Tabla confirmada: `raffle_ticket_adjustments_v2`

Columnas confirmadas:

- `id TEXT PRIMARY KEY`
- `campaign_id TEXT NOT NULL`
- `participant_key TEXT NOT NULL`
- `participant_name TEXT NOT NULL`
- `participant_phone_masked TEXT NOT NULL`
- `tickets_delta INTEGER NOT NULL`
- `reason TEXT NOT NULL`
- `actor TEXT NOT NULL DEFAULT 'internal-v2'`
- `status TEXT NOT NULL DEFAULT 'active'`
- `reverted_at TEXT NULL`
- `reverted_by TEXT NULL`
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`

## 6. Confirmaciones de seguridad

- No se ejecuto `0008`.
- No se hizo deploy.
- No se tocaron datos manualmente mas alla del import SQL.
- No se hizo rollback.
- No se modifico `legacy`.
- No se modifico `cloudflare/public-order/**`.

## 7. Validacion de codigo

El codigo V2 ya cubre el flujo funcional requerido alrededor de `raffle_ticket_adjustments_v2`:

- backend para crear ajustes manuales,
- backend para revertir ajustes,
- listado en admin,
- suma/resta de ajustes en totales visibles,
- lookup publico con ajustes activos,
- uso de telefono enmascarado.

Rutas relevantes:

- `functions/api/raffles-v2-admin/ticket-adjustments.ts`
- `functions/api/raffles-v2-admin/ticket-adjustments/[id].ts`
- `functions/api/raffles-v2-admin/_utils.ts`
- `functions/api/raffles-v2/lookup.ts`
- `apps/internal-chekeo-v2/src/components/RafflesAdminPanel.tsx`
- `apps/internal-chekeo-v2/src/lib/raffles-v2-admin.ts`
- `packages/config/src/contracts.ts`

## 8. Checks ejecutados

- `npm run typecheck` -> OK
- `npm run build` -> OK
- `npm run lint` -> no existe script
- Playwright public lookup adjustment test -> passed
- Playwright internal manual ticket adjustment test -> passed

Checks de referencia ejecutados:

- `npx playwright test tests/visual/public-preflight.spec.ts -g "shows manual ticket adjustments in the public lookup" --config=playwright.visual.config.ts`
- `npx playwright test tests/internal-chekeo/kitchen-production-board.spec.ts -g "supports manual raffle ticket adjustments" --config=playwright.internal-kitchen.config.ts`

## 9. Advertencia operativa

`0013_v2_raffles_ticket_adjustments.sql` ya fue aplicada en live. No volver a ejecutarla sobre `burgers-exe-menu-live` salvo autorizacion explicita y plan de rollback.

No se uso `wrangler d1 migrations apply` para este cambio.

## 10. Siguiente paso

No hay gap funcional critico pendiente para esta migracion. Cualquier trabajo tecnico adicional debe continuar en otra rama y en otro PR separado de este registro operativo.
