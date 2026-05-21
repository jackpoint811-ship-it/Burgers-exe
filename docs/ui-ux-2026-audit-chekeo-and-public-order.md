# Auditoría UI/UX 2026 — `public-order` + `internal-chekeo` (Burgers.exe / Burger-OG)

## 0) Alcance y restricciones aplicadas

Esta auditoría es **solo de documentación** y cubre:
- `cloudflare/public-order`
- `cloudflare/internal-chekeo`

Restricciones respetadas en esta entrega:
- Sin cambios funcionales ni visuales en los sitios.
- Sin nuevas dependencias, CDNs, frameworks o librerías.
- Sin tocar `legacy/`.
- Sin tocar `BOG_ACTIVE_ENV`.
- Sin cambios de contratos API, Sheets o payloads.
- Mantener ambos sitios separados.

---

## 1) Estado actual por sitio

## 1.1 `cloudflare/public-order` (sitio público)

**Estado general**
- Flujo tipo wizard por pasos (`MENU > BURGERS > CUSTOM > EXTRAS > GUARNICIONES > DATOS > RESUMEN`) con estado local en memoria + `localStorage`.
- Identidad visual ya orientada a terminal/retro con paleta oscura y verde neón.
- Arquitectura frontend monolítica: un `app.js` con estado, render, validaciones, persistencia y submit.

**Fortalezas actuales**
- Estructura de flujo clara por pasos.
- Persistencia de borrador (`v3` con fallback legacy `v2`).
- Base visual alineada en gran medida al brand terminal/glitch.
- Botoneras con mínimo táctil y algunos patrones mobile-first ya presentes.

**Gaps principales 2026**
- Alto acoplamiento (render + lógica + datos en un solo archivo).
- Accesibilidad parcial: hay buenas bases, pero faltan patrones WCAG 2.2 AA consistentes (errores inline por campo, landmarks/ARIA más sistemáticos, estrategia de foco completa por transición de paso).
- Sistema visual no formalizado para escalar como design system compartido (tokens sí, gobernanza no).

## 1.2 `cloudflare/internal-chekeo` (panel interno)

**Estado general**
- App interna operativa separada, con PIN/session, tabs principales, bottom nav y modales de confirmación.
- Frontend también monolítico (un `app.js` amplio con lectura/escritura operativa, render y manejo de estado).
- Estética más “panel utilitario” que “terminal gaming brand system” (hay tonos dark y acentos, pero no está totalmente alineada a la personalidad Burgers.exe).

**Fortalezas actuales**
- Base mobile-first razonable (bottom nav, modales, botones 44px, layout centrado).
- Flujos operativos críticos con confirmación y estados de carga.
- `aria-live` en toast/status y modal confirmatorio con roles básicos.

**Gaps principales 2026**
- Accesibilidad y consistencia semántica incompletas (foco en modales, navegación por tabs, jerarquía de encabezados, equivalencia entre top tabs y bottom nav).
- Visual system distinto al de `public-order` (tokens y lenguaje UI no convergentes).
- Deuda de mantenibilidad en JS/CSS minificado/compactado.

---

## 2) Inventario de componentes

## 2.1 Inventario `public-order`
- **Estructura**: `main.app`, `panel`, `hero`, `status`.
- **Navegación**: stepper (track + chips), botones `Atrás/Siguiente/Cargar/Reiniciar`.
- **Selección de menú**: cards de producto (`menu-item`), contadores +/-.
- **Personalización**: cards de burger unit + opciones “sin/extra”.
- **Formulario datos**: nombre, teléfono, ubicación, método de pago, nota.
- **Resumen**: ticket final, total, CTA submit.
- **Estados**: éxito, loading submit, gate de pedidos cerrados, errores en status.
- **Persistencia**: localStorage draft + restore legacy.

## 2.2 Inventario `internal-chekeo`
- **Auth shell**: pantalla PIN (`pin-screen`) + tarjeta de acceso.
- **App shell**: header, badge de sesión, botón salir.
- **Navegación**: top tab nav + bottom nav redundante.
- **Vistas**: Inicio, Pedidos, Cocina, Otros.
- **Listados/cards**: pedidos, chips de filtros, bloques de resumen/diagnóstico.
- **Modales**: modal de detalle + modal de confirmación.
- **Feedback**: status toast, error states, disabled/loading en acciones write.
- **Acciones operativas**: cambios de estado, pago, notas, cierres/histórico según modo.

