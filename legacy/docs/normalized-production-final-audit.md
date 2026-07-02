# Burgers.exe / Chekeo 2.0 — Final Normalized Production Audit (Phase 10B)

> Objetivo: ejecutar la auditoría final de operación productiva en modo normalizado antes de declarar el cierre funcional de la migración.

## Alcance
- Este documento es **solo auditoría/manual sign-off**.
- No introduce cambios runtime.
- No requiere cambios de Apps Script para esta fase.

---

## 1) Branding
- [ ] Chekeo internal title/header muestra **Burgers.exe**.
- [ ] Public-order visible brand usa **Burgers.exe** en superficies current-facing.
- [ ] Copy de WhatsApp a cliente usa **Burgers.exe**.
- [ ] Referencias antiguas a **Burger-OG** solo permanecen como contexto histórico/técnico (si aplica).
- [ ] Namespace técnico **BOG_*** se mantiene intencionalmente por compatibilidad.

## 2) Normalized mode
- [ ] Chekeo carga con `ordersSource = normalized`.
- [ ] Home muestra: **Chekeo 2.0 normalizado activo**.
- [ ] Pedidos refleja flujo process-first:
  - Producción
  - Pago
  - Entrega
  - Finalización
- [ ] Estado interno (`estado`) es secundario (solo compatibilidad/diagnóstico).
- [ ] No aparecen acciones generales de card `Confirmar` / `Preparando` en modo normalizado.

## 3) Cocina
- [ ] Sección **Burgers** operativa.
- [ ] Sección **Guarniciones** operativa.
- [ ] Listas para marcar preparadas operativas.
- [ ] Cocina no está bloqueada por pago.
- [ ] Producción puede pasar a `Preparada` de forma independiente.

## 4) Payment / delivery / finalization
- [ ] Pago puede pasar a `Pagado` de forma independiente.
- [ ] Entrega puede pasar a `Entregada`.
- [ ] Finalización solo verdadera cuando se cumple simultáneamente:
  - Producción = `Preparada`
  - Pago = `Pagado`
  - Entrega = `Entregada`

## 5) WhatsApp
- [ ] “WhatsApp cliente” abre `wa.me` con mensaje prellenado.
- [ ] El mensaje omite folio / order ID y líneas de estado.
- [ ] El mensaje incluye items, total, método y nota opcional segura.
- [ ] No aparece segunda confirmación.
- [ ] `ticket_enviado` se marca de forma silenciosa e idempotente.

## 6) Cierre Drive-first
- [ ] En **Otros** aparece Cierre Drive-first solo en modo normalizado.
- [ ] Renderizan correctamente: Finalizados nuevos / Bloqueados / Ya archivados.
- [ ] Botón de archivado queda deshabilitado cuando no hay finalizados nuevos.
- [ ] Archivado escribe archivos JSON en Drive.
- [ ] `ARCHIVO_CORTES` recibe índice lightweight.
- [ ] `EVENTOS_PEDIDO` recibe evento `PEDIDO_ARCHIVADO_DRIVE`.
- [ ] Re-ejecución no duplica archivados/eventos.

## 7) Legacy fallback
- [ ] El fallback legacy interno se preserva.
- [ ] Secciones de cierre legacy aparecen solo en modo legacy-fallback.
- [ ] No se cambiaron archivos bajo `legacy/` durante esta limpieza final.

## 8) Apps Script deployment state
- Archivos `.gs` requeridos por fases recientes:
  - **Phase 8A:** ninguno
  - **Phase 8B:** ninguno
  - **Phase 9A:** ninguno
  - **Phase 9B:** ninguno
  - **Phase 9B-A:** ninguno
  - **Phase 10A:** ninguno
- Recordatorio: fases backend anteriores sí requirieron updates de `.gs` según su propio alcance.
- Para esta auditoría final (Phase 10B): **no se requiere deploy nuevo de Apps Script**.

## 9) Sign-off template

| Area | Result | Evidence / notes | Blocker? (yes/no) |
|---|---|---|---|
| Branding |  |  |  |
| Normalized mode |  |  |  |
| Cocina |  |  |  |
| Payment / delivery / finalization |  |  |  |
| WhatsApp |  |  |  |
| Cierre Drive-first |  |  |  |
| Legacy fallback |  |  |  |
| Apps Script deployment state |  |  |  |

---

## Criterio de cierre funcional de migración
La migración se considera funcionalmente cerrada solo cuando:
1. Todos los checks críticos arriba están en estado satisfactorio.
2. No hay blockers abiertos.
3. El responsable de operación confirma manualmente el sign-off.
