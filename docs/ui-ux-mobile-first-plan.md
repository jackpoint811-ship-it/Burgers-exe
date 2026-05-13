# Fase 0 — Auditoría técnica UI/UX Burger-OG (página pública de pedidos)

## Alcance y hallazgos clave

- **Implementación pública activa identificada:** `cloudflare/public-order/index.html` + `cloudflare/public-order/app.js` + `cloudflare/public-order/styles.css`.
- **Backoffice Apps Script (`Index.html`, `styles.html`, `scripts.html`)** existe, pero corresponde al panel interno de operación/cocina, no al flujo público de pedido para cliente final.
- **Contrato de envío de pedido:** la UI pública envía a `POST /api/order` (Cloudflare Functions), que reenvía hacia Google Apps Script `doPost` (`action=createPublicOrder`) con validaciones de total, SKUs y personalizaciones.

---

## 1) Mapa de archivos relevantes

### A. Página pública de pedidos (frontend cliente)

1. **Layout principal / estructura base**
   - `cloudflare/public-order/index.html`
   - Define shell principal (`<main class="app">`), hero, contenedor stepper (`#stepper`), contenedor dinámico por paso (`#stepContent`), barra de navegación (`#backBtn`, `#nextBtn`, `#loadLastBtn`, `#clearBtn`), panel de éxito y consola de estado (`#status`).

2. **Estilos globales de la página pública**
   - `cloudflare/public-order/styles.css`
   - Incluye variables CSS raíz, layout de paneles, grid de cards (`.menu-grid`), estilos de stepper (`.step`), botones y media query desktop (`@media(min-width:760px)`).

3. **Cards de productos (burgers/extras/guarniciones)**
   - `cloudflare/public-order/app.js`
   - `MENU` define catálogo local (burgers/sides/extras).
   - `cardList(items, qtyObj)` renderiza `<article class="menu-item">` con ícono, precio, descripción y controles +/- según paso.

4. **Navegación por pasos (wizard)**
   - `cloudflare/public-order/app.js`
   - `STEPS = ['MENU','BURGERS','CUSTOM','EXTRAS','GUARNICIONES','DATOS','RESUMEN']`.
   - `renderStepper()`, `renderStep()`, `toggleNav()`, `redraw()` controlan la progresión visual y funcional.

5. **Botones siguiente/atrás**
   - `cloudflare/public-order/index.html` (botones físicos)
   - `cloudflare/public-order/app.js` (listeners de `#backBtn` / `#nextBtn`, validación por paso con `validate()`).

6. **Formulario de datos (cliente)**
   - `cloudflare/public-order/app.js`
   - Se renderiza en paso `DATOS`: nombre, teléfono, ubicación, forma de pago, nota.
   - Actualiza `state.customer` vía listeners `input` y `change`.

7. **Resumen del pedido**
   - `cloudflare/public-order/app.js`
   - Paso `RESUMEN` calcula total (`calcTotal()`), muestra detalle por burger + guarniciones + datos cliente y botón submit.
   - `renderPaymentInfo()` consume `/api/bank-config` para “Pagar Antes”.

8. **Persistencia (pedido anterior / localStorage)**
   - `cloudflare/public-order/app.js`
   - `STORAGE_KEY = 'bog_public_order_draft_v3'`, `LEGACY_KEY = 'bog_public_order_draft_v2'`.
   - `saveDraft()`, `loadDraft()`, `restore()`; botones “LOAD LAST ORDER” y “NEW ORDER / CLEAR SAVE”.
   - **No hay cookies; persistencia es localStorage.**

9. **Manejo de estado del pedido**
   - `cloudflare/public-order/app.js`
   - `state` central: `step`, `burgerUnits`, `sidesQty`, `customer`, `ts`.
   - Construcción de payload con `buildPayload()`, validación con `validate()`, envío con `submit()`.

10. **Assets / placeholders visuales**
   - `cloudflare/public-order/assets/*`
   - Logos, íconos de SKUs, fondos, estados terminal, badges.
   - Referencias directas desde `index.html` y `app.js` (`SKU_ICONS`).

### B. Integración de API pública (impacta UX aunque no sea UI)

11. **Endpoint de orden pública (Cloudflare)**
   - `cloudflare/public-order/functions/api/order.js`
   - Recibe payload frontend y lo puentea a Apps Script.

12. **Endpoint de datos bancarios (Cloudflare)**
   - `cloudflare/public-order/functions/api/bank-config.js`
   - Alimenta bloque dinámico de pago en resumen.

