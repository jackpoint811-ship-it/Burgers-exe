# Sistema visual v1 — Burgers.exe UI

**Estado:** Propuesta para implementación incremental.

## 1) Objetivo y alcance

Definir un sistema visual compartido v1 para:
- `cloudflare/public-order`
- `cloudflare/internal-chekeo`

Este documento establece lineamientos de diseño y contratos visuales para evolución incremental, sin implementar estilos ni modificar UI funcional en esta fase.

## 2) Principios visuales

1. **Terminal retro:** la base estética debe preservar la identidad tipo consola.
2. **Pixel/gaming:** textura visual de videojuego retro con interfaces legibles.
3. **Verde neón sobre fondo oscuro:** identidad cromática principal de marca.
4. **Humor/meme ligero:** tono divertido y humano, sin afectar claridad operativa.
5. **Glitch controlado:** recurso puntual y decorativo, nunca estructural.
6. **Mobile-first:** decisiones de layout y componentes parten de pantallas pequeñas.
7. **Legibilidad antes que ornamento:** prioridad a lectura, escaneo y comprensión.
8. **Accesibilidad WCAG 2.2 AA:** contraste, foco, semántica y estados robustos.
9. **Performance-first:** UI visualmente rica con peso y complejidad controlados.

## 3) Diferenciación por producto

### `public-order`
- Experiencia cliente de pedido tipo “compilar pedido”.
- Más expresiva y divertida, con personalidad de marca más visible.
- Mayor espacio para microcopy playful y feedback emocional.
- CTA principal y progreso del wizard como ejes visuales dominantes.

### `internal-chekeo`
- Consola operativa de ejecución y control.
- Más densa, clara, sobria y rápida de escanear.
- Prioridad absoluta de seguridad operacional en acciones write.
- Menor carga ornamental para reducir fatiga cognitiva.

## 4) Design tokens conceptuales (sin implementación todavía)

> En PR-3A se definen **nombres y propósito**. La tokenización técnica se mapea en PR-3B/PR-3C.

### 4.1 Color tokens
- `--color-bg-base`: fondo global principal oscuro.
- `--color-bg-surface`: panel/card principal.
- `--color-bg-surface-alt`: panel alterno o secciones secundarias.
- `--color-fg-primary`: texto principal de alta legibilidad.
- `--color-fg-muted`: texto secundario, metadatos y labels de soporte.
- `--color-brand-primary`: verde neón de marca (líneas, acentos, CTA).
- `--color-status-warning`: ámbar para advertencias.
- `--color-status-danger`: rojo para errores/acciones destructivas.
- `--color-status-success`: verde éxito semántico.
- `--color-focus-ring`: color exclusivo para indicador de foco.

### 4.2 Typography tokens
- `--font-family-brand-mono`: tipografía monospace principal.
- `--font-family-ui-system`: tipografía system UI para densidad operativa.
- `--font-size-*`: escala tipográfica por jerarquía.
- `--font-weight-*`: pesos para encabezados, labels y datos críticos.
- `--line-height-*`: alturas de línea por tipo de bloque.

### 4.3 Spacing tokens
- `--space-2xs` a `--space-3xl`: escala de separación vertical/horizontal.
- `--space-touch-min`: separación mínima para interacción táctil.

### 4.4 Radius tokens
- `--radius-sm`, `--radius-md`, `--radius-lg`: redondeos para inputs, cards y modales.

### 4.5 Shadow / glow tokens
- `--shadow-sm`, `--shadow-md`: elevación funcional.
- `--glow-brand-soft`, `--glow-brand-strong`: halo neón controlado.

### 4.6 Border tokens
- `--border-width-*`: grosor de borde por prioridad.
- `--border-color-default`, `--border-color-strong`, `--border-color-focus`.

### 4.7 Motion tokens
- `--motion-duration-fast`, `--motion-duration-base`, `--motion-duration-slow`.
- `--motion-ease-standard`, `--motion-ease-emphasis`.

### 4.8 Z-index / elevation tokens
- `--z-base`, `--z-sticky`, `--z-dropdown`, `--z-modal`, `--z-toast`.

### 4.9 State tokens
- `--state-hover-*`, `--state-active-*`, `--state-disabled-*`, `--state-loading-*`, `--state-success-*`, `--state-error-*`, `--state-selected-*`.

## 5) Paleta recomendada (rangos y propósito)

La paleta final se cerrará al mapear tokens existentes. En esta fase se define intención y contraste AA:

- **Fondo principal oscuro:** negro carbón / verde-negro profundo para maximizar contraste.
- **Panel oscuro:** gris grafito oscuro con separación sutil del fondo.
- **Panel alterno:** tono oscuro ligeramente más claro o más frío para jerarquías secundarias.
- **Texto principal:** casi blanco con tinte frío/verdoso para lectura continua.
- **Texto muted:** gris medio-alto, nunca por debajo de contraste AA en texto normal.
- **Verde neón primario:** acento de marca para CTA, focus visual, indicadores de sistema.
- **Ámbar / warning:** alertas no críticas, atención intermedia.
- **Rojo / danger:** fallos, bloqueo y acciones destructivas.
- **Éxito:** confirmaciones y pasos completados.
- **Focus ring:** color dedicado, perceptible sobre fondo oscuro y no ambiguo con error.

