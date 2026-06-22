# Burgers.exe Mini Ticket Preview

Preview aislado del **Mini Ticket vertical compacto** para WhatsApp.

## Decisión de alcance

Este preview **no toca producción ni Chekeo**. Vive como laboratorio visual para afinar el resultado antes de integrarlo al flujo real.

## Especificación actual

- Tamaño: `640×1100`.
- Uso principal: WhatsApp chat.
- Header: `C:\> BURGERS.EXE` + `TICKET DE PEDIDO`.
- Folio discreto.
- Fecha sin hora.
- Punto de entrega: solo el elegido (`Torre Valcob` o `Torre GGA`).
- Cliente: nombre y teléfono.
- Pedido: productos + extras con precio.
- Costos: subtotal, extras, envío, descuento y total.
- Sorteo abajo: acumulado total, tickets agregados por este pedido y código referido asignado al cliente.
- Footer: slogan.
- Sin QR.
- Sin redes.

## Cómo probarlo

Abre `index.html` en navegador. Permite:

- cambiar tema de color;
- cambiar datos mock;
- editar JSON;
- descargar SVG;
- descargar PNG.

## Siguiente paso recomendado

Usar este preview como base para una iteración con Codex usando Graphify, UI UX Pro Max y Playwright. La integración a Chekeo debe hacerse después, cuando el layout quede validado visualmente.
