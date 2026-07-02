# Checklists para agentes en Burgers.exe

Este archivo define checklists minimos para que Codex o cualquier agente entregue cambios revisables y seguros.

## Checklist universal

Aplicar en todo PR:

- [ ] Lei `AGENTS.md`.
- [ ] Lei `docs/codex-memory/00-indice.md`.
- [ ] Identifique el area afectada.
- [ ] No toque `legacy/` salvo autorizacion explicita.
- [ ] No agregue dependencias, CDNs ni frameworks salvo autorizacion explicita.
- [ ] No cambie contratos de datos, precios, tickets, promociones ni payloads salvo autorizacion explicita.
- [ ] Revise el diff completo.
- [ ] Ejecute `git diff --check` o reporte por que no pude ejecutarlo.
- [ ] Abri PR desde una rama limpia.

## Checklist de documentacion

Para cambios solo de docs:

- [ ] No cambie codigo de app.
- [ ] No cambie scripts ni configuracion.
- [ ] La documentacion nueva tiene un proposito claro.
- [ ] El indice enlaza cualquier archivo nuevo importante.
- [ ] Reporte que no se ejecutaron checks tecnicos porque no aplican.

## Checklist Migracion V2 Clean Architecture

- [ ] Lei `10-migration-tracker.md`.
- [ ] Confirme fase actual.
- [ ] Confirme fase autorizada.
- [ ] No salte fases.
- [ ] Revise `11-skills-and-tools.md` cuando aplico.
- [ ] No mezcle preview con produccion.
- [ ] No movi legacy salvo que la fase lo autorice.
- [ ] No borre archivos salvo autorizacion explicita.
- [ ] No toque secrets.
- [ ] Actualice el tracker antes de cerrar.
- [ ] Reporte bloqueadores y siguiente fase sugerida.

## Checklist de tooling

- [ ] Valide si Graphify aplica.
- [ ] Valide si Playwright aplica.
- [ ] Valide si Wrangler aplica.
- [ ] Valide si npm, typecheck y build aplican.
- [ ] Si alguna herramienta falto, reporte bloqueo o limitacion.

## Checklist de validacion local

- [ ] Confirme `AGENTS.md`.
- [ ] Confirme `.git`.
- [ ] Confirme `docs/codex-memory/00-indice.md`.
- [ ] Confirme `docs/codex-memory/10-migration-tracker.md`.
- [ ] Confirme `docs/codex-memory/11-skills-and-tools.md`.
- [ ] Confirme `docs/refactor-v2-clean-architecture.md`.
- [ ] Confirme `docs/environments.md`.
- [ ] Confirme `package.json`.
- [ ] Confirme `README.md`.
- [ ] Ejecute `tools/codex/verify-local-tooling.ps1` o reporte por que no se pudo.
- [ ] Ejecute `tools/codex/verify-skills.ps1` o reporte por que no se pudo.
- [ ] Clasifique archivos sueltos no trackeados antes de borrarlos.

## Checklist de limpieza de clones locales

- [ ] Busque carpetas bajo `C:\Documentos\Burgers-exe`.
- [ ] Identifique cuales tienen `.git` y `AGENTS.md`.
- [ ] Confirme que no sean `C:\Documentos\Burgers-exe\Preview`.
- [ ] Revise rama actual y `git status --short`.
- [ ] Revise si hay archivos no trackeados importantes.
- [ ] Revise si hay secrets, `.dev.vars`, credenciales o datos que deban preservarse.
- [ ] Si hay duda, marque `no borrar - requiere revision`.
- [ ] Si borra, verifique que la ruta resuelta este dentro de `C:\Documentos\Burgers-exe` y no sea `Preview`.

## Checklist UI/UX general

Para cambios visibles:

- [ ] Mantiene enfoque mobile-first.
- [ ] Funciona en 320px sin overflow horizontal.
- [ ] Funciona en 390px.
- [ ] Mantiene targets tactiles de al menos 44px.
- [ ] Mantiene foco visible.
- [ ] Mantiene labels persistentes.
- [ ] No reemplaza informacion esencial por placeholders.
- [ ] Tiene estados loading, success, error o empty cuando aplican.
- [ ] Respeta `prefers-reduced-motion`.
- [ ] Mantiene estetica Burgers.exe: cyberpunk, gaming, fondo oscuro, verde neon, glow y tono de quest.

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
- [ ] No se rompe descarga o generacion de ticket si aplica.

## Checklist public-order

Antes de tocar public order, leer `04-flujo-public-order.md`.

Validar:

- [ ] CTA para iniciar pedido sigue claro.
- [ ] Personalizacion del pedido sigue comprensible.
- [ ] Checkout mantiene labels, helper text y errores inline.
- [ ] No se rompen payloads enviados desde `orders-v2`.
- [ ] No se cambia lectura de menu, tickets, promociones, precios ni ubicacion sin autorizacion.
- [ ] Se probo o se dejo QA sugerido para pedido completo.

## Checklist pagos, tickets y WhatsApp

Aplicar si el cambio toca pagos, ticket, comprobante o mensajes:

- [ ] No cambie reglas de precio sin autorizacion.
- [ ] No cambie reglas de tickets sin autorizacion.
- [ ] El copy de WhatsApp incluye solo informacion necesaria.
- [ ] La informacion bancaria aparece solo cuando el pago es por transferencia, si aplica.
- [ ] El ticket mantiene folio, fecha/entrega, datos del cliente, desglose y total cuando aplique.
- [ ] El contenido no se satura visualmente.
- [ ] El tono mantiene la tematica Burgers.exe.

## Checklist Resumen K / operacion

Aplicar si el cambio toca produccion o resumen operativo:

- [ ] Muestra burgers necesarias.
- [ ] Muestra ingredientes necesarios.
- [ ] Muestra extras necesarios.
- [ ] Distingue cantidades operativas de informacion para cliente.
- [ ] No mezcla datos del sorteo con produccion salvo que el flujo lo requiera.

## Checklist PR

La descripcion del PR debe incluir:

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
