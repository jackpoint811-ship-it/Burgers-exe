# Modo Catálogo — diagnóstico y contrato técnico PR 1

> Estado: propuesta técnica no disruptiva. Este documento no cambia contratos existentes ni activa UI nueva.
> Alcance: auditar convivencia entre Modo Flujo actual y futuro Modo Catálogo para preparar PRs pequeños.

## 1. Resumen ejecutivo

Burgers.exe ya tiene las piezas principales para un catálogo público, pero hoy están optimizadas para el **Modo Flujo** guiado: menú `menu-v2`, checkout personalizado, creación de pedidos `orders-v2`, panel Chekeo, cocina, pagos y tickets. El Modo Catálogo debe agregarse como un modo paralelo, no como reemplazo.

La ruta más segura es introducir primero configuración pública versionada y contratos aditivos. El flujo actual debe seguir leyendo `MenuV2Response` y enviando `CreateOrderV2Payload` sin cambios obligatorios. El Modo Catálogo debería usar endpoints y tablas compatibles/aditivas hasta que Chekeo pueda editar configuración, productos tipo catálogo, banners y reglas de pago.

Recomendación de arquitectura:

- Mantener **Modo Flujo** como default (`publicMode: "flow"`, `catalogEnabled: false`).
- Añadir una capa de **public config** consultable por la app pública antes de decidir qué experiencia renderizar.
- Modelar catálogo como extensión de `menu_items` o como vista/tabla dedicada, pero exponerlo al frontend como `Product[]` con `ProductType` explícito.
- Mantener pedidos actuales `orders_v2` intactos y agregar campos/tablas aditivas para pedidos programados y pagos parciales.
- Crear banners independientes de categorías actuales: 3 secciones (`banner-section-1..3`) con 0/1/2+ imágenes activas.

Si en PRs siguientes se decide migrar `orders-v2` a pagos parciales y estados manuales con fuerte impacto operativo, conviene usar GPT-5.5 para diseñar y revisar la transición completa.

## 2. Uso de Graphify

La skill `graphify` fue solicitada como obligatoria, pero no está disponible en esta sesión. Para no bloquear el PR, se hizo un diagnóstico equivalente con inspección local:

- Inventario de archivos con `rg --files` excluyendo `legacy/`.
- Búsqueda de símbolos y acoplamientos por `catalog`, `menu`, `order`, `payment`, `ticket`, `banner`, `scheduled`, `delivery`, `api`.
- Lectura dirigida de contratos TypeScript, app pública, Chekeo, migraciones y servicios backend.

Comunidades/nodos relevantes detectados:

| Comunidad | Archivos principales | Rol | Acoplamientos |
| --- | --- | --- | --- |
| Contratos compartidos | `packages/config/src/contracts.ts`, `packages/config/src/mock-data.ts`, `packages/config/src/index.ts` | Tipos, mock/fallback del menú, pedidos, raffle y config bancaria | Public app, Chekeo, backend D1 |
| Public Order V2 | `apps/public-order-v2/src/components/PublicOrderApp.tsx`, `apps/public-order-v2/src/lib/menu-v2.ts`, `apps/public-order-v2/src/lib/orders-v2.ts`, `apps/public-order-v2/src/lib/order.ts` | Modo Flujo actual, menú, carrito personalizado, checkout y confirmación | `MenuV2Response`, `CreateOrderV2Payload`, `/api/menu-v2`, `/api/orders-v2` |
| Chekeo V2 | `apps/internal-chekeo-v2/src/components/InternalChekeoApp.tsx`, `apps/internal-chekeo-v2/src/components/CatalogAdminPanel.tsx`, `apps/internal-chekeo-v2/src/lib/orders-v2-admin.ts`, `apps/internal-chekeo-v2/src/lib/ingredients-v2-admin.ts` | Admin, catálogo existente, pedidos, pagos, cocina, ingredientes | `/api/menu-v2`, `/api/orders-v2/*`, recetas, banners por categoría |
| Cloudflare/public functions | `cloudflare/public-order/app.js`, `cloudflare/public-order/index.html`, `cloudflare/public-order/tickets/*` | Build público desplegable y assets estáticos generados | App pública; no editar manualmente salvo flujo de build |
| Cloudflare/internal functions | `cloudflare/internal-chekeo/functions/api/*.js`, `cloudflare/internal-chekeo/functions/_shared/auth.js` | Gate de sesión y RPC interna | Chekeo admin |
| Backend Apps Script | `Code.gs`, `backend_public_order_service.gs`, `backend_orders_service.gs`, `backend_ticket_service.gs`, `backend_sheets_service.gs`, `backend_validation.gs` | Puente histórico/Sheets y endpoints Apps Script | Menú live, creación de pedidos, tickets, pagos |
| Persistencia D1 | `migrations/*.sql` | Schema de menú, pedidos, raffle, banners de categoría, stock, recetas | Workers/API y Chekeo |

