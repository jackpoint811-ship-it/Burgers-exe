# BLOQUE 5 — Auditoría final post-rediseño + backlog priorizado (`public-order` / `internal-chekeo`)

## 0) Alcance, método y restricciones aplicadas

Este documento consolida la auditoría final **post-rediseño visual controlado** para:
- `legacy/cloudflare/public-order`
- `legacy/cloudflare/internal-chekeo`

Fuentes base revisadas:
- `docs/ui-visual-system-v1.md`
- `docs/adr-ui-libraries-2026.md`
- `docs/ui-ux-2026-audit-chekeo-and-public-order.md`
- `docs/ui-redesign-qa-checklist.md`
- `legacy/docs/ui-ux-mobile-first-plan.md`
- `legacy/docs/cloudflare-internal-chekeo-phase-0-audit.md`
- `legacy/docs/deep-research-report-actualizado.md` (disponible)

Restricciones respetadas:
- Sin cambios de lógica/contratos/flujo de negocio.
- Sin tocar `legacy/cloudflare/public-order/*` ni `legacy/cloudflare/internal-chekeo/*`.
- Sin tocar backend, Apps Script, Cloudflare Functions, Sheets, `legacy/`, `BOG_ACTIVE_ENV`.
- Sin dependencias nuevas ni cambios package/build/config.

---

## 1) Resumen ejecutivo

### Qué se logró
- Se completó hardening técnico en ambas apps, más accesibilidad estructural base y rediseño visual controlado.
- Existe convergencia explícita al visual-system v1 vía aliases de tokens CSS, foco visible y `prefers-reduced-motion`.
- Se mantienen restricciones de arquitectura: vanilla CSS/JS, sin librerías runtime, sin alterar contratos.

### Estado actual `public-order`
- Flujo wizard operativo y consistente (`MENU > BURGERS > CUSTOM > EXTRAS > GUARNICIONES > DATOS > RESUMEN`).
- Visualmente más sólido: hero, stepper, paneles y navegación sticky con identidad terminal/neón.
- Base A11y mejorada (focus visible, reduced motion), pero persisten puntos que requieren validación manual específica por viewport/teclado y consistencia de estados en formularios.

### Estado actual `internal-chekeo`
- Shell PIN/session, top nav + bottom nav, modales/confirmaciones y write actions presentes y operativos.
- Lenguaje visual converge con v1 (tokens, componentes oscuros, foco visible, reduced motion).
- Riesgo principal: por criticidad operativa, varios comportamientos deben validarse manualmente sin ejecutar acciones destructivas.

### Riesgos restantes
1. Riesgo de regresión visual en 320/390px en zonas sticky/bottom nav y modales.
2. Riesgo A11y en navegación por teclado (orden de foco y foco visible en capas superpuestas).
3. Riesgo de confianza UX en estados loading/success/error si no se verifica consistencia por flujo real.
4. Riesgo operativo en Chekeo si se tocan writes/confirmaciones sin plan de pruebas controlado.

---

## 2) Matriz de cumplimiento (post-rediseño)

> Estado usado: ✅ Cumple · ⚠️ Requiere revisión manual · ❌ Requiere fix

| Criterio | `public-order` | `internal-chekeo` | Comentario |
|---|---|---|---|
| mobile-first | ✅ | ✅ | Layout móvil, targets táctiles y safe-area contemplados; falta validación manual completa multi-device. |
| WCAG 2.2 AA objetivo | ⚠️ | ⚠️ | Base buena (foco/reduced motion/estructura), pero falta cierre manual formal con matriz teclado/lectura/contraste por pantalla. |
| focus visible | ✅ | ✅ | Reglas `:focus-visible` claras en ambos CSS. |
| reduced motion | ✅ | ✅ | `@media (prefers-reduced-motion: reduce)` presente en ambos. |
| sticky / bottom nav | ⚠️ | ⚠️ | Presente; requiere QA de solapes con contenido, teclado virtual y modales en 320/390px. |
| modales | ⚠️ | ⚠️ | Estructura visual estable; se requiere confirmación manual de foco/scroll/cierre en edge cases. |
| loading/success/error/empty | ⚠️ | ⚠️ | Estados existen; validar consistencia perceptual y no dependencia exclusiva de color por flujo real. |
| tokens visual-system v1 | ✅ | ✅ | Aliases v1 visibles en ambos CSS, manteniendo compatibilidad legacy. |
| performance / no dependencies | ✅ | ✅ | Se sostiene política vanilla runtime sin librerías/CDN. |
| contratos intactos | ✅ | ✅ | No se observan cambios de endpoints/payloads/RPC en esta fase documental. |

