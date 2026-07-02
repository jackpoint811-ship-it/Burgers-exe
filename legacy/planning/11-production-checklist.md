# 11 — Production Checklist (Manual)

## Pre-production validation checklist
- [ ] Revisar pedidos de prueba en `Chekeo Nuevo`.
- [ ] Confirmar encabezados de hojas (`Chekeo Nuevo`, `Chekeo`, `Resumen Pedidos`, `Historico`).
- [ ] Confirmar datos bancarios (`Banco`, `Nombre`, `Número de cuenta`).
- [ ] Confirmar que ticket descarga correctamente desde la app.
- [ ] Confirmar que WhatsApp abre correctamente con mensaje precargado.
- [ ] Confirmar que cierre de día funciona.
- [ ] Confirmar que `Historico` recibe pedidos archivados.
- [ ] Confirmar que `Resumen Pedidos` recibe corte.
- [ ] Confirmar modo operativo antes de producción (`BOG_ACTIVE_ENV=TEST` durante validación).
- [ ] Confirmar respaldo manual del Google Sheet antes de activar producción.

## Pasos para activar producción (manual)
1. Ejecutar `validateProductionReadiness()` y resolver checks con error.
2. Ejecutar `getProductionMigrationPreview()` y validar conteos esperados.
3. Ejecutar `prepareProductionSheets()` para asegurar estructura.
4. Hacer respaldo manual del Spreadsheet completo.
5. Con aprobación explícita del usuario, cambiar `BOG_ACTIVE_ENV` a `PROD` en ScriptProperties.
6. Verificar en UI que `mode=PROD` y `activeSheet=Chekeo`.

## Pasos de rollback (manual)
1. Cambiar `BOG_ACTIVE_ENV` a `TEST`.
2. Confirmar en UI `mode=TEST` y `activeSheet=Chekeo Nuevo`.
3. Restaurar desde respaldo manual si hubo edición incorrecta en producción.
4. Re-ejecutar `validateProductionReadiness()` antes de intentar nuevo corte.

## Mandatory reminders
- No activar producción automáticamente.
- No migrar datos automáticamente.
- No borrar hojas ni datos.
- No tocar `legacy/`.