## 3. Archivos revisados

### Flujo público

- `apps/public-order-v2/src/components/PublicOrderApp.tsx`: contiene el estado principal del flujo guiado, secciones, carga de menú, carrito, personalización, checkout, creación de pedido y éxito.
- `apps/public-order-v2/src/lib/menu-v2.ts`: carga `/api/menu-v2` y cae a mock/fallback local.
- `apps/public-order-v2/src/lib/orders-v2.ts`: envía `CreateOrderV2Payload` a `/api/orders-v2` con `Idempotency-Key`.
- `apps/public-order-v2/src/lib/order.ts`: helpers de carrito, totales y validación del checkout actual.
- `apps/public-order-v2/src/styles.css` y `apps/public-order-v2/src/tickets.css`: estilos del flujo público y consulta de tickets.

### Chekeo/admin

- `apps/internal-chekeo-v2/src/components/InternalChekeoApp.tsx`: shell principal de Chekeo.
- `apps/internal-chekeo-v2/src/components/CatalogAdminPanel.tsx`: edición de items, promos, banners por categoría e ingredientes.
- `apps/internal-chekeo-v2/src/lib/orders-v2-admin.ts`: endpoints admin para listar, estado, pago, archivo y cocina.
- `apps/internal-chekeo-v2/src/components/kitchen/*`: cocina y helper de producción.
- `apps/internal-chekeo-v2/src/lib/order-ticket-image.ts` y `apps/internal-chekeo-v2/src/lib/whatsapp.ts`: ticket/WhatsApp interno.

### Contratos y datos

- `packages/config/src/contracts.ts`: fuente compartida de tipos para menú, pedidos, pagos, raffle, cocina e ingredientes.
- `packages/config/src/mock-data.ts`: fallback de menú, categorías, promos y pedidos mock.
- `migrations/0001_v2_menu_schema.sql`, `0002_v2_menu_seed.sql`, `0003_v2_orders_schema.sql`, `0006_public_live_menu_d1_schema.sql`, `0010_catalog_creation_stock_category_banners.sql`, `0011_ingredients_recipe_summary.sql`, `0012_add_combo_bbq_live.sql`: base de menú, pedidos, stock, banners por categoría y recetas.

### Backend/helper histórico

- `Code.gs`: expone acciones Apps Script como `createPublicOrder` y `getPublicMenuLive`.
- `backend_public_order_service.gs`: creación/lectura pública histórica.
- `backend_orders_service.gs`: operaciones de pedidos y pagos.
- `backend_ticket_service.gs`: datos de ticket.
- `backend_sheets_service.gs` y `backend_validation.gs`: persistencia/validación Sheets.

## 4. Diagnóstico técnico

### 4.1 Estado actual del menú

El menú actual vive en dos capas:

1. Contratos/fallback TypeScript: `MenuCategory`, `MenuItem`, `PromoCard`, `MenuCategoryBanner`, `MenuV2Response`.
2. Persistencia D1/migraciones: `menu_categories`, `menu_items`, `promo_cards`, `site_config`, `menu_category_banners`, ingredientes/recetas.

`MenuItem.category` ya distingue `burgers`, `combos`, `extras`, `guarniciones` y `drinks`. Sin embargo, el Modo Catálogo necesita un `ProductType` explícito (`burger | combo | side | topping`) y reglas de edición/visibilidad separadas. Hoy los toppings se parecen más a `extras`; guarniciones usan `guarniciones`; combos existen como categoría y/o promos. Se recomienda mapear sin romper:

- `burgers` -> `ProductType: "burger"`.
- `combos` o promos migradas -> `ProductType: "combo"`.
- `guarniciones` -> `ProductType: "side"`.
- `extras` con tag `addon`/futuro flag -> `ProductType: "topping"`.

### 4.2 Estado actual de pedidos y pagos

`orders-v2` usa `OrderV2PaymentStatus = "pending" | "paid" | "cancelled"` y `OrderV2Status = "new" | "preparing" | "ready" | "delivered" | "cancelled"`. Esto no alcanza para anticipo 50%, validación manual, pago rechazado ni remanente. El contrato público actual `CreateOrderV2Payload` tampoco incluye `scheduledDate`, `deliveryWindow`, `paymentRule`, `paidAmount` o `remainingAmount`.