13. **Validación y escritura final en Sheets (Apps Script)**
   - `Code.gs` (`doPost`, `bogHandleJsonPost_`)
   - `backend_public_order_service.gs` (`bogCreatePublicOrderFromCloudflare_` y validadores de payload/personalización).

---

## 2) Diagnóstico de problemas actuales

1. **Acoplamiento alto entre UI, datos y render**
   - `app.js` concentra catálogo, estado, render HTML por strings, validación, persistencia y submit en un único archivo IIFE.
   - Complica refactors UX puntuales sin riesgo colateral.

2. **Render por `innerHTML` monolítico por paso**
   - `renderStep()` reemplaza completo `#stepContent` en cada transición.
   - Riesgo de pérdida de foco/scroll y degradación de accesibilidad mobile (teclado/lector).

3. **Escalabilidad limitada del layout**
   - CSS comprimido y global, con pocos tokens y una sola media query principal.
   - Falta capa de componentes visuales consistente para cards, formularios y navegación sticky.

4. **Validación UX mínima**
   - Hay validación funcional (`validate()`), pero poca guía contextual inline (errores campo a campo).
   - Mensajes van a `#status` tipo terminal; útil para debug pero poco claro para usuario final.

5. **Persistencia sin versionado robusto de esquema**
   - Hay fallback v2→v3, pero `restore()` asume estructuras concretas; cambios futuros de estado pueden romper drafts antiguos.

6. **Dependencia de catálogo hardcodeado en frontend**
   - `MENU`, precios y textos están en `app.js`; cualquier cambio requiere deploy frontend y debe seguir exacto con backend para evitar rechazos por total inconsistente.

7. **Accesibilidad y ergonomía mobile mejorables**
   - Botones +/- y step chips podrían quedar pequeños según densidad de contenido.
   - No se observa manejo explícito de focus, landmark/ARIA por paso ni feedback accesible de errores por campo.

---

## 3) Riesgos de tocar cada área

1. **Layout principal (`index.html`)**
   - Riesgo medio: cambios estructurales pueden romper bindings por `id` usados en `app.js`.

2. **Estilos globales (`styles.css`)**
   - Riesgo medio-alto: reglas globales compactas afectan múltiples vistas/pasos a la vez.

3. **Cards de productos (`cardList`, `.menu-item`)**
   - Riesgo medio: cambios visuales pueden impactar controles +/- y eventos delegados.

4. **Navegación por pasos (`STEPS`, `renderStep`, `toggleNav`)**
   - Riesgo alto: alteraciones de orden o flujo rompen validación, resumen y payload.

5. **Botones siguiente/atrás (listeners nav)**
   - Riesgo medio-alto: cualquier cambio en enabled/disabled/display puede bloquear avance o permitir submit inválido.

6. **Formulario de datos (`DATOS`)**
   - Riesgo alto: campos requeridos están validados también en backend; diferencias de nombres/valores pueden romper creación de pedido.

7. **Resumen y submit (`RESUMEN`, `buildPayload`, `submit`)**
   - Riesgo muy alto: errores aquí impactan montos, consistencia de extras, aceptación backend.

8. **Persistencia localStorage (`saveDraft/loadDraft/restore`)**
   - Riesgo medio: cambios de esquema pueden invalidar recuperación de pedido previo.

9. **Estado del pedido (`state`)**
   - Riesgo muy alto: es columna vertebral del flujo; ajustes sin migración rompen múltiples pasos.

10. **Assets y placeholders (`assets/`)**
    - Riesgo bajo-medio: cambios de rutas/nombres causan imágenes rotas; baja criticidad funcional.

11. **Contratos API/Sheets (`functions/api/*.js`, `Code.gs`, `backend_public_order_service.gs`)**
    - Riesgo crítico: no deben cambiarse sin autorización por reglas del proyecto; impacta integridad de datos en producción.

---

## 4) Plan de fases recomendado (UI/UX mobile first)

### Fase 1 — Hardening base UX sin cambiar contrato
- Objetivo: mejorar estructura interna y legibilidad sin alterar payload/flujo.
- Acciones:
  - Separar `app.js` por módulos lógicos internos (estado, render, validación, persistencia) manteniendo mismos IDs, steps y payload final.
  - Introducir utilidades de render para reducir `innerHTML` gigante por bloque.
  - Añadir capa de mensajes inline no intrusiva (sin `alert()`) manteniendo `#status` como debug.

