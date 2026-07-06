> Estado: vivo
> Uso: Fase 9, auditoria de riesgos pendientes y plan de hardening antes de produccion

# Fase 9 - Risk hardening plan antes de produccion

Esta fase documenta riesgos y criterios de no-go antes de cualquier cambio productivo. No ejecuta Cloudflare remoto, no toca D1/R2, no cambia bindings/secrets y no modifica runtime V2.

## 1. Estado actual

- Fases 0 a 8 cerradas por PRs pequenos y controlados.
- Superficie oficial activa: Public Order V2 e Internal Chekeo V2.
- Fuente de verdad oficial: Cloudflare D1 para datos y R2 para assets.
- Preview mirror ya fue preparado y validado en proyectos preview separados.
- Los smokes preview esperados usan URLs base de los proyectos preview, no aliases de branch, salvo que una fase autorice probar un branch/preview environment especifico.
- Produccion real sigue fuera de alcance hasta nueva autorizacion explicita.

## 2. Riesgos pendientes

| Riesgo | Estado | Impacto | Mitigacion requerida |
| --- | --- | --- | --- |
| Produccion real todavia no debe tocarse. | Abierto | Un comando equivocado podria escribir o desplegar contra live. | Mantener gate explicito para cualquier recurso `live` o Pages productivo real. |
| Bindings efectivos de produccion real no estan confirmados para cambios productivos. | Abierto | Un deploy podria usar DB/R2 equivocados o flags incorrectos. | Hacer auditoria production read-only antes de cualquier produccion. |
| D1 preview contiene `fixture_orders=30`. | Abierto | QA puede confundirse con datos acumulados o fixtures viejos. | Definir estrategia controlada de reset/cleanup/seed preview antes de QA extendida. |
| Preview puede acumular fixtures y datos de prueba. | Abierto | Resultados de Pedidos/Pagos/Resumen K pueden ser ruidosos. | Usar folios/prefijos de fixture y limpieza autorizada por fase. |
| Pages branch aliases pueden no usar los mismos bindings que las URLs base. | Documentado | Un smoke por alias puede dar `source=fallback` o auth `503` aunque base URL este correcta. | Validar base URLs para proyectos preview separados; usar branch aliases solo si ese environment fue configurado y autorizado. |
| `wrangler.toml` puede emitir warning por falta de `pages_build_output_dir`. | Abierto | Ruido en deploys futuros y riesgo de asumir config incompleta como canonica. | Documentar y corregir solo en una fase autorizada de config, sin tocar secrets/bindings. |
| QA visual/funcional antes de produccion no esta formalmente cerrada. | Abierto | Produccion podria recibir regresiones visibles o flujos incompletos. | Ejecutar Fase 9A con targets preview autorizados y checklist claro. |
| `ORDERS_V2_WRITE_ENABLED` requiere confirmacion por ambiente sin imprimir secrets. | Abierto | Escritura podria estar activa/inactiva en ambiente equivocado. | Confirmar presencia/valor efectivo solo por Dashboard o checks seguros, sin exponer secretos. |
| Rollback productivo no esta ensayado como runbook final. | Abierto | Dificulta reaccionar ante un deploy fallido. | Preparar runbook productivo y rollback en Fase 9D sin ejecutarlo. |
| Rutas legacy activas no deben reaparecer. | Abierto | Riesgo de operar una superficie historica o contradictoria. | Confirmar que no hay rutas legacy activas antes de produccion. |
| Docs historicas pueden contradecir D1/R2 como fuente de verdad. | Abierto | Codex o humanos podrian seguir instrucciones antiguas de Sheets/App Script. | Mantener docs historicas marcadas como legacy y actualizar referencias vivas. |

## 3. Hardening recomendado antes de produccion

### Fase 9A - Preview QA funcional/visual

