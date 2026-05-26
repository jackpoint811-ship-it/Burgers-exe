# Burgers.exe V2 Deploy Preview (safe, mock-only)

## Objetivo
Preparar deploy preview para V2 sin reemplazar producción y sin tocar V1.

> Este flujo **no despliega producción** y **no habilita operación real**.

## Estado funcional de V2 preview
- Mock-only (frontend).
- Sin auth real.
- Sin conexión a backend operativo.
- Sin llamadas a `/api/order` ni `/api/rpc`.
- Sin uso de Sheets, D1 o R2 en esta fase.

## Scripts de build y preview local
Desde la raíz del repo:

- `npm run build:public` → build de `apps/public-order-v2` en `dist/public-order-v2`.
- `npm run build:internal` → build de `apps/internal-chekeo-v2` en `dist/internal-chekeo-v2`.
- `npm run build` → corre ambos builds.
- `npm run typecheck` → validación TypeScript.
- `npm run preview:public` → build + preview local de `public-order-v2`.
- `npm run preview:internal` → build + preview local de `internal-chekeo-v2`.

## Opción recomendada: 2 proyectos Cloudflare Pages separados

### Project 1: `burgers-exe-public-v2-preview`
- Framework preset: Vite (o none/manual, equivalente).
- Build command: `npm ci && npm run build:public`
- Output directory: `dist/public-order-v2`
- Production branch: rama de preview/V2 (evitar `main` productiva si puede impactar V1).
- Environment variables: none (mock).
- Secrets: none.

### Project 2: `burgers-exe-internal-v2-preview`
- Framework preset: Vite (o none/manual).
- Build command: `npm ci && npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- Production branch: rama de preview/V2.
- Environment variables: none (mock).
- Secrets: none.

## Alternativa: Deploy Previews por PR
Si Pages está conectado a GitHub:
- Activar previews por PR en cada proyecto.
- Mantener la rama de producción de esos proyectos apuntando a rama V2/preview (no flujo V1 actual).
- Usar URL de PR preview para QA funcional y visual.

## Guardrails de release safety
- No reemplazar rutas o assets de V1.
- No integrar endpoints productivos en esta fase.
- Mantener payloads mock y placeholders.
- Mantener bundles razonables; no agregar dependencias nuevas salvo necesidad justificada.
- Registrar QA con checklist antes de promover cualquier integración posterior.

## Notas de performance (fase preview)
- Evitar assets pesados por ahora.
- Placeholders visuales siguen activos.
- Imágenes reales y optimización final se difieren a fase posterior.
- Revisar tamaño de bundles en cada PR V2.

## Qué NO hace este setup
- No toca `cloudflare/public-order/**`.
- No toca `cloudflare/internal-chekeo/**`.
- No toca `legacy/`.
- No toca `BOG_ACTIVE_ENV`.
- No modifica Cloudflare Functions actuales.
- No toca backend operativo ni endpoints productivos existentes.
