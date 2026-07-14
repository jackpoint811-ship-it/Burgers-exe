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