---

## 3) Hallazgos priorizados (P1/P2/P3)

## P1 — Críticos (accesibilidad/uso/operación)

1. **Gestión de foco incompleta en transiciones dinámicas de contenido** (ambos sitios).
2. **Errores de formularios y validación con baja asociación campo↔mensaje** (especialmente `public-order`).
3. **Tabs duplicadas (top + bottom) sin contrato de accesibilidad robusto y sincronización semántica completa** (`internal-chekeo`).
4. **Monolito JS que aumenta riesgo de regresión en cambios UX** (ambos).

## P2 — Importantes (consistencia visual/sistema)

1. **Tokens/estilos no convergentes entre sitios** (dos lenguajes visuales cercanos pero no unificados).
2. **Jerarquía tipográfica y spacing no totalmente estandarizados por componente**.
3. **Estados interactivos (`hover/focus/active/disabled/loading`) no definidos como contrato transversal único**.

## P3 — Mejora evolutiva

1. **Microcopy y tono de voz** aún no 100% sistematizados en clave “terminal + meme ligero” para todos los estados.
2. **Patrones de empty/error/success** podrían compartir plantillas de UI para reducir variabilidad.
3. **Documentación de design tokens** puede ampliarse a un “UI kit operativo” sin frameworks.

---

## 4) Riesgos de tocar cada área

## 4.1 Riesgos `public-order`
- **Wizard/steps**: riesgo alto (romper navegación, validación o payload final).
- **Estado/persistencia draft**: riesgo alto (pérdida de pedido o restauración incorrecta).
- **Resumen/submit**: riesgo crítico (impacto directo en orden enviada).
- **Styles globales**: riesgo medio-alto (regresión visual transversal).

## 4.2 Riesgos `internal-chekeo`
- **Acciones write operativas**: riesgo crítico (impacto en operación real).
- **Navegación tabs + filtros**: riesgo alto (ocultar/duplicar acciones, confusión de contexto).
- **Modales confirmación**: riesgo alto (ejecuciones no deseadas si falla bloqueo).
- **Auth shell (PIN/session UI)**: riesgo alto (bloqueo de acceso o UX insegura).

## 4.3 Riesgos transversales
- Cambios visuales sin guía de tokens pueden romper coherencia de marca.
- Cambios de estructura DOM pueden romper bindings JS existentes.
- Refactors grandes en un solo PR incrementan riesgo de rollback complejo.

---

## 5) Propuesta de sistema visual compartido (sin mezclar apps)

Objetivo: **sistema común de lenguaje visual**, manteniendo repositorios/entradas separadas.

## 5.1 Principios
- **Terminal retro + pixel + neón** como base.
- **Legibilidad primero** (operación y conversión > ornamento).
- **Glitch ligero, no intrusivo** (decorativo, nunca funcional).
- **Mobile-first por defecto**.

## 5.2 Capa de tokens compartidos (conceptual)
- **Color**: fondo, panel, panel-alt, línea neón, texto, texto-muted, peligro, éxito, advertencia, focus ring.
- **Tipografía**: stack monospace para identidad + stack UI para densidad operativa cuando aplique.
- **Spacing/radius/shadow**: escala única.
- **Motion**: duraciones cortas y accesibles; respetar `prefers-reduced-motion`.

## 5.3 Componentes base a homologar (sin implementar aún)
- Button (primary/secondary/ghost/danger/write)
- Card/panel
- Badge/chip
- Stepper/tab
- Input/select/textarea + error/help text
- Toast/alert
- Modal confirm
- Empty/error/success states

## 5.4 Gobernanza
- Mantener estilos por app separados, pero con **contrato de tokens y estados compartido** documentado.
- Evitar divergencia de naming CSS entre apps nuevas.

---

## 6) Reglas de accesibilidad WCAG 2.2 AA (aplicables a fase siguiente)

1. **Contraste mínimo AA**
   - Texto normal: 4.5:1.
   - Texto grande/UI crítica: 3:1.
2. **Foco visible obligatorio** en todos los elementos interactivos.
3. **Navegación por teclado completa** (sin trampas de foco).
4. **Targets táctiles** mínimo 44x44 CSS px.
5. **Form errors accesibles**
   - `aria-invalid`, `aria-describedby`, mensaje asociado por campo.
6. **Landmarks y semántica**
   - `header/nav/main/section/footer` con jerarquía de headings consistente.