Para compatibilidad, no se debe mutar semántica de `paymentStatus` inmediatamente. El Modo Catálogo puede usar campos aditivos:

- `order_mode_variant` o `public_mode = "flow" | "catalog"`.
- `scheduled_date` y `delivery_window_json`.
- `payment_rule`, `payment_required_percent`, `payment_required_amount_cents`, `payment_paid_amount_cents`, `payment_remaining_amount_cents`, `payment_validation_status`.
- Eventos de pago en `order_events_v2` para auditoría manual.

### 4.3 Estado actual de banners

Chekeo ya maneja banners por categoría con `menu_category_banners`, diseñados para la Main Quest actual. El Modo Catálogo requiere **3 secciones independientes**, no atadas a categorías. Deben ser entidades nuevas o una extensión claramente separada:

- `catalog_banner_sections`.
- `catalog_banner_images`.

Reglas de render:

- 0 imágenes activas: no renderizar sección.
- 1 imagen activa: render fijo.
- 2+ imágenes activas: carrusel dentro de esa sección.
- Las 3 secciones se ordenan y evalúan de forma independiente.

### 4.4 Estado actual de configuración pública

`SiteConfig` guarda marca, moneda, modos de pedido, soporte, CTA y notice. No tiene `publicMode`, `catalogEnabled`, horarios de recepción, ventana de entrega, tema, layout, reglas de anticipo ni estado visible al cliente. Se recomienda no sobrecargar `SiteConfig` sin versionado; crear un contrato nuevo de `PublicConfig` y `CatalogSettings`, y luego decidir si se persiste en `site_config` como JSON o tablas dedicadas.

### 4.5 UX del Modo Catálogo

La evaluación UX con `ui-ux-pro-max` recomienda tratar catálogo como experiencia tipo food/e-commerce móvil: cards claras, navegación de categorías, carrito persistente, imágenes de calidad, CTA prominente, foco visible, contraste y movimiento reducible. En este PR no se implementa rediseño. Para PRs futuros, el cambio de estética profesional debe planearse como polish incremental para no romper el tono actual ni el aprendizaje mobile-first.

## 5. Modelo de datos propuesto

### 5.1 Public config

```ts
type PublicMode = "flow" | "catalog";

type PublicConfig = {
  publicMode: PublicMode;
  catalogEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
};
```

Persistencia sugerida:

- Opción segura inicial: `site_config.public_mode`, `site_config.catalog_enabled`, `site_config.catalog_settings_json` como columnas aditivas.
- Opción más limpia: tabla `public_config` con key `default`, JSON settings y auditoría.

Default obligatorio: `publicMode: "flow"`, `catalogEnabled: false`.

### 5.2 Catalog settings

```ts
type CatalogSettings = {
  orderWindow: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  deliveryWindow: {
    startTime: string;
    endTime: string;
    label: string;
  };
  sameDayOrders: {
    enabled: boolean;
    paymentPercentRequired: 100;
  };
  scheduledOrders: {
    enabled: boolean;
    paymentPercentRequired: 50;
    requiresManualValidation: true;
  };
  theme: {
    defaultMode: "system" | "light" | "dark";
    allowCustomerOverride: boolean;
  };
  catalogLayout: {
    defaultView: "carousel" | "grid";
    allowedViews: Array<"carousel" | "grid">;
  };
};
```

Default recomendado:

- Recepción cerrada/abierta según configuración de Chekeo, no hardcodeada en UI.
- Entrega inicial: `13:30` a `14:00`, label `1:30 PM a 2:00 PM`.
- Tema: `system`, override permitido.
- Layout: comenzar con `grid` para accesibilidad y performance; carrusel por categoría/drawer en PR posterior.

### 5.3 Product

```ts
type ProductType = "burger" | "combo" | "side" | "topping";

type Product = {
  id: string;
  type: ProductType;
  categoryId: string;
  name: string;
  shortDescription: string;
  longDescription?: string;
  ingredients?: string[];
  includedItems?: string[];
  price: number;
  imageUrl: string;
  label?: "Popular" | "Nuevo" | "Promo" | "Limitado" | "Recomendado";
  isAvailable: boolean;
  isVisible: boolean;
  sortOrder: number;
  metadata?: {
    isEditable?: boolean;
    showIngredients?: boolean;
    requiresDrawer?: boolean;
    separateDeliveryNotice?: boolean;
  };
};
```

Reglas de compatibilidad:

