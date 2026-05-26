# UI redesign QA checklist (Bloque 4)

## Objetivo
Checklist de pulido posterior al rediseño visual controlado para `public-order` e `internal-chekeo`, sin cambios de lógica ni contratos.

## Contratos y límites (NO tocar)
- Endpoints `public-order`: `/api/menu`, `/api/order`, `/api/bank-config`, `/api/order-gate`.
- Endpoints `internal-chekeo`: `/api/auth`, `/api/session`, `/api/logout`, `/api/rpc`.
- `buildPayload()` y estructura de payload en `public-order`.
- Nombres/args de RPC en `internal-chekeo`.
- Keys de `localStorage`.
- Flujo PIN/session/logout, writes y confirmaciones.
- Precios, SKUs, menú, cálculo de total.
- `legacy/`, `BOG_ACTIVE_ENV`, backend, Apps Script, Cloudflare Functions, package/build/config.

## Checklist responsive (mobile-first)
### 320px / 390px
- [ ] Sin overflow horizontal en body, cards, listas y navs.
- [ ] `public-order`: sticky nav no tapa acciones críticas ni foco.
- [ ] `internal-chekeo`: bottom nav usable con target táctil >= 44px.
- [ ] Textos largos hacen wrap en chips, botones y estados.
- [ ] Modales caben en viewport y permiten scroll interno.

### Tablet / Desktop
- [ ] Reflow correcto de grids y paneles.
- [ ] Sin saltos visuales inesperados entre breakpoints.
- [ ] Jerarquía visual y spacing coherentes con visual-system-v1.

## Checklist teclado y foco
- [ ] Focus visible en inputs, botones, tabs y CTAs.
- [ ] El foco no queda oculto por sticky/bottom nav.
- [ ] Navegación por tab cubre top nav + bottom nav en Chekeo.
- [ ] En modales, foco visible en cerrar/cancelar/confirmar.

## Checklist reduced motion
- [ ] Existe `@media (prefers-reduced-motion: reduce)` en ambos CSS.
- [ ] Se reducen animaciones decorativas/transiciones no críticas.
- [ ] Loading sigue entendible aun con motion reducido.

## Checklist visual por aplicación
### public-order
- [ ] Hero/stepper/nav mantienen legibilidad y contraste en móvil.
- [ ] Estados default/hover/focus-visible/active/disabled claros.
- [ ] Estados loading/success/error/empty no dependen solo de color.
- [ ] Resumen/total/acciones de submit mantienen prioridad visual.

### internal-chekeo
- [ ] Tabs top/bottom mantienen estado selected/current coherente.
- [ ] Estados de botones (`write-btn`, `ghost`, `logout`) consistentes.
- [ ] Toast/status/error mantienen contraste y legibilidad.
- [ ] Modales de detalle/confirmación conservan usabilidad en 320px.

## Smoke tests manuales
### public-order
1. Abrir en 320px.
2. Revisar hero, stepper y nav sticky.
3. Completar flujo: burger, custom, extras, guarnición, datos, resumen.
4. Validar errores en DATOS.
5. Validar loading submit.
6. Validar success panel.
7. Validar Cargar/Reiniciar.
8. Revisar reduced motion.

### internal-chekeo
1. Abrir en 320px.
2. Validar PIN.
3. Navegar Inicio/Pedidos/Cocina/Otros top y bottom nav.
4. Abrir/cerrar modal de detalle.
5. Abrir confirmación y cancelar.
6. Validar toast/loading/disabled.
7. Validar logout.
8. Revisar reduced motion.

## Evidencia mínima sugerida en PR
- `git diff --stat`
- `git diff --name-only`
- Confirmación explícita de archivos permitidos solamente.
- Confirmación explícita: sin cambios de API/RPC/payload/backend/deps/legacy/BOG_ACTIVE_ENV.