---

## 3) Auditoría por app

## 3.1 `public-order`

| Área | Estado | Hallazgo puntual |
|---|---|---|
| hero | ✅ | Identidad visual consistente y legible; buena jerarquía inicial. |
| stepper | ⚠️ | Estructura clara; validar navegación teclado/foco al transicionar pasos y en viewport pequeños. |
| cards de menú | ✅ | Patrón de card estable y legible; targets táctiles correctos en base. |
| custom/extras/guarniciones | ⚠️ | Visual consistente; revisar wrap de textos largos y percepción de estado seleccionado en 320px. |
| DATOS/formulario | ⚠️ | Base funcional robusta; requiere revisión manual de errores inline y foco tras validación fallida. |
| RESUMEN/ticket | ⚠️ | Legibilidad general buena; validar confianza del total y prioridad visual del CTA en móvil. |
| nav sticky | ⚠️ | Presente y útil; riesgo de solape foco/inputs/teclado en pantallas bajas. |
| success panel | ✅ | Feedback visible y diferenciable; requiere sólo smoke manual final. |
| order gate modal | ⚠️ | Cobertura visual correcta; validar foco, retorno y scroll interno en 320/390px. |

## 3.2 `internal-chekeo`

| Área | Estado | Hallazgo puntual |
|---|---|---|
| PIN screen | ✅ | Acceso visualmente claro y coherente con sistema actual. |
| app shell/header | ✅ | Jerarquía estable, acciones visibles y legibles. |
| top nav | ⚠️ | Estado activo visible; validar orden de foco y sincronía semántica con bottom nav. |
| bottom nav | ⚠️ | Buena ergonomía base; validar que no tape contenido/acciones en flujos largos. |
| Inicio | ✅ | Cards/listados legibles y consistentes. |
| Pedidos | ⚠️ | Densidad funcional alta; revisar foco en chips + acciones con teclado. |
| Cocina | ⚠️ | Flujo claro; validar estados rápidos en móvil para evitar taps accidentales. |
| Otros | ⚠️ | Sección extensa; revisar jerarquía visual y scroll/foco entre subsecciones. |
| modales | ⚠️ | Modal y confirm modal están; falta cierre manual formal de foco/escape/retorno. |
| confirmaciones | ⚠️ | Patrón existe; validar claridad de copy + affordance de cancelar vs confirmar. |
| toast/status | ✅ | Contraste y prominencia razonables; validar no interferencia con bottom nav en todos los viewports. |
| write buttons | ⚠️ | Estilo y estados base correctos; se requiere QA operativo sin ejecutar acciones destructivas. |

---

## 4) Backlog priorizado (accionable)

