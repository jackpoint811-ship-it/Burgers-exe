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
