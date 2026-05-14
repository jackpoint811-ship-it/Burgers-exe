# Public Order — Mobile-first QA final (Fase 6)

Fecha: 2026-05-14  
Scope: `cloudflare/public-order` (UI/UX visual polish, accesibilidad básica, responsive QA)

## 1) Checklist de flujo completo

- [ ] MENU: se visualizan burgers, extras y guarniciones con jerarquía clara.
- [ ] BURGERS: se puede incrementar/disminuir OG/BBQ sin fricción.
- [ ] CUSTOM: se pueden quitar ingredientes por burger sin desalineaciones.
- [ ] EXTRAS: se pueden marcar extras por burger correctamente.
- [ ] GUARNICIONES: controles +/- cómodos y legibles.
- [ ] DATOS: validaciones inline claras y visibles.
- [ ] RESUMEN: desglose legible por secciones + total destacado.
- [ ] Submit: status cambia sin romper el layout ni usar `alert()`.

## 2) Checklist mobile (360 / 390 / 430)

- [ ] Sin overflow horizontal en 360px.
- [ ] Sin overflow horizontal en 390px.
- [ ] Sin overflow horizontal en 430px.
- [ ] Sticky nav no tapa campos importantes al hacer scroll.
- [ ] Mini resumen se lee completo y no estorba al CTA.
- [ ] Botones mantienen target táctil mínimo (44px).
- [ ] Inputs/select/textarea mantienen target táctil mínimo (44px).
- [ ] Stepper permite navegación horizontal y focus visible.
- [ ] DATOS usable sin zoom.

## 3) Checklist desktop

- [ ] Layout centrado y consistente (sin verse “estirado”).
- [ ] Nav pasa a layout no-sticky en >=760px.
- [ ] Cards mantienen consistencia visual (borde/fondo/contraste).
- [ ] Resumen final legible con jerarquía adecuada.

## 4) Checklist persistencia local

- [ ] “Cargar pedido guardado en este dispositivo” restaura draft.
- [ ] “Reiniciar pedido y borrar guardado local” limpia draft.
- [ ] Mini hint de guardado local se mantiene visible.
- [ ] Mensajes de status reflejan acciones de carga/reinicio.

## 5) Checklist payload no modificado

- [ ] Sin cambios en `buildPayload()`.
- [ ] Sin cambios en `submit()` (endpoint/contrato).
- [ ] Sin cambios de precios ni SKUs.
- [ ] Sin cambios de esquema de `localStorage`.

## 6) Riesgos pendientes / recomendaciones

- Recomendado: automatizar smoke QA visual por breakpoints (360/390/430/desktop) con snapshots.
- Recomendado: incluir pruebas E2E mínimas para validar flujo completo y estado persistido.
- Riesgo conocido: en dispositivos con teclado virtual agresivo, el comportamiento sticky puede variar por navegador; monitorear en QA real de iOS/Android.