- Objetivo: validar flujos publicos e internos contra preview autorizado.
- Alcance sugerido: read-only cuando sea posible; escritura solo con fixtures controlados y autorizacion explicita.
- Evidencia minima: screenshots o logs de smoke, targets exactos, resultado esperado vs real y riesgos.
- No tocar produccion.
- Estado 2026-07-06: ejecutada en modo read-only y en revision. Public e Internal preview cargan en mobile/desktop; Public `/api/menu-v2` responde `source=d1`; Internal auth status responde `authenticated=false`.
- Hallazgo 2026-07-06: Public preview tiene assets 404 bajo `/api/assets-v2/` para imagenes de rifa y `combo-bbq`; requiere decision antes de produccion.

### Fase 9B - Estrategia de reset/seed preview

- Objetivo: definir como limpiar o resembrar preview sin afectar live.
- Alcance sugerido: comandos preview-only, prefijos de fixtures, conteos esperados y verificacion read-only posterior.
- Requiere autorizacion fuerte antes de ejecutar cualquier D1 write, seed o migration preview.

### Fase 9C - Auditoria production read-only

- Objetivo: confirmar estado productivo sin escribir ni desplegar.
- Alcance sugerido: bindings efectivos, flags, presencia de secrets, D1/R2 correctos y rutas activas.
- Requiere autorizacion explicita para comandos remotos read-only.

### Fase 9D - Runbook deploy productivo y rollback

- Objetivo: preparar pasos exactos de deploy productivo y rollback, sin ejecutarlos.
- Alcance sugerido: prechecks, comandos bloqueados hasta autorizacion, criterio de exito, criterio de rollback y responsables.
- No ejecutar deploy productivo en esta fase.

### Fase 9E - Go/no-go de produccion

- Objetivo: decidir si produccion esta lista.
- Alcance sugerido: checklist final, evidencia de QA, estado de PRs, riesgos residuales y autorizacion humana explicita.
- Si hay cualquier no-go activo, no promover.

## 4. Criterios no-go

- Preview responde `/api/menu-v2` con `source=fallback`.
- Internal preview auth status responde `503`.
- Fixtures preview aparecen o se sospechan en live.
- Bindings efectivos no estan confirmados.
- Secrets requeridos estan ausentes o no verificables de forma segura.
- Tests, builds o checks aplicables fallan.
- Assets criticos de preview fallan y el equipo los clasifica como bloqueantes visuales.
- Target Cloudflare ambiguo o comando remoto sin recurso preview/live explicitamente nombrado.
- PR sin review suficiente para el riesgo de la fase.
- Cambios productivos sin rollback documentado.

## 5. Checklist siguiente fase

Antes de iniciar Fase 9A debe existir:

- [ ] Targets preview exactos autorizados.
- [ ] Definicion de si QA sera read-only o con escritura fixture controlada.
- [ ] Usuario confirma si Playwright contra URLs preview esta autorizado.
- [ ] Checklist de flujos: menu publico, checkout, pedidos internos, pagos, tickets, Resumen K y auth interna.
- [ ] Criterios de datos esperados: fixtures permitidos, prefijos, conteos y limpieza posterior.
- [ ] Evidencia esperada: capturas, logs HTTP, comandos read-only o checklist manual.
- [ ] Confirmacion de que produccion real queda fuera de alcance.

## 6. Matriz de autorizacion

| Accion | Estado | Regla |
| --- | --- | --- |
| Docs, checks locales, `git diff`, lectura de archivos. | Permitido sin autorizacion adicional | Mantener alcance docs/local y staging explicito. |
| Cloudflare remoto read-only. | Requiere autorizacion explicita | Nombrar recurso exacto y reportar comandos antes/despues. |
| Playwright contra URLs preview. | Requiere autorizacion explicita | Usar solo URLs preview autorizadas y no tocar produccion. |
| Preview deploy, preview seed, preview migration. | Requiere autorizacion fuerte | Comando debe nombrar recurso preview exacto; verificar antes y despues. |
| Production writes, production deploy, secrets/bindings, D1/R2 live writes. | Prohibido hasta nuevo aviso | Solo con nueva autorizacion literal y especifica de produccion. |

## 7. Nota operativa

Si una fase futura encuentra contradiccion entre docs historicas y codigo actual, se debe verificar el codigo y reportar la diferencia antes de ejecutar. Si el target Cloudflare no es inequivoco, detenerse.
