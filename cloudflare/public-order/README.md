# Burgers.exe Public Order (Cloudflare) — UX Fase 1

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

## Nota UX Fase 2
Pendiente: persistencia fina de extras por burger dentro de `Pedidos Master` / `Chekeo` en backend Apps Script. En esta fase solo se captura y envía en `personalizations` sin cambiar backend operativo.