- No cambiar `MenuItem` todavía.
- Crear adaptador `MenuItem -> Product` en PR 3 o endpoint nuevo `/api/catalog-v1`.
- `price` debe mantener unidad del frontend actual (pesos), mientras D1 persiste centavos.
- Burger fija: `metadata.isEditable = false`, `showIngredients = true`.
- Toppings son productos de carrito, no extras dentro de burger.

### 5.4 Banner sections

```ts
type BannerImage = {
  id: string;
  imageUrl: string;
  altText: string;
  isActive: boolean;
  sortOrder: number;
  startDate?: string | null;
  endDate?: string | null;
};

type BannerSection = {
  id: "banner-section-1" | "banner-section-2" | "banner-section-3";
  name: string;
  isActive: boolean;
  title?: string;
  sortOrder: number;
  images: BannerImage[];
};
```

Schema sugerido:

```sql
CREATE TABLE catalog_banner_sections (
  id TEXT PRIMARY KEY CHECK (id IN ('banner-section-1','banner-section-2','banner-section-3')),
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  title TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalog_banner_images (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  image_key TEXT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NULL,
  end_date TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES catalog_banner_sections(id) ON DELETE CASCADE
);
```

### 5.5 Catalog order

```ts
type CatalogOrder = {
  id: string;
  mode: "catalog";
  customer: {
    name: string;
    whatsapp: string;
    deliveryLocation: string;
    locationNote?: string;
  };
  scheduledDate: string;
  deliveryWindow: {
    startTime: string;
    endTime: string;
    label: string;
  };
  items: CatalogOrderItem[];
  generalNote?: string;
  subtotal: number;
  total: number;
  payment: {
    paymentRule: "full" | "advance";
    requiredPercent: 100 | 50;
    requiredAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: "pending" | "advance_pending" | "advance_validated" | "paid_full" | "rejected";
  };
  status: "pending" | "advance_pending" | "advance_validated" | "paid_full" | "confirmed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

type CatalogOrderItem = {
  productId: string;
  type: "burger" | "combo" | "side" | "topping";
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
```

Compatibilidad sugerida con `orders_v2`:

- Crear pedidos catálogo en `orders_v2` con `source = "public-v2"` y `public_mode = "catalog"` cuando exista el campo.
- Guardar line items en `order_items_v2` como hoy, pero snapshot debe incluir `type`, `productId`, `scheduledDate`, `deliveryWindow` y versión de contrato.
- Mantener `payment_status = "pending"` hasta pago completo validado para no romper dashboards existentes; el estado fino vive en campos nuevos o snapshot mientras se migran vistas.

## 6. Impacto backend/config por requisito

| Requisito | Cambio necesario | Riesgo | Ruta segura |
| --- | --- | --- | --- |
| `publicMode` | Public config en D1/API y fallback | Puede cambiar experiencia pública accidentalmente | Default `flow`, flag inactivo, lectura tolerante |
| `catalogSettings` | JSON versionado editable desde Chekeo | Horarios y zona horaria afectan pedidos reales | Agregar UI admin después de contrato y tests |
| Productos por tipo | `ProductType` explícito o adaptador desde categorías | Confundir extras actuales con toppings | Adaptador sin migrar datos primero |
| Toppings como productos | Toppings en carrito como líneas separadas | Rompe personalización actual si se mezcla | Solo catálogo; Modo Flujo conserva extras actuales |
| Combos como productos | Combos en `menu_items` categoría `combos` | Promos actuales pueden no ser productos | Migración gradual de promos a combos producto |
| Guarniciones como productos | Map `guarniciones -> side` | Nombre interno en español vs contrato inglés | Adaptador documentado |
| 3 banners independientes | Nuevas tablas o JSON distinto de category banners | Reutilizar category banners rompería Main Quest | Crear `catalog_banner_*` separado |
| Fecha programada | Campo fecha y validación por horario | Pedidos fuera de ventana | Validar frontend + backend; timezone explícito |
| Pago completo vs anticipo | Campos de regla, porcentajes y montos | Dashboards actuales solo entienden pending/paid | Estado fino aditivo; no redefinir `paid` |
| Estados manuales de pago | Estado de validación y eventos | Operación puede entregar sin validar | Chekeo debe mostrar bloqueo/alerta clara |
| Compatibilidad flujo actual | Feature flag y contratos opt-in | Riesgo de regresión en checkout actual | No tocar `CreateOrderV2Payload` requerido en PR 1/2 |

## 7. Plan de PRs siguientes

### PR 1 — contrato/documentación/base no disruptiva

