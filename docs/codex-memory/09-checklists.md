# Checklists para agentes en Burgers.exe

Este archivo define checklists mínimos para que Codex o cualquier agente entregue cambios revisables y seguros.

## Checklist universal

Aplicar en todo PR:

- [ ] Leí `AGENTS.md`.
- [ ] Leí `docs/codex-memory/00-indice.md`.
- [ ] Identifiqué el área afectada.
- [ ] No toqué `legacy/` salvo autorización explícita.
- [ ] No agregué dependencias, CDNs ni frameworks salvo autorización explícita.
- [ ] No cambié contratos de datos, precios, tickets, promociones ni payloads salvo autorización explícita.
- [ ] Revisé el diff completo.
- [ ] Ejecuté `git diff --check` o reporté por qué no pude ejecutarlo.
- [ ] Abrí PR desde una rama limpia.

## Checklist de documentación

Para cambios solo de docs:

- [ ] No cambié código de app.
- [ ] No cambié scripts ni configuración.
- [ ] La documentación nueva tiene un propósito claro.
- [ ] El índice enlaza cualquier archivo nuevo importante.
- [ ] Reporté que no se ejecutaron checks técnicos porque no aplican.

## Checklist UI/UX general

Para cambios visibles:

- [ ] Mantiene enfoque mobile-first.
- [ ] Funciona en 320px sin overflow horizontal.
- [ ] Funciona en 390px.
- [ ] Mantiene targets táctiles de al menos 44px.
- [ ] Mantiene foco visible.
- [ ] Mantiene labels persistentes.
- [ ] No reemplaza información esencial por placeholders.
- [ ] Tiene estados loading, success, error o empty cuando aplican.
- [ ] Respeta `prefers-reduced-motion`.
- [ ] Mantiene estética Burgers.exe: cyberpunk, gaming, fondo oscuro, verde neón, glow y tono de quest.

## Checklist Chekeo

Antes de tocar Chekeo, leer `03-flujos-chekeo.md`.

Validar:

- [ ] Pedidos se enfoca en revisar y administrar pedidos.
- [ ] Pagos concentra pago, ticket, WhatsApp y comprobante cuando aplique.
- [ ] Corte mantiene resumen operativo claro.
- [ ] Sorteo muestra lo esencial sin saturar.
- [ ] No se rompe el flujo de marcar pagado / regresar a pendiente.
- [ ] No se rompe nota interna.
- [ ] No se rompe WhatsApp.
- [ ] No se rompe descarga o generación de ticket si aplica.

## Checklist public-order

Antes de tocar public order, leer `04-flujo-public-order.md`.

Validar:

- [ ] CTA para iniciar pedido sigue claro.
- [ ] Personalización del pedido sigue comprensible.
- [ ] Checkout mantiene labels, helper text y errores inline.
- [ ] No se rompen payloads enviados desde `orders-v2`.
- [ ] No se cambia lectura de menú, tickets, promociones, precios ni ubicación sin autorización.
- [ ] Se probó o se dejó QA sugerido para pedido completo.

## Checklist pagos, tickets y WhatsApp

Aplicar si el cambio toca pagos, ticket, comprobante o mensajes:

- [ ] No cambié reglas de precio sin autorización.
- [ ] No cambié reglas de tickets sin autorización.
- [ ] El copy de WhatsApp incluye solo información necesaria.
- [ ] La información bancaria aparece solo cuando el pago es por transferencia, si aplica.
- [ ] El ticket mantiene folio, fecha/entrega, datos del cliente, desglose y total cuando aplique.
- [ ] El contenido no se satura visualmente.
- [ ] El tono mantiene la temática Burgers.exe.

## Checklist Resumen K / operación

Aplicar si el cambio toca producción o resumen operativo:

- [ ] Muestra burgers necesarias.
- [ ] Muestra ingredientes necesarios.
- [ ] Muestra extras necesarios.
- [ ] Distingue cantidades operativas de información para cliente.
- [ ] No mezcla datos del sorteo con producción salvo que el flujo lo requiera.

## Checklist PR

La descripción del PR debe incluir:

```md
## Summary
- ...

## Testing
- ...

## Risks
- ...

## QA checklist
- [ ] ...
```

Si no se ejecuta un check, escribir:

```md
- Not run: [motivo claro]
```
