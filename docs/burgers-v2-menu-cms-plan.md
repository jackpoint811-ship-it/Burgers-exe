# Burgers.exe V2 Menu/CMS Plan

## Fase A (actual)
V2 consume mock data y placeholders desde `packages/config`.

## Fase B
Crear `/api/menu-v2` (Cloudflare Functions) para leer D1 con schema V2.

## Fase C
Habilitar edición de menú/promos/config desde internal-chekeo-v2 (admin) escribiendo D1.

## Fase D
Mover imágenes a R2; D1 guarda `imageKey` y frontend resuelve URL firmada/CDN.

## Fase E
Migración opcional desde Sheets a D1 con script de import y validación de contrato.

## Por qué frontend NO debe leer Sheets directo
- Seguridad: evita exposición de credenciales o endpoints sensibles.
- Performance: cache y edge control en Cloudflare.
- Gobernanza: contrato único API -> frontend.

## Compatibilidad con `/api/menu` actual
- Mantener `/api/menu` intacto para V1.
- V2 usa `/api/menu-v2` o adapter local con fallback.
- No romper shape legacy; versionar contratos explícitamente.
