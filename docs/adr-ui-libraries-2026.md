# ADR — Política de librerías UI/UX 2026 para Burgers.exe

## Estado
**Propuesta para aprobación**

## Contexto
Burgers.exe/Burger-OG se encuentra en una etapa de evolución UI/UX para los módulos `public-order` e `internal-chekeo`, manteniendo la operación en Cloudflare Pages con HTML/CSS/JS vanilla y backend en Google Apps Script/Sheets.

Antes de iniciar PR-2 (accesibilidad estructural) y PR-3 (sistema visual compartido), ya se completaron:
- A1: hardening técnico de `legacy/cloudflare/public-order/app.js`.
- A2: hardening técnico de `legacy/cloudflare/internal-chekeo/app.js`.

Los documentos de auditoría y planeación UX 2026 recomiendan patrones modernos y buenas prácticas actuales. Aun así, el proyecto mantiene restricciones estrictas:
- sin frameworks,
- sin CDNs,
- sin dependencias externas por defecto,
- sin cambios de contrato backend,
- sin tocar `legacy/` ni `BOG_ACTIVE_ENV`.

Por ello, es necesario definir una política explícita de librerías para alinear decisiones técnicas y evitar desviaciones durante PR-2 y PR-3.

> Nota: `legacy/docs/deep-research-report-actualizado.md` no estaba disponible en el workspace al momento de esta ADR; se usa el resto de documentación base listada.

## Opciones evaluadas

### Opción A — Mantener 100% vanilla runtime
No introducir librerías en producción para UI/UX; toda implementación se mantiene en HTML/CSS/JS nativo.

### Opción B — Permitir librerías solo como referencia de patrones (sin instalar)
Usar librerías modernas como benchmark conceptual (accesibilidad, interacción, tokens, arquitectura), pero sin agregarlas al proyecto.

### Opción C — Permitir librerías dev-only para testing/documentación
Habilitar herramientas solo de desarrollo (por ejemplo auditoría o testing automatizado), sin incluirlas en runtime de producción.

### Opción D — Permitir librerías runtime específicas
Incorporar selectivamente librerías de UI/animación/componentes en producción con justificación por caso.

### Opción E — Migrar a framework/build step
Adoptar framework moderno y pipeline de build para habilitar ecosistema de componentes y tooling avanzado.

## Librerías evaluadas como referencia
- Tailwind CSS
- Radix UI / Headless UI
- shadcn/ui
- Motion / GSAP
- Lottie
- Lenis
- three.js
- Lucide
- Chart.js
- axe-core
- Playwright
- Storybook

## Matriz de decisión

| Opción | Valor UX | Accesibilidad | Performance | Riesgo operativo | Mantenimiento | Compatibilidad Cloudflare Pages actual | Necesidad build step | Riesgo de romper reglas | Facilidad rollback |
|---|---|---|---|---|---|---|---|---|---|
| A. 100% vanilla runtime | Medio-Alto (más esfuerzo manual) | Alto potencial si se implementa APG/WCAG con disciplina | Alto (mínimo peso) | Bajo | Medio (requiere gobernanza interna) | Total | No | Muy bajo | Muy alta |
| B. Referencia sin instalar | Alto (mejora calidad de diseño técnico) | Alto (se heredan patrones maduros conceptualmente) | Alto | Muy bajo | Medio-Bajo | Total | No | Muy bajo | Muy alta |
| C. Dev-only tooling | Medio-Alto | Alto (mejora verificación) | Alto en producción; costo en CI/local | Medio | Medio | Alta (si se acota a fase de QA) | Puede requerir scripts, no necesariamente bundling | Bajo-Medio | Alta |
| D. Runtime específicas | Alto inicial | Variable (depende de librería y adaptación) | Medio-Bajo (más peso JS/CSS) | Medio-Alto | Medio-Alto | Media (fricción por restricciones) | Frecuente | Alto | Media |
| E. Framework/build step | Alto potencial a largo plazo | Alto potencial | Variable (puede degradar TTI si no se controla) | Alto | Alto (cambio estructural) | Baja respecto al estado actual | Sí | Muy alto | Baja |

