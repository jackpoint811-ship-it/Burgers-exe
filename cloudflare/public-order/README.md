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