### Fase 2 — Sistema visual mobile first
- Objetivo: mejorar consistencia visual y usabilidad táctil.
- Acciones:
  - Refactor de `styles.css` a secciones (tokens/base/layout/components/utilities).
  - Establecer tamaños táctiles mínimos (44px), espaciado vertical y jerarquía tipográfica clara.
  - Revisar contraste y estados focus/active/disabled.

### Fase 3 — Flujo por pasos y navegación
- Objetivo: reducir fricción de avance/retroceso.
- Acciones:
  - Mejorar stepper (estado actual, completado, pendiente) con mejor feedback.
  - Persistir/recuperar posición y scroll por paso cuando aplique.
  - Hacer barra de navegación más robusta en mobile (sticky segura con teclado).

### Fase 4 — Formularios y validaciones UX
- Objetivo: disminuir errores de captura.
- Acciones:
  - Validación inline por campo (nombre/teléfono/ubicación/pago).
  - Microcopy contextual y mensajes de error accesibles.
  - Normalización visual de controles `input/select/textarea/radio`.

### Fase 5 — Resumen y confirmación final
- Objetivo: aumentar confianza antes de envío.
- Acciones:
  - Mejorar legibilidad de líneas de ticket, subtotales y total final.
  - Reforzar estados de envío (idle/loading/success/error) sin alterar API.
  - Clarificar módulo de pago (mismo día vs pagar antes) con fallback explícito.

### Fase 6 — QA integral + hardening de persistencia
- Objetivo: estabilizar en dispositivos reales.
- Acciones:
  - Matriz de pruebas manuales mobile-first.
  - Ensayos con drafts antiguos y migración segura de localStorage versionado.
  - Verificación de no regresión sobre payload aceptado por backend.

---

## 5) ¿Qué fase debe ser el primer PR de implementación?

**Recomendación: iniciar con la Fase 1 (Hardening base UX sin cambiar contrato).**

Razón:
- Es el mejor punto de entrada para reducir riesgo técnico antes de tocar diseño visible.
- Permite preparar terreno para mobile-first real en fases siguientes sin romper lógica de negocio ni contratos de Sheets.
- Cumple la restricción de “no cambios visuales todavía” mientras baja deuda técnica del frontend público.

---

## 6) Checklist mobile first

- [ ] Viewport correcto y probado en 320px, 360px, 390px, 430px.
- [ ] Controles táctiles críticos con alto mínimo de toque (~44px).
- [ ] Tipografía legible sin zoom manual.
- [ ] Navegación por pasos usable con una sola mano.
- [ ] Botones primarios/ secundarios siempre visibles en flujo largo.
- [ ] Formularios compatibles con teclado móvil (autofocus contextual, sin saltos de layout).
- [ ] Contraste AA mínimo para textos y controles.
- [ ] Estados `focus` visibles (accesibilidad teclado/assistive).
- [ ] Sin overflow horizontal en ningún paso.
- [ ] Manejo de safe-area (notch/home indicator) validado.
- [ ] Carga de imágenes optimizada y sin layout shift excesivo.

---

## 7) Checklist de pruebas manuales

### Flujo funcional
- [ ] Crear pedido completo OG/BBQ con extras y guarniciones.
- [ ] Avanzar/retroceder entre pasos sin perder estado.
- [ ] Validación bloquea avance cuando faltan datos obligatorios.
- [ ] Resumen refleja exactamente selección y total.
- [ ] Submit exitoso a `/api/order`.

### Persistencia
- [ ] Guardado automático en localStorage durante captura.
- [ ] “LOAD LAST ORDER” restaura correctamente.
- [ ] “NEW ORDER / CLEAR SAVE” limpia draft y reinicia flujo.
- [ ] Compatibilidad con drafts legado (`v2`) verificada.

### Integración
- [ ] `Pagar Antes` muestra datos de `/api/bank-config` o fallback controlado.
- [ ] Payload enviado mantiene estructura esperada por backend Apps Script.
- [ ] Totales coinciden con validación backend (sin rechazo por inconsistencia).

### UX mobile
- [ ] Pruebas en iOS Safari y Android Chrome (al menos un dispositivo real cada uno).
- [ ] Teclado móvil no tapa acciones principales en paso DATOS.
- [ ] Rendimiento aceptable en red móvil (sin bloqueos al navegar pasos).

---

## Notas de cumplimiento con reglas del proyecto

- No se propone uso de librerías externas/CDNs/frameworks.
- No se toca `legacy/`.
- No se proponen cambios a `BOG_ACTIVE_ENV`.
- No se proponen cambios de contrato Sheets/API sin autorización.
- No se usa `alert()`.
- Enfoque explícito mobile first y cambios por PR incremental.