Regla obligatoria: mantener contraste WCAG 2.2 AA en combinaciones de texto/ícono/controles.

## 6) Tipografía

1. **Monospace por defecto** para identidad terminal en ambos productos.
2. **System UI como soporte** cuando `internal-chekeo` necesite mayor densidad/escaneo.
3. Reglas por elemento:
   - **Títulos:** monospace de alto peso, tracking contenido, contraste alto.
   - **Labels:** compactos, claros, estables entre componentes.
   - **Microcopy:** breve, funcional, tono de marca sin sacrificar claridad.
   - **Badges/status:** legibles en tamaño pequeño, mayúsculas moderadas.
   - **Botones:** texto corto, inequívoco, con jerarquía semántica (principal/ghost/danger/write).

## 7) Componentes base a estandarizar

- Panel/card.
- Button.
- Ghost button.
- Danger button.
- Write/action button.
- Chip/badge.
- Input/select/textarea.
- Field error/help text.
- Stepper.
- Tabs.
- Modal.
- Toast/status.
- Empty state.
- Success state.
- Loading state.
- Summary/ticket row.

Cada componente debe documentarse con estructura, jerarquía visual, comportamiento y accesibilidad antes de rediseño visual.

## 8) Estados obligatorios por componente

Cada componente interactivo o de feedback debe contemplar:
- `default`
- `hover`
- `focus-visible`
- `active`
- `disabled`
- `loading`
- `success`
- `error`
- `selected/current`
- `empty`

No se aprueban cambios visuales posteriores sin cobertura explícita de estados.

## 9) Motion guidelines

1. Duraciones cortas y previsibles.
2. Microinteracciones funcionales (confirmar, orientar, anticipar).
3. Ninguna animación puede bloquear tareas operativas.
4. Respetar `prefers-reduced-motion` con reducción real de movimiento.
5. Glitch solo decorativo; nunca para comunicar estado crítico o contenido esencial.

## 10) Accesibilidad

- Contraste mínimo AA en tipografía y controles.
- No depender exclusivamente del color para estado o validación.
- Foco visible persistente y consistente.
- Tamaño táctil mínimo recomendado: 44px.
- Semántica HTML primero; ARIA solo cuando aporte valor real.
- Formularios con ayuda/error asociados por campo.
- Modales con control de foco, retorno de foco y cierre accesible.

## 11) Performance budget visual

- Sin librerías runtime.
- Sin CDNs.
- Sin frameworks.
- Sin build step nuevo.
- Evitar imágenes pesadas y efectos costosos.
- Priorizar SVG/assets locales y reutilizables.
- Preferir animaciones CSS ligeras.
- Evitar layout shifts innecesarios.

## 12) Reglas por app

### `public-order`
- Mantener wizard claro y predecible.
- El CTA principal debe sobresalir siempre.
- El resumen debe sentirse confiable y legible.
- El tono puede ser más playful dentro de límites de claridad.

### `internal-chekeo`
- Priorizar velocidad operativa sobre expresión estética.
- Estados críticos deben distinguirse sin ambigüedad.
- Acciones write deben verse serias, seguras y confirmables.
- Evitar ornamento que distraiga durante operación.

## 13) Plan de implementación incremental

- **PR-3B:** mapear tokens actuales de `public-order/styles.css` sin cambiar look.
- **PR-3C:** mapear tokens actuales de `internal-chekeo/styles.css` sin cambiar look.
- **PR-3D:** normalizar estados `focus`/`disabled`/`loading`.
- **PR-3E:** ajustes visuales Brand Board controlados en `public-order`.
- **PR-3F:** ajustes visuales operator console en `internal-chekeo`.

## 14) Criterios de aceptación de esta fase (PR-3A)

- Solo se crea `docs/ui-visual-system-v1.md`.
- No se toca `cloudflare/public-order`.
- No se toca `cloudflare/internal-chekeo`.
- No se toca `legacy/`.
- No se toca `BOG_ACTIVE_ENV`.
- No se agregan dependencias.
- No se modifica package/build/config.
- No se cambia UI/UX.
- No se cambia backend/API/RPC/Sheets.

## 15) Referencias base consideradas

- `docs/ui-ux-2026-audit-chekeo-and-public-order.md`
- `docs/adr-ui-libraries-2026.md`
- `docs/ui-ux-mobile-first-plan.md`
- `docs/cloudflare-internal-chekeo-phase-0-audit.md`
- `cloudflare/internal-chekeo/README.md`
- `cloudflare/public-order/README.md`
- `deep-research-report-actualizado.md`
