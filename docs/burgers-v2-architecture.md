# Burgers.exe V2 Radical Rebuild Architecture (Fase V2-0)

## Objetivos V2
- Levantar una base paralela para public-order-v2 e internal-chekeo-v2 sin reemplazar V1.
- Aislar UI y contratos de datos para evolucionar frontend sin tocar backend actual.
- Preparar integración futura con Cloudflare D1/R2 manteniendo compatibilidad de endpoints existentes.

## Stack
- React + Vite + TypeScript.
- Tailwind CSS para sistema visual.
- Radix primitives para bloques de interfaz escalables.
- Framer Motion para microinteracciones.
- Lucide para iconografía.

## Estructura propuesta
- `apps/public-order-v2`: landing + ordering shell.
- `apps/internal-chekeo-v2`: consola operativa dark-only.
- `packages/ui`: componentes compartidos V2.
- `packages/config`: contratos y mock data V2.
- `docs/`: arquitectura, CMS y placeholders.

## Decisiones técnicas
- V2 corre en paralelo, sin mutar `cloudflare/public-order` ni `cloudflare/internal-chekeo`.
- Configuración single-repo con `APP_TARGET` para dev/build independiente por app.
- Contratos TS explícitos para reducir acoplamiento con backend.

## Contratos intocables
- No cambios a endpoints productivos actuales (`/api/menu`, `/api/order`, auth/rpc actual).
- No cambios a backend operativo Apps Script ni contratos legacy.

## Estrategia de migración
1. V2-0: scaffold + mocks (este PR).
2. V2-1: conectar `/api/menu-v2` con adapter de lectura.
3. V2-2: activar flujo de pedido V2 detrás de flag/ruta paralela.
4. Cutover controlado posterior con rollback inmediato a V1.

## Riesgos
- Divergencia entre mock y datos reales si no se valida contrato temprano.
- Drift visual entre apps V2 si no se centraliza tokens/components.

## Rollback
- Mantener V1 intacta y desplegada.
- V2 se elimina de build/deploy sin impacto en operaciones actuales.

## Qué no cambia todavía
- Producción V1.
- Backend operativo.
- Cloudflare apps en uso actual.
- Legacy y variables de entorno existentes.

## Revisión de futuros PRs V2
- Verificar no-touch zones.
- Exigir compatibilidad con contratos actuales.
- Exigir evidencia de build + typecheck.

## V2-1 public-order mock experience
- `apps/public-order-v2` ahora implementa landing + flujo de pedido mock en una sola página.
- El submit de checkout es simulado localmente y no llama endpoints productivos.