| ID | Pri | App | Área | Hallazgo | Impacto | Fix sugerido | Archivos probables | Riesgo | Criterio de aceptación |
|---|---|---|---|---|---|---|---|---|---|
| B5-001 | P1 | public-order | DATOS/formulario | Foco/mensaje post-validación puede no quedar inequívoco en todos los casos manuales | Puede bloquear submit correcto o generar errores repetidos | Ajustar contrato visual de error inline + foco al primer campo inválido (sin tocar payload) | `cloudflare/public-order/app.js`, `cloudflare/public-order/styles.css` | Medio | Primer campo inválido recibe foco visible y mensaje asociado consistente en 320/390/desktop |
| B5-002 | P1 | internal-chekeo | modales/confirmaciones | Validación manual pendiente de foco trap + retorno de foco en confirm modal | Riesgo operativo (acción crítica mal ejecutada o cancelación confusa) | Endurecer manejo de foco y jerarquía de acciones confirmar/cancelar (sin tocar RPC) | `cloudflare/internal-chekeo/app.js`, `cloudflare/internal-chekeo/styles.css` | Alto | Teclado-only: abrir modal, tabular interno, cerrar y retornar foco al disparador siempre |
| B5-003 | P1 | internal-chekeo | write buttons | Falta QA formal de estados loading/disabled en rutas write críticas | Riesgo de doble acción o incertidumbre operativa | Normalizar checklist + lock visual por botón durante write (sin tocar write contract) | `cloudflare/internal-chekeo/app.js`, docs QA | Alto | Nunca se permite doble disparo visualmente; estado loading y disabled consistente |
| B5-004 | P2 | public-order | nav sticky | Posible solape con teclado virtual/foco en pantallas bajas | Afecta usabilidad móvil | Ajuste fino de padding/scroll-margin/altura sticky por breakpoint | `cloudflare/public-order/styles.css` | Bajo-Medio | Ningún input/CTA queda oculto por sticky nav en 320/390 |
| B5-005 | P2 | internal-chekeo | top+bottom nav | Necesidad de verificación de coherencia selected/current y foco | Confusión de navegación | Afinar estados current/selected y feedback visual uniforme | `cloudflare/internal-chekeo/styles.css`, `app.js` | Medio | Cambio de tab refleja estado activo igual en top y bottom nav |
| B5-006 | P2 | public-order | RESUMEN/ticket | Validación manual de legibilidad del total y desglose en casos densos | Confianza del usuario en total final | Ajustes menores de spacing/contraste tipográfico | `cloudflare/public-order/styles.css` | Bajo | Total y líneas de ticket mantienen jerarquía clara en 320/390/tablet |
| B5-007 | P2 | ambas | estados feedback | Inconsistencia potencial en empty/error entre vistas | Reduce claridad y aumenta carga cognitiva | Documentar y aplicar mini estándar visual de estados (sin rediseño) | `docs/ui-visual-system-v1.md`, CSS de ambas apps | Bajo | Estados empty/error/success siguen patrón común mínimo y texto inequívoco |
| B5-008 | P3 | public-order | hero/stepper copy | Oportunidad de copy más directo en microestados de progreso | Mejora incremental UX | Ajustes copy puntuales, sin alterar flujo | `cloudflare/public-order/index.html`, `app.js` | Bajo | Copy más claro, corto y consistente en pasos |
| B5-009 | P3 | internal-chekeo | labels secundarios | Oportunidad de consistencia tonal en subtítulos/badges | Mejora estética menor | Uniformar microcopy de labels secundarios | `cloudflare/internal-chekeo/index.html` | Bajo | Etiquetas secundarias consistentes en tono y formato |
| B5-010 | P3 | docs | QA docs | Consolidar checklist operativo de verificación post-rediseño | Mejora trazabilidad | Actualizar checklist documental de QA por bloques | `docs/ui-redesign-qa-checklist.md` | Bajo | Checklist ejecutable y trazable por viewport + teclado + reduced motion |

---

## 5) Lista de fixes recomendados para el siguiente PR (un solo bloque viable)

### A) Fixes CSS pequeños
1. Ajustes finos de `scroll-margin`/padding sticky en `public-order` para teclado virtual.
2. Ajustes de spacing/contrast tipográfico en `RESUMEN` para densidad alta.
3. Afinación visual de estados `is-active`/focus en top+bottom nav de Chekeo.
4. Ajuste menor de layout modal (max-height + scroll interno) para 320/390.

### B) Ajustes de copy (si aplica)
1. Mensajes breves más explícitos en validación de DATOS.
2. Claridad semántica en confirmaciones críticas de Chekeo (cancelar vs confirmar).

### C) Ajustes de documentación
1. Actualizar checklist de QA con casos obligatorios de foco trap/retorno.
2. Añadir mini guía de “estado visual mínimo” para loading/success/error/empty.

> Nota: No incluir rediseños grandes ni cambios de lógica/contrato en ese PR.

---

## 6) Contratos que deben seguir intactos

