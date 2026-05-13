# Burgers.exe Public Order (Cloudflare) — Fase 2

## Estado actual
La página pública ya funciona como flujo real de pedido (mobile-first), con submit a `POST /api/order` y modo seguro **dry-run por defecto**.

## Funcionalidad Fase 2
- Captura datos de cliente: nombre, teléfono, ubicación fija (Torre GGA / Torre Valcob), forma de pago y nota.
- Armado de carrito con productos, guarniciones y extras con precios fijos.
- Personalización individual por hamburguesa (`OG` y `BBQ`) para cada unidad pedida.
- Resumen desglosado con cantidad, unitario, subtotal y total general.
- Draft robusto en `localStorage` con:
  - datos cliente
  - pago
  - items
  - personalizaciones
  - nota
  - timestamp
- Botones:
  - `LOAD LAST ORDER` (restaura)
  - `NEW ORDER / CLEAR SAVE` (limpia draft y estado)
- Pantalla de éxito estilo terminal: `ORDER COMPILED` con resumen.
- Bloque de pago:
  - `Pagar Antes` => intenta `GET /api/bank-config`; si el endpoint sigue stub, muestra `Datos bancarios pendientes de conectar`.
  - `Pago mismo dia` => muestra mensaje operativo de pago en entrega.

## Payload frontend → /api/order (propuesto y documentado)
```json
{
  "payload": {
    "customerName": "Nombre Cliente",
    "phone": "5512345678",
    "location": "Torre GGA",
    "paymentMethod": "Pagar Antes",
    "note": "Sin mostaza en OG #2",
    "timestamp": "2026-05-13T00:00:00.000Z",
    "items": [
      { "sku": "OG", "qty": 2 },
      { "sku": "BBQ", "qty": 1 },
      { "sku": "PAPAS_OG", "qty": 1 },
      { "sku": "EXTRA_TOCINO", "qty": 1 }
    ],
    "personalizations": {
      "burgers": [
        { "sku": "OG", "burgerIndex": 1, "without": [] },
        { "sku": "OG", "burgerIndex": 2, "without": ["Sin Pepinillos", "Sin Mostaza"] },
        { "sku": "BBQ", "burgerIndex": 1, "without": ["Sin Salsa bbq"] }
      ]
    }
  }
}
```

## Cloudflare Function /api/order
- Mantiene validación y cálculo server-side.
- Normaliza `items` contra SKUs permitidos.
- Conserva `personalizations` dentro de `preparedPayload.payload` (incluyendo dry-run).
- Mantiene control de escritura:
  - `PUBLIC_ORDER_WRITE_ENABLED !== "true"` => `mode: "dry-run"`, sin escribir ni llamar upstream.
  - Solo con `PUBLIC_ORDER_WRITE_ENABLED === "true"` + secrets configurados intenta proxy a Apps Script.

## Reglas preservadas
- No se usa `google.script.run` en Cloudflare.
- No se toca `legacy/`.
- No se modifica `BOG_ACTIVE_ENV`.
- No se agregan columnas ni se altera contrato de Sheets en esta fase.
- No se activa escritura real por defecto.

## Pendiente para Fase 3
- Persistencia completa de personalizaciones en Apps Script (si se decide mapearlas en columnas/estructura operativa).
- Integración real de datos bancarios en `/api/bank-config` (sin exponer secretos).
- Pulido visual final (assets finales brand board, microanimaciones, accesibilidad avanzada).