## Decisión recomendada
Se recomienda formalmente adoptar un enfoque combinado **A + B** para esta etapa:

1. **No usar librerías runtime para UI en esta fase.**
2. **Usar librerías modernas únicamente como referencia de patrones.**
3. **Mantener toda implementación en HTML/CSS/JS vanilla.**
4. **Evaluar tooling dev-only más adelante solo en una fase explícita de QA automatizado.**
5. **No introducir framework ni build step en PR-2 ni PR-3.**

Esta decisión optimiza control de riesgo, compatibilidad con el stack vigente y trazabilidad de cambios, sin bloquear mejoras de accesibilidad y diseño.

## Política propuesta

### Reglas por defecto
- **Runtime UI libraries:** no permitidas por defecto.
- **CDNs:** no permitidos.
- **Frameworks/build step:** no permitidos por defecto.
- **Librerías como referencia:** permitidas en documentación, ADRs y prompts técnicos.
- **Dev-only tools:** requieren ADR adicional y aprobación explícita.

### Reglas de excepción (obligatorias)
Cualquier excepción debe documentar como mínimo:
1. problema concreto a resolver,
2. peso estimado y presupuesto de rendimiento,
3. licencia y compatibilidad legal,
4. alternativa vanilla evaluada,
5. impacto en performance (TTI/LCP/INP/CSS/JS transfer),
6. impacto en accesibilidad (WCAG 2.2 AA),
7. plan de rollback,
8. archivos afectados y superficie de cambio.

## Aplicación práctica para próximos prompts de Codex
- Inspirarse en **Tailwind** para diseño de tokens, pero implementar con **CSS variables**.
- Inspirarse en **Radix/APG** para tabs y modales, pero implementar comportamiento **vanilla**.
- Inspirarse en **Motion/GSAP** para microinteracciones, pero resolver con **CSS/JS ligero**.
- Inspirarse en **Lucide** para consistencia visual de iconos, pero usar **SVG/assets locales**.
- Inspirarse en **axe-core/Playwright** para checklists y criterios de QA, pero **sin instalación aún**.
- **No usar Lottie/Lenis/three.js** salvo autorización futura explícita.

## Consecuencias

### Positivas
- Menor riesgo operativo.
- Menor peso en runtime.
- Menor superficie de mantenimiento y supply-chain.
- Respeto estricto del stack actual.
- Rollback simple y rápido.

### Negativas
- Mayor trabajo manual de implementación.
- Menor disponibilidad de componentes listos.
- Tabs/modales accesibles dependen de disciplina técnica interna.
- Testing automatizado quedará pendiente para fase posterior.

## Criterios para reabrir la decisión
Reabrir esta ADR si ocurre alguno de los siguientes escenarios:
1. Los componentes vanilla de interacción (tabs/modales/overlays) se vuelven frágiles o costosos de mantener.
2. `internal-chekeo` requiere visualización de datos compleja (charts avanzados) no razonable en vanilla.
3. Se aprueba formalmente una fase de pipeline de testing automatizado.
4. Se autoriza explícitamente introducir build step.
5. El costo total de mantenimiento vanilla supera el riesgo/control de incorporar una dependencia puntual.

## Criterios de aceptación de esta fase (A3)
- Solo se crea `docs/adr-ui-libraries-2026.md`.
- No se toca código funcional.
- No se toca `legacy/cloudflare/public-order`.
- No se toca `legacy/cloudflare/internal-chekeo`.
- No se toca `legacy/`.
- No se toca `BOG_ACTIVE_ENV`.
- No se agregan dependencias.
- No se modifica package/config/build.
- No se cambia UI/UX.

## Referencias utilizadas
- `docs/ui-ux-2026-audit-chekeo-and-public-order.md`
- `legacy/docs/ui-ux-mobile-first-plan.md`
- `legacy/docs/cloudflare-internal-chekeo-phase-0-audit.md`
- `legacy/cloudflare/internal-chekeo/README.md`
- `legacy/cloudflare/public-order/README.md`