7. **Modales accesibles**
   - `role="dialog"`, `aria-modal="true"`, focus trap y retorno de foco al cerrar.
8. **Estados dinámicos anunciables**
   - `aria-live` para toasts/status relevantes.
9. **Motion safety**
   - Respetar `prefers-reduced-motion`.
10. **No depender solo de color** para estado (añadir ícono/texto/patrón).

---

## 7) Checklist mobile-first (para ejecución posterior)

- [ ] 320/360/390/430 px sin overflow horizontal.
- [ ] Safe areas (`env(safe-area-inset-*)`) validadas.
- [ ] CTA principal siempre alcanzable en flujos largos.
- [ ] Teclado virtual no tapa campos críticos ni CTAs.
- [ ] Scroll y foco estables al cambiar de paso/tab/modal.
- [ ] Bottom nav usable con pulgar y sin solapar contenido.
- [ ] Inputs con `inputmode` correcto y labels persistentes.
- [ ] Estados loading claros para evitar doble tap.
- [ ] Performance visual sin jank (transiciones cortas y estables).
- [ ] Modo landscape aceptable en móviles pequeños.

---

## 8) Plan incremental de PRs (documentación -> implementación)

## PR-1 (base técnica sin cambio visual)
- Objetivo: desacoplar JS por módulos internos (estado/render/validación/events) conservando IDs, pasos y payloads.
- Riesgo: medio.
- Validación: smoke funcional completo sin regresiones.

## PR-2 (accesibilidad estructural)
- Objetivo: foco, semántica, errores de formulario accesibles, modales/tabs WCAG.
- Riesgo: medio-alto.
- Validación: teclado-only + lector básico + mobile QA.

## PR-3 (sistema visual compartido v1)
- Objetivo: converger tokens/estados/componentes base entre apps sin unificarlas físicamente.
- Riesgo: medio.
- Validación: comparación visual y contraste AA.

## PR-4 (mobile hardening)
- Objetivo: ajustes de spacing, sticky nav/CTA, teclado, safe areas, densidad táctil.
- Riesgo: medio.
- Validación: matriz de dispositivos y viewport QA.

## PR-5 (microcopy + estados avanzados)
- Objetivo: estandarizar tono Brand Board (terminal/meme), empty/error/success.
- Riesgo: bajo-medio.
- Validación: checklist UX de claridad y reducción de errores.

---

## 9) Archivos que NO deben tocarse (explícito)

- `legacy/` (todo el árbol).
- Cualquier archivo/constante relacionada con `BOG_ACTIVE_ENV`.
- Contratos backend/API/Sheets y payloads existentes.
- Para la **siguiente fase de implementación UI/UX**:
  - No tocar endpoints/functions para cambiar contratos.
  - No mezclar código de `public-order` con `internal-chekeo`.

En esta fase documental, adicionalmente **no se tocaron**:
- `cloudflare/public-order/index.html`
- `cloudflare/public-order/styles.css`
- `cloudflare/public-order/app.js`
- `cloudflare/internal-chekeo/index.html`
- `cloudflare/internal-chekeo/styles.css`
- `cloudflare/internal-chekeo/app.js`

---

## 10) Criterios de aceptación para la siguiente fase

La siguiente fase (implementación) se considera aceptada si:

1. Mantiene separación estricta entre `public-order` e `internal-chekeo`.
2. No introduce dependencias externas/CDN/frameworks.
3. No modifica contratos API, Sheets, ni payloads.
4. No toca `legacy/` ni `BOG_ACTIVE_ENV`.
5. Cumple WCAG 2.2 AA en contraste, foco y formularios.
6. Pasa checklist mobile-first en viewports objetivo.
7. Implementa cambios por PRs pequeños con rollback claro.
8. Mantiene estética Brand Board Burgers.exe (terminal + pixel + neón + glitch ligero + humor).
9. Incluye evidencia de QA manual por flujo crítico.
10. Conserva comportamiento funcional existente (sin regresión operativa/comercial).

---

## 11) Conclusión ejecutiva

- Ambos sitios tienen una base sólida y separada para evolucionar.
- La prioridad 2026 no es “rediseñar por estética”, sino **formalizar accesibilidad + sistema visual + mantenibilidad** sin tocar contratos.
- Recomendación: iniciar implementación con PR-1 (desacople técnico sin cambios visuales), luego PR-2 (accesibilidad), y después convergencia visual incremental.
