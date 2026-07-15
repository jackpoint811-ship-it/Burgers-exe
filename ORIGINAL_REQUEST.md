# Original User Request

## Initial Request — 2026-07-13T12:45:14-06:00

# Teamwork Project Prompt — Final

Corregir 3 debilidades detectadas en la UI de Catálogo y Cocina (fallback de clasificación de ítems en cocina, exposición de banners inactivos en API pública y normalización de teléfonos en checkout).

Working directory: c:\Documentos\Burgers-exe\Preview
Integrity mode: development

## Requirements

### R1. Robustez del Fallback de itemKind en Cocina
Modificar la función `getKitchenItemKind` en `apps/internal-chekeo-v2/src/components/kitchen/kitchen-helpers.ts` para que, en caso de que `item.itemKind` no esté definido, clasifique el ítem analizando su nombre en minúsculas:
- Si incluye "combo" -> clasificar como `"combo"`
- Si incluye "fries", "papas" o "aros" -> clasificar como `"garnish"`
- Si incluye "bebida", "refresco", "agua" o "cola" -> clasificar como `"drink"`
- Por defecto -> `"burger"`

### R2. Ocultar Banners Inactivos en la API Pública y proveer GET Administrativo
- Modificar `functions/api/menu-v2.ts` para restaurar el filtro `WHERE is_active = 1` en la consulta SQL de `catalog_banners`.
- Agregar un handler `onRequestGet` en `functions/api/menu-v2-admin/catalog-banners.ts` que valide el token de administrador (usando `requireAdminToken`) y devuelva la lista completa de banners (activos e inactivos) ordenados por `sort_order`.
- Modificar `apps/internal-chekeo-v2/src/components/CatalogAdminPanel.tsx` para que obtenga la lista de banners de catálogo mediante fetch a `/api/menu-v2-admin/catalog-banners` (con credenciales de admin) en lugar de depender del campo `catalogBanners` de la API pública.

### R3. Normalización Flexible de Teléfono en Checkout
En `apps/public-order-v2/src/components/CatalogCheckoutDrawer.tsx`, mejorar el formateo de teléfonos de modo que si el teléfono normalizado (solo dígitos) tiene 12 dígitos y empieza con "52", remueva el prefijo "52" automáticamente antes de validar que mida exactamente 10 dígitos.

## Acceptance Criteria

### Compilación y Calidad
- [ ] Ejecutar `npm run typecheck` y pasar sin errores.
- [ ] Ejecutar `npm run build:public` y `npm run build:internal` con éxito.

### Verificación Funcional
- [ ] La API pública `/api/menu-v2` debe retornar únicamente banners donde `is_active = 1`.
- [ ] La API administrativa `/api/menu-v2-admin/catalog-banners` (GET) debe retornar todos los banners e integrar la validación de administrador.
- [ ] El panel administrativo del catálogo debe listar tanto los banners activos como inactivos (toggling funcional).
- [ ] Ingresar un teléfono como `+52 55 1234 5678` en Checkout debe normalizarse a `5512345678` y permitir enviar el formulario.
- [ ] El fallback de clasificación de cocina debe agrupar correctamente productos que no provean `itemKind` si sus nombres indican que son combos, guarniciones o bebidas.

## Follow-up — 2026-07-14T19:55:46-06:00

# Teamwork Project Prompt — Draft

Redesign and optimize the `apps/public-order-v2` frontend (specifically Catalog Mode and its sub-components) for Burgers.exe to achieve a clean, professional, and reliable e-commerce aesthetic (leaving behind the screaming cyberpunk neon), implementing a compact multi-column card layout to minimize scroll fatigue, and maintaining robust accessibility and functionality.

Working directory: c:/Documentos/Burgers-exe/Preview
Integrity mode: development

## Requirements

### R1. Professional & Trustworthy E-commerce Redesign (No Neon)
- Redesign the Catalog Mode layout, category navigation, banners, product details, cart, and checkout drawers using a clean, modern, and trustworthy commercial design (e.g., slate/charcoal/indigo minimalist palette, clean card shadows, clear type hierarchy).
- Eliminate neon/cyberpunk glowing borders and fonts. The design must feel professional, stable, and highly conversion-oriented.

