# 02 — Data Contract (Definitivo Fase 1)

## Hojas usadas
- `Pedidos Master`
- `Chekeo Nuevo`
- `Chekeo`
- `Configuración`
- `Resumen Pedidos`
- `Historico`

## Columnas de `Chekeo Nuevo`
1. ID Pedido
2. Fila Master
3. Fecha Pedido
4. Hora Pedido
5. Nombre
6. Teléfono
7. Resumen Pedido
8. Hamburguesas
9. Extras
10. Guarniciones
11. Total
12. Estado Pedido
13. Estado Pago
14. Método Pago
15. Nota Interna
16. Nota Cliente
17. Alerta
18. Ticket Enviado
19. Fecha Ticket Enviado
20. Hora Inicio
21. Hora Listo
22. Última Actualización

## Catálogos permitidos
- **Estado Pedido:** `Nuevo`, `Confirmado`, `Preparando`, `Listo`.
- **Estado Pago:** `Pendiente`, `Pagado`.
- **Método Pago:** `Efectivo`, `Transferencia`, `Mixto`, `No definido`.
- **Ticket Enviado:** `Si`, `No`.
- **Alerta:** vacío = sin alerta, `⚠️` = revisar (no bloquea).

## Referencia de detalle
El detalle normativo completo del contrato (tabla campo a campo, reglas de sync, ticket/WhatsApp, validaciones y cierre de fase) está en:
- `planning/04-phase-1-data-contract.md`
