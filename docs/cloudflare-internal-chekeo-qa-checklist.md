# Cloudflare Internal Chekeo — QA Checklist

## 1. Seguridad y acceso
- [ ] PIN incorrecto.
- [ ] PIN correcto.
- [ ] Logout.
- [ ] Sesión expirada.
- [ ] Cookie no visible desde JS.
- [ ] `ALLOWED_IPS` opcional.

## 2. Read-only
- [ ] Inicio carga backend.
- [ ] Pedidos carga lista.
- [ ] Detalle de pedido abre.
- [ ] Ticket cliente abre.
- [ ] Cocina muestra pendientes.
- [ ] Otros muestra resumen/cierre/histórico.

## 3. Writes operativos
- [ ] Sincronizar.
- [ ] Marcar pagado.
- [ ] Cambiar estado.
- [ ] Guardar cambios operativos.
- [ ] Marcar ticket enviado.
- [ ] Marcar pedido listo.
- [ ] Marcar guarnición lista.
- [ ] WhatsApp no escribe por sí solo.

## 4. Cierre/histórico
- [ ] Guardar resumen.
- [ ] Archivar completados.
- [ ] Cerrar día.
- [ ] Cargar últimos 20 histórico.

## 5. Errores
- [ ] Backend caído.
- [ ] Env faltante.
- [ ] Sesión vencida.
- [ ] IP no permitida.
- [ ] Apps Script error.

## 6. Mobile
- [ ] iPhone-ish width.
- [ ] Android-ish width.
- [ ] Botones táctiles.
- [ ] Bottom nav.
- [ ] Modales.

## 7. Rollback
- [ ] Web App Apps Script actual usable.
- [ ] Public order sigue usable.
- [ ] No cambios en `BOG_ACTIVE_ENV`.

## 8. Modo Preview interno
- [ ] Entrar a Chekeo en modo Producción y confirmar que no aparece banner preview.
- [ ] Cambiar a Preview y confirmar banner persistente `MODO PREVIEW ACTIVO`.
- [ ] Usar `Abrir Public Preview` y confirmar que abre `https://burgers-exe-public-v2-preview.pages.dev/?env=preview`.
- [ ] Crear pedido desde Public Preview.
- [ ] Confirmar folio `PVW-*` en confirmación pública.
- [ ] Confirmar que la confirmación pública dice que no genera tickets/referidos reales.
- [ ] Confirmar que el pedido aparece solo en Chekeo Preview.
- [ ] Confirmar que el pedido no aparece en Chekeo Producción.
- [ ] Cambiar estado/pago/checklist del pedido preview desde Chekeo Preview.
- [ ] Confirmar que mutaciones desde ambiente incorrecto son rechazadas por backend.
- [ ] Descargar ticket PNG preview y confirmar marca `PREVIEW` / `PEDIDO DE PRUEBA — NO PREPARAR`.
- [ ] Abrir WhatsApp de pedido preview y confirmar texto `PEDIDO DE PRUEBA — NO PREPARAR`.
- [ ] Revisar Cierre, CSV y Resumen K en Producción: no incluyen folio `PVW-*`.
- [ ] Revisar tickets/sorteos reales: no suman el pedido preview.
- [ ] Confirmar que no se cambió `BOG_ACTIVE_ENV`, D1 bindings, R2 ni APIs productivas externas.