## 6.1 Public-order (NO tocar)
- `/api/menu`
- `/api/order`
- `/api/bank-config`
- `/api/order-gate`
- `buildPayload()`
- keys de `localStorage`
- precios/SKUs/menú
- flujo: `MENU > BURGERS > CUSTOM > EXTRAS > GUARNICIONES > DATOS > RESUMEN`

## 6.2 Internal-chekeo (NO tocar)
- `/api/auth`
- `/api/session`
- `/api/logout`
- `/api/rpc`
- nombres/args RPC
- PIN/session/logout
- write actions
- `confirmAction` / `runWrite` / `rpcCall`
- tabs `Inicio / Pedidos / Cocina / Otros`

---

## 7) QA manual recomendado (post-rediseño)

## 7.1 Matriz de viewport

### 320px
1. Abrir ambas apps en 320x568.
2. Verificar ausencia de overflow horizontal.
3. Revisar sticky/bottom nav sin tapar contenido/foco.
4. Abrir modales y confirmar scroll interno + botones visibles.

### 390px
1. Repetir flujo completo de `public-order` hasta submit (sin alterar contratos).
2. En Chekeo, navegar tabs top/bottom + abrir/cerrar modales.
3. Verificar wrap de textos largos en chips/badges/botones.

### Tablet
1. Validar reflow de paneles/cards.
2. Confirmar jerarquía visual y spacing estable entre secciones.

### Desktop
1. Revisar consistencia de estado activo/foco/hover.
2. Validar que modales mantienen tamaño útil y foco visible.

## 7.2 Teclado (obligatorio)
1. Recorrer Tab/Shift+Tab todos los elementos interactivos.
2. Confirmar foco visible siempre.
3. Verificar foco no oculto por sticky/bottom nav.
4. En modales: foco inicial coherente, trampa de foco funcional y retorno al cerrar.

## 7.3 Reduced motion
1. Activar `prefers-reduced-motion: reduce` en SO/DevTools.
2. Confirmar reducción real de transiciones/animaciones.
3. Verificar que loading/success/error siguen comprensibles sin motion.

## 7.4 Submit flow `public-order`
1. Completar flujo completo con combinaciones reales de menú/custom/extras/guarniciones.
2. Forzar errores de DATOS y confirmar foco/mensaje.
3. Revisar resumen y total antes de submit.
4. Validar loading y success panel.

## 7.5 Chekeo modals/writes (sin acciones destructivas)
1. Abrir confirmaciones críticas y siempre cancelar.
2. Probar rutas de detalle/lectura sin ejecutar `closeDay`, `archive`, ni acciones irreversibles.
3. Validar disabled/loading de botones write usando acciones no destructivas cuando exista ruta segura.
4. Confirmar toasts/status sin superposición crítica con bottom nav.

---

## 8) Veredicto

**Requiere fixes antes de validación visual manual**.

Justificación:
- La base post-rediseño está sólida, pero quedan hallazgos P1/P2 centrados en verificación de foco/modal/write states y ajustes móviles finos que deben cerrarse en un PR de fixes pequeños antes del cierre visual final.


## 9) Estado BLOQUE 6 (fixes P1/P2 aplicados)

- [x] B5-001 DATOS/formulario: reforzado `aria-describedby` dinámico, foco al primer error visible y visibilidad de foco en campos con error (sin tocar validaciones ni payload).
- [x] B5-002 Modales/confirmaciones Chekeo: endurecido retorno de foco por modal y mantenido trap + Escape existentes.
- [x] B5-003 Write buttons Chekeo: reforzado estado visual loading/disabled con `aria-disabled` + `aria-busy` por botón.
- [x] B5-004 Sticky nav public-order: ajuste fino de `scroll-padding`/`scroll-margin` móvil 320/390 para evitar solape de foco.
- [x] B5-005 Top/bottom nav Chekeo: afinado estado selected/current (`aria-selected` + `aria-current`) sin cambiar orden/tabs.
- [x] B5-006 Resumen/ticket public-order: pequeños ajustes de legibilidad del total y densidad de líneas en móvil.
- [x] B5-007 Mini estándar feedback: refuerzo visual menor para estados disabled/loading/success/error en ambas apps.
