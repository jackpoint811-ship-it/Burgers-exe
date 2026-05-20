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
- `Burgers.exe`
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

### Apps Script (upstream) listo para pegar
Pega este snippet en tu proyecto de Apps Script **vinculado a la hoja** y despliega como Web App:

```js
function doGet(e) {
  var DEFAULTS = {
    closed: false,
    title: 'PEDIDOS CERRADOS POR AHORA',
    message: 'Por el momento no estamos recibiendo pedidos. Únete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.',
    whatsappUrl: 'https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp'
  };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Control Pedidos');

    if (!sheet) {
      return jsonOutput({ ok: true, closed: false, title: DEFAULTS.title, message: DEFAULTS.message, whatsappUrl: DEFAULTS.whatsappUrl });
    }

    var b2 = sheet.getRange('B2').getValue(); // checkbox / boolean
    var b3 = sheet.getRange('B3').getDisplayValue();
    var b4 = sheet.getRange('B4').getDisplayValue();
    var b5 = sheet.getRange('B5').getDisplayValue();
    var b6 = sheet.getRange('B6').getDisplayValue(); // no usado todavía en frontend

    var closed = b2 === true || String(b2).toLowerCase() === 'true';
    var title = String(b3 || '').trim() || DEFAULTS.title;
    var message = String(b4 || '').trim() || DEFAULTS.message;
    var whatsappUrl = String(b5 || '').trim() || DEFAULTS.whatsappUrl;

    return jsonOutput({
      ok: true,
      closed: closed,
      title: title,
      message: message,
      whatsappUrl: whatsappUrl
    });
  } catch (err) {
    return jsonOutput({
      ok: true,
      closed: false,
      title: 'PEDIDOS CERRADOS POR AHORA',
      message: 'Por el momento no estamos recibiendo pedidos. Únete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.',
      whatsappUrl: 'https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp',
      // opcional para depuración:
      // error: String(err && err.message ? err.message : err)
    });
  }
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> Nota sobre `B6`: actualmente el frontend **no usa** texto de botón configurable. Puedes guardar ahí un texto futuro, pero por ahora el botón se muestra fijo como **"Unirme al grupo de WhatsApp"**.

### Despliegue exacto del Web App (Apps Script)
1. En Apps Script: **Deploy > New deployment**.
2. Tipo: **Web app**.
3. **Execute as**: `Me`.
4. **Who has access**: `Anyone`.
5. Haz deploy y copia la **Web App URL**.
6. En Cloudflare (`public-order`), configura la variable de entorno `APPS_SCRIPT_ORDER_GATE_ENDPOINT` con esa URL.
7. Re-deploy de Cloudflare Pages/Functions para tomar el cambio de variable.

> Importante: el checkbox (`B2`) **no controlará el modal** hasta que `APPS_SCRIPT_ORDER_GATE_ENDPOINT` esté configurado en Cloudflare.

### Seguridad operativa
- Si `/api/order-gate` falla o no está configurado, el sitio **queda abierto** (`closed: false`) para evitar bloqueos accidentales.
- El frontend agrega guard en `submit()` para impedir `POST /api/order` cuando `closed` sea `true`.