### R2. Compact Layout to Minimize Scrolling
- Redesign product cards and catalog layout to use a compact, space-efficient multi-column grid:
  - Mobile: 2 columns grid for product cards (instead of large single-column cards) to display more items per screen height and reduce vertical scroll fatigue.
  - Desktop/Tablet: 3 to 4 columns grid.
- Reduce vertical spacing, padding, and image aspect ratios on product cards while keeping text readable and interactive elements accessible.

### R3. Mobile-First Responsiveness & Ergonomics
- Optimize layout structure across mobile viewports (320px, 390px, 430px) as well as tablet and desktop, with zero horizontal overflow.
- Ensure all interactive components (buttons, links, quantity selectors) have a minimum touch target size of 44x44px.
- Adjust layout margins and scroll padding to handle virtual keyboard overlay during checkout inputs gracefully.

### R4. WCAG 2.2 AA Accessibility & Focus Management
- Implement visible focus rings on all focusable elements.
- Drawers must support keyboard accessibility, including focus traps, esc-key to close, and returning focus to the triggering element upon closing.
- High contrast ratios must be preserved across text and icons. Respect `prefers-reduced-motion: reduce` by disabling or simplifying movement.

### R5. Complete UI State System & Inline Validation
- All interactive components must have visible, styled states for `default`, `hover`, `active`, `focus-visible`, `disabled`, `loading`, `success`, and `error`.
- Form field validation must render clear, inline error messages associated via `aria-describedby` and `aria-invalid` when errors occur.

### R6. Preserve Core Data and Integration Contracts
- All existing API connections (`/api/menu-v2`, `/api/orders-v2`, `/api/raffles-v2`), local package configurations (`@config`, `@ui`), and business logic payloads must remain untouched and fully operational.
- Keep the same-day delivery logic, 50% deposit calculations, and whatsapp opt-ins implemented during conflicts resolution.

## Acceptance Criteria

### Technical Validation
- [ ] `npm run typecheck` executes successfully with no compilation errors.
- [ ] `npm run build:public` executes and builds without errors.
- [ ] Running all tests in `tests/e2e-catalog-kitchen.spec.ts` passes successfully.
- [ ] Running all tests in `tests/catalog-drawer-a11y.spec.ts` passes successfully.

### Visual & Layout Quality
- [ ] There is no horizontal scrollbar or content overflow at viewport widths 320px, 390px, 430px, 768px, and 1280px.
- [ ] Product cards are displayed in a 2-column grid on mobile, and 3-4 columns on desktop, significantly reducing scroll height.
- [ ] Screaming neon green/amber glowing borders are removed and replaced with a clean, professional, slate-indigo based palette.
- [ ] Touch target sizes for all buttons, count increment/decrement buttons, and drawer triggers are at least 44x44px.

### Accessibility (A11y)
- [ ] All interactive elements display a highly visible focus indicator when navigated by keyboard.
- [ ] Open drawers (Product drawer, Cart drawer, Checkout drawer) trap tab focus internally and return focus to their trigger button when closed.
- [ ] Pressing the Escape key closes any open drawer.
- [ ] Screen animations respect `prefers-reduced-motion: reduce`.

## Follow-up — 2026-07-15T02:07:39Z

The user has sent subsequent feedback for the redesign:
- You have complete freedom and are 100% authorized to make any necessary changes to layout, text, positions, and sections (add/remove).
- The focus is solely on Reliability, Visibility, Ease of Use, and ensuring it does NOT conflict with Cloudflare Pages or Chekeo (internal kitchen app/integration contracts).
Please incorporate this instruction into your orchestrator and worker agents.

## Follow-up — 2026-07-15T02:08:52Z

The user has sent subsequent feedback:
- If it is necessary to make changes in Cloudflare or Chekeo, let the parent agent / user know.
Please incorporate this instruction.

## Follow-up — 2026-07-15T13:28:29Z

All subagents and background tasks have been stopped due to a server restart. Please check the current status, resume or restart the Project Orchestrator subagent (ea5a96d4-900b-4c6b-b2c2-aa4b29d531be) and compact layout sub-orchestrator (4b79ab72-6201-4b41-8ee6-eaa22b64f426), and ensure the crons/tasks are re-registered to continue implementing the redesign milestones. Let me know when you have verified the resume.
