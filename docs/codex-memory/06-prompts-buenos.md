> Estado: vivo
> Uso: memoria operativa para Codex/Burgers.exe

# Prompts buenos

## Reglas rápidas

- `AGENTS.md` manda.
- Esta memoria apoya, no reemplaza.
- Si hay contradicción, reporta la diferencia antes de tocar nada.

## Prompt base para Codex

```text
Lee AGENTS.md y docs/codex-memory/00-indice.md antes de tocar código.

Sigue el workflow automático del proyecto:
- lee docs/codex-memory/08-agent-workflow.md;
- usa docs/codex-memory/09-checklists.md;
- usa Graphify primero si el cambio toca varios archivos, arquitectura o flujos conectados;
- crea rama limpia;
- implementa cambios mínimos suficientes;
- actualiza memoria si cambia una decisión, backlog, regla o prompt reusable;
- ejecuta checks aplicables;
- commit;
- push;
- PR.

Objetivo:
[describe aquí el cambio]

Restricciones:
- No tocar legacy salvo autorización explícita.
- No introducir dependencias nuevas salvo autorización explícita.
- No cambiar contratos de datos, precios, tickets, promociones ni payloads salvo autorización explícita.
- No hacer commit, push o PR cuando el prompt pida diagnóstico o pausa.
- No promover seeds destructivos ni migraciones de preview/testing a producción sin aprobación explícita.
- Mantener mobile-first.
- Mantener UX clara, accesible y consistente con Burgers.exe.
- No dejar cambios locales sin PR.

Entrega:
1. Diagnóstico.
2. Plan.
3. Cambios realizados.
4. Checks ejecutados o motivo de omisión.
5. Riesgos.
6. QA sugerido.
7. Link del PR.
```

## Prompt para diagnóstico sin modificar código

```text
Lee AGENTS.md y docs/codex-memory/00-indice.md.

Objetivo:
Haz diagnóstico de [área/problema] sin modificar código.

Instrucciones:
- Usa Graphify si necesitas entender relaciones entre archivos.
- No edites archivos.
- Identifica archivos relevantes.
- Explica hallazgos P1/P2/P3.
- Propón un plan de PR seguro.
- Indica riesgos y checks que aplicarían.
```

## Prompt para PR de UI/UX

```text
Lee AGENTS.md y docs/codex-memory/00-indice.md.
Lee docs/codex-memory/08-agent-workflow.md y docs/codex-memory/09-checklists.md.

Objetivo:
Implementa [cambio UI/UX].

Reglas:
- Mobile-first.
- 320px sin overflow horizontal.
- Targets táctiles de mínimo 44px.
- Foco visible.
- Labels persistentes.
- Estados loading/success/error/empty cuando apliquen.
- Respeta prefers-reduced-motion.
- Mantén estética Burgers.exe.
- No cambies contratos de datos ni reglas comerciales.
- Actualiza memoria si el cambio genera una decisión.
- Termina en PR.
```

## Prompt para Chekeo

```text
Lee AGENTS.md, docs/codex-memory/00-indice.md, docs/codex-memory/03-flujos-chekeo.md, docs/codex-memory/08-agent-workflow.md y docs/codex-memory/09-checklists.md.

Objetivo:
Implementa [cambio en Chekeo].

Reglas:
- Pedidos debe enfocarse en revisar/administar pedidos.
- Pagos debe concentrar pago, ticket, WhatsApp y comprobante cuando aplique.
- Corte debe mantener resumen operativo claro.
- Sorteo debe mostrar lo esencial sin saturar.
- Usa Graphify si el cambio toca varios archivos.
- No cambies reglas de precios, tickets, promociones, payloads ni datos sin autorización.
- Termina en PR.
```

## Prompt para public-order

```text
Lee AGENTS.md, docs/codex-memory/00-indice.md, docs/codex-memory/04-flujo-public-order.md, docs/codex-memory/08-agent-workflow.md y docs/codex-memory/09-checklists.md.

Objetivo:
Implementa [cambio en public-order].

Reglas:
- Mantén flujo mobile-first.
- Mantén CTA claro.
- Mantén checkout con labels, helper text y errores inline.
- No cambies payloads enviados desde orders-v2.
- No cambies menú, tickets, promociones, precios ni ubicación sin autorización.
- Ejecuta checks aplicables o reporta por qué no se ejecutaron.
- Termina en PR.
```
