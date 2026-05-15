# Burgers.exe Public Order (Cloudflare) — UX Fase 2

## Estado actual
Flujo frontend rediseñado como wizard por pasos:

`MENU > BURGERS > CUSTOM > EXTRAS > GUARNICIONES > DATOS > RESUMEN`

Se mantiene **dry-run por defecto** y no se realizaron cambios en Apps Script ni en contratos backend.

## Nuevo state shape (frontend)
```js
state = {
  step,
  burgerUnits: [{ id, sku, label, without: [], extras: [] }],
  sidesQty: {},
  customer: { customerName, phone, location, paymentMethod, note },
  ts
}
```

## Compatibilidad con `/api/order`
`buildPayload()` conserva el formato operativo:
- `items` global por SKU (incluye suma de extras por burger).
- `personalizations.burgers[]` con `{ sku, burgerIndex, without, extras }`.

Ejemplo: dos burgers con `Tocino` extra en cada una -> `items` contiene `{ sku: "EXTRA_TOCINO", qty: 2 }`.

## UX Fase 2 (backend Apps Script)
El backend ahora persiste detalle por burger en columnas existentes:
- `Burger OG`
- `BBQ Burger`
- `Describe como quieres tus Burgers`

Formato esperado por burger:
- `OG #1: Con todo | Extras: Sin extras`
- `OG #1: Quitar: Sin Pepinillos | Extras: Tocino +$5`

Validaciones aplicadas en backend:
- `personalizations.burgers[].extras` debe ser array (si se envía).
- Solo se permiten extras en allowlist:
  - `Pepinillos`, `Queso americano`, `Queso manchego`, `Tocino`, `Catsup`, `Mostaza`, `Tomate`.
- Se rechazan textos restringidos (`Chequeo Manual`, `(+1)`).
- Se valida consistencia entre extras por burger y `items` globales por SKU (`EXTRA_*`), rechazando payload inconsistente con:
  - `Extras por burger no coinciden con items globales.`

Importante:
- El cálculo de precio no toma `personalizations.extras`; el total sigue calculándose desde `items` globales.

## Control de pedidos desde Google Sheets (order gate)
El frontend ahora consulta `GET /api/order-gate` para decidir si debe bloquear el flujo de pedidos.

### Contrato esperado de `/api/order-gate`
```json
{
  "ok": true,
  "closed": false,
  "title": "PEDIDOS CERRADOS POR AHORA",
  "message": "Por el momento no estamos recibiendo pedidos. Únete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.",
  "whatsappUrl": "https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp"
}
```

### Configuración sugerida en Google Sheets
Usar una hoja/tab llamada **Admin** o **Control Pedidos** (no borrar ni renombrar hojas existentes).

Celdas a leer:
- `A1`: `Control de pedidos`
- `A2`: `Cerrar pedidos`
- `B2`: checkbox / boolean (`TRUE` cierra pedidos, `FALSE` abre pedidos)
- `A3`: `Título modal`
- `B3`: `PEDIDOS CERRADOS POR AHORA`
- `A4`: `Mensaje modal`
- `B4`: `Por el momento no estamos recibiendo pedidos. Únete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.`
- `A5`: `Link WhatsApp`
- `B5`: `https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp`

### Apps Script (upstream) esperado
Configurar `APPS_SCRIPT_ORDER_GATE_ENDPOINT` en Cloudflare para apuntar a un endpoint Apps Script que:
1. Lea la hoja `Admin` o `Control Pedidos`.
2. Lea `B2`, `B3`, `B4`, `B5`.
3. Responda JSON con el contrato de `/api/order-gate` mostrado arriba.

### Seguridad operativa
- Si `/api/order-gate` falla o no está configurado, el sitio **queda abierto** (`closed: false`) para evitar bloqueos accidentales.
- El frontend agrega guard en `submit()` para impedir `POST /api/order` cuando `closed` sea `true`.
