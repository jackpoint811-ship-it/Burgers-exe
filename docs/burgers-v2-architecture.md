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

## V2-2 internal-chekeo operator console mock
- `apps/internal-chekeo-v2` evoluciona de placeholder a consola operativa mock con PIN shell, tabs, dashboard, pedidos, cocina, pagos/notas e historial.
- No conecta auth/session/rpc reales ni endpoints productivos; toda la interacción es local mock.
- Acciones (mover estado, marcar listo, cancelar, logout) son simuladas en estado cliente.
- V1 interna y backend operativo permanecen intactos.


## V2-3 componentization + shared UI
- Se componentizan `apps/public-order-v2` e `apps/internal-chekeo-v2` en bloques reutilizables para evitar componentes gigantes.
- Se introduce una capa shared UI en `packages/ui` (Button, Badge, Card, SectionHeader, EmptyState, StatusPill, IconButton).
- Se mantiene comportamiento mock 100% local (sin fetch, sin auth real, sin endpoints productivos).
- No se toca backend operativo, Cloudflare Functions actuales, ni V1/legacy.
- La base queda lista para siguiente fase de integración o deploy preview V2.

## V2-4 safe deploy preview preparation
- Se formaliza workflow de build/preview independiente para `public-order-v2` e `internal-chekeo-v2`.
- Outputs separados para despliegue seguro en preview (`dist/public-order-v2`, `dist/internal-chekeo-v2`).
- Se agrega documentación para configurar 2 proyectos de Cloudflare Pages de preview sin reemplazar producción.
- V2 permanece mock-only: sin `/api/order`, sin `/api/rpc`, sin auth real, sin Sheets, sin D1/R2.
- Confirmación explícita de no-touch en V1, backend operativo, legacy, `BOG_ACTIVE_ENV` y Functions actuales.
