# Burgers.exe Public Order (Cloudflare) — Fase 3

## Estado actual
La página pública funciona en flujo real de captura y envío, con validaciones en Cloudflare + Apps Script y con **dry-run por defecto**.

> `PUBLIC_ORDER_WRITE_ENABLED` debe permanecer en `false` hasta una prueba controlada de escritura real.

## Funcionalidad Fase 3
- Captura completa de cliente: nombre, teléfono, ubicación (`Torre GGA` / `Torre Valcob`), forma de pago (`Pago mismo dia` / `Pagar Antes`) y nota.
- Carrito con SKUs permitidos y total calculado server-side.
- Personalización por unidad de burger (`OG`/`BBQ`) persistible en columnas operativas existentes de `Pedidos Master`.
- `/api/order` conserva modo seguro:
  - `PUBLIC_ORDER_WRITE_ENABLED !== "true"` => `dry-run` (sin escribir).
  - Solo en `true` y con secrets configurados llama a Apps Script.
- `/api/bank-config` con configuración segura por variables de entorno (sin hardcode en frontend).

## Variables de entorno Cloudflare
### Orden pública
- `PUBLIC_ORDER_WRITE_ENABLED` (`false` por defecto)
- `APPS_SCRIPT_ORDER_ENDPOINT` (solo requerido para write real)
- `APPS_SCRIPT_SHARED_SECRET` (solo requerido para write real)

### Datos bancarios
- `BANK_ENABLED`
- `BANK_NAME`
- `BANK_ACCOUNT_HOLDER`
- `BANK_ACCOUNT_NUMBER`

Respuesta esperada de `/api/bank-config`:
- Si `BANK_ENABLED !== "true"`:
  - `{ ok: true, data: { enabled: false } }`
- Si `BANK_ENABLED === "true"`:
  - `{ ok: true, data: { enabled: true, bankName, accountHolder, accountNumber } }`

## Frontend: reglas de visualización bancaria
- `paymentMethod === "Pagar Antes"` + `enabled: true`:
  - Muestra banco, titular y cuenta.
- `paymentMethod === "Pagar Antes"` + `enabled: false`:
  - Muestra `Datos bancarios pendientes de conectar`.
- `paymentMethod === "Pago mismo dia"`:
  - Oculta datos bancarios y muestra `Pagas el día de entrega: efectivo o transferencia.`

## Nota de activación write real
La activación de escritura real **no** forma parte de esta fase. Se hará manualmente después de una prueba controlada con:
1. Endpoint Apps Script productivo validado.
2. Secret compartido validado.
3. Casos de prueba con payloads válidos/ inválidos.
4. Verificación de persistencia en `Pedidos Master` y continuidad del flujo `Chekeo/Chekeo Nuevo`.
