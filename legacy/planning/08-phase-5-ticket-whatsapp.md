# 08 — Fase 5: Ticket cliente + WhatsApp

## Objetivo
Implementar en la Web App móvil un flujo de salida al cliente que permita:
- generar ticket cliente en imagen (PNG) desde canvas propio,
- abrir WhatsApp con mensaje precargado para cobro por transferencia,
sin envío automático, sin adjuntos automáticos y sin librerías externas.

## Alcance
- UI en detalle de pedido para:
  - vista previa de ticket cliente en canvas,
  - descarga manual de PNG,
  - apertura manual de enlace `wa.me` con texto precargado,
  - marcado manual de `Ticket Enviado`.
- Mantener operación sobre hoja activa `Chekeo Nuevo`.
- Reutilizar backend existente (`markTicketSent`, `getBankConfig`, `getAppOrders`) sin cambios de contrato.

## Componentes UI creados
- Bloque `Ticket cliente` dentro del modal de detalle de pedido.
- Botón `Descargar ticket PNG`.
- Botón `Abrir WhatsApp`.
- Botón `Marcar ticket enviado` (con bloqueo de escritura).
- Mensaje de fallback de descarga debajo del canvas.
- Estado visual en detalle:
  - `Ticket enviado: Si/No`
  - `Fecha ticket enviado` (si existe).

## Funciones backend consumidas
- `getAppOrders()`
- `getBankConfig()`
- `markTicketSent(orderId)`
- `syncOrdersFromMaster()` (sin cambios, solo contexto operativo)

## Contrato del ticket cliente
El ticket **solo** incluye:
- `ID Pedido`
- `Nombre`
- `Resumen Pedido`
- `Hamburguesas`
- `Extras`
- `Guarniciones`
- `Nota Cliente` (solo si existe)
- `Total`

Además incluye texto de marca/UX:
- Encabezado `Burger-OG`
- Texto breve `Gracias por tu pedido`

No incluye:
- teléfono,
- estados operativos/pago,
- método de pago,
- nota interna,
- alerta,
- fecha/hora,
- campos internos.

## Contrato del mensaje de WhatsApp
El mensaje incluye únicamente:
- saludo con nombre,
- total,
- datos bancarios de `Configuración`:
  - `Banco`
  - `Nombre`
  - `Número de cuenta`
- frase breve de acompañamiento del ticket.

No incluye:
- resumen completo del pedido,
- envío automático,
- adjunto automático.

## Decisiones técnicas sobre imagen/canvas/descarga
- Se usa `<canvas>` nativo para render del ticket (sin `html2canvas`).
- Descarga por `canvas.toDataURL('image/png')` + `<a download>`.
- Nombre de archivo seguro: `ticket-<ID>.png` con sanitización de caracteres.
- Fallback UX: sugerencia explícita para mantener presionada la imagen o tomar captura cuando el navegador limite descargas.

## Qué queda fuera de Fase 5
- Envío automático de WhatsApp.
- Adjuntar imagen automáticamente en WhatsApp.
- Integraciones externas/APIs externas.
- Migración a hoja `Chekeo` oficial.
- Cambios en `legacy/`.

## Criterios de aceptación
1. Existe documento de fase (`planning/08-phase-5-ticket-whatsapp.md`).
2. Ticket en canvas usa solo campos permitidos y no muestra fecha/hora.
3. Descarga PNG con nombre `ticket-<ID>.png` sanitizado.
4. Existe fallback visible para guardar ticket si falla descarga.
5. Teléfono para WhatsApp se normaliza para México:
   - 10 dígitos => anteponer `52`
   - `52` + 10 dígitos => válido
   - cualquier otro caso => error amigable y no abrir WhatsApp.
6. Detalle muestra estado visual de ticket enviado (`Si/No` + fecha si existe).
7. Botón `Marcar ticket enviado` participa en bloqueo `loading.write`.
8. Sin `html2canvas`, CDN, frameworks ni librerías externas.

## Riesgos/pendientes
- Algunos navegadores embebidos pueden bloquear `window.open` o descargas directas; se mitiga con fallback visible.
- Calidad visual del ticket depende de resolución de pantalla/zoom del dispositivo.
- Formatos de teléfono no MX quedan fuera por alcance actual.