- Documentar diagnóstico, modelo, riesgos y mapa de archivos.
- No activar UI ni cambiar payloads actuales.
- Opcional posterior: agregar tipos exportados inactivos si se decide centralizar contrato en `packages/config`.

### PR 2 — feature flag Modo Flujo/Modo Catálogo

- Agregar `PublicConfig` en contratos compartidos y fallback inactivo.
- Endpoint público de config: `/api/public-config` o inclusión segura en `/api/menu-v2`.
- Chekeo solo lectura o toggle protegido, default `flow`.
- App pública sigue renderizando Modo Flujo mientras `catalogEnabled=false`.

### PR 3 — catálogo visual base

- Crear shell `CatalogModeApp` mínimo con listado de productos desde adaptador `MenuItem -> Product`.
- Sin checkout nuevo completo; CTA de carrito inactivo o limitado.
- Productos fijos, ingredientes informativos, mobile-first, accesible.

### PR 4 — carrito y drawer

- Carrito sticky con líneas independientes.
- Drawer móvil para burgers, combos, guarniciones y toppings.
- Toppings como productos separados.
- Sin modificar flujo guiado.

### PR 5 — checkout catálogo

- Checkout separado con fecha elegida por cliente, delivery window y validación de horario.
- Payload catálogo aditivo.
- Reglas 100% mismo día y 50% programado.
- Estados manuales de pago visibles en Chekeo.

### PR 6 — banners

- Persistencia/admin de 3 secciones independientes.
- Render fijo si hay 1 imagen activa; carrusel si hay 2+.
- Validación de imágenes 1200x400, alt text y fechas.

### PR 7 — polish visual/rebranding temporal

- Salida gradual de neón/gamer hacia estética más profesional.
- Mantener compatibilidad de tema `system/light/dark` y `prefers-reduced-motion`.
- QA visual móvil/desktop.

## 8. Riesgos

- `PublicOrderApp.tsx` concentra mucho estado; una bifurcación interna grande puede aumentar deuda. Preferible montar un componente hermano para catálogo.
- `OrderV2PaymentStatus` es insuficiente para pagos parciales; cambiarlo directamente rompería Chekeo, reportes o tickets.
- `MenuItem.category` no distingue semánticamente topping vs extra de personalización; se necesita adaptador o campo adicional.
- Banners actuales por categoría no deben reutilizarse como secciones independientes porque tienen otro propósito.
- Horarios y fechas requieren timezone explícito para evitar errores de pedidos del mismo día.
- La validación manual de pagos necesita trazabilidad en eventos para operación y auditoría.
- El rebranding visual puede chocar con reglas actuales de marca; debe separarse del contrato funcional.

## 9. Checklist de QA futuro

### Modo/feature flag

- Confirmar que `publicMode=flow` mantiene exactamente el flujo actual.
- Confirmar que `catalogEnabled=false` impide rutas/render de catálogo.
- Confirmar fallback cuando falla `/api/public-config`.

### Catálogo

- Validar 320px, 390px, 768px y desktop.
- Validar categorías: burgers, combos, guarniciones/sides y toppings.
- Validar que ingredientes de burger son informativos y no editables.
- Validar que toppings suman como líneas separadas al carrito.

### Carrito/drawer

- Validar targets táctiles de al menos 44px.
- Validar foco visible, cierre con Escape y navegación por teclado.
- Validar `prefers-reduced-motion`.

### Checkout catálogo

- Validar pedido mismo día exige 100%.
- Validar pedido programado exige 50%.
- Validar pedido programado sin pago validado queda pendiente.
- Validar fecha, ubicación, WhatsApp y notas con errores inline.
- Validar idempotencia para doble submit.

### Chekeo/pagos

- Validar estados manuales: pendiente, anticipo pendiente, anticipo validado, pagado completo, rechazado.
- Validar que cocina no confunde pago pendiente con pedido confirmado.
- Validar auditoría de cambios de pago.

### Banners

- Validar sección sin imágenes activas no renderiza.
- Validar sección con 1 imagen activa renderiza fija.
- Validar sección con 2+ imágenes activas renderiza carrusel.
- Validar alt text obligatorio e imagen 1200x400.
- Validar independencia de las 3 secciones.

## 10. Cambios NO realizados en este PR

- No se implementó UI final de Modo Catálogo.
- No se implementó checkout catálogo.
- No se implementó drawer final.
- No se implementó carrusel visual.
- No se cambió producción ni deployment.
- No se agregaron dependencias.
- No se modificaron `package.json`, lockfiles, migraciones, schemas activos, backend ni payloads existentes.
- No se tocó `legacy/`.
