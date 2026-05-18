# Chekeo 2.0 – Plan de migración por fases

## Objetivo
Definir una migración segura hacia la arquitectura Burgers.exe + Chekeo 2.0 sin afectar producción durante las fases iniciales.

## Restricciones de esta etapa
- Documentación únicamente (Phase 0/1 de preparación).
- No borrar ni modificar hojas legacy en esta PR.
- No cambiar comportamiento actual de producción.
- No cambiar `BOG_ACTIVE_ENV`.
- No tocar `legacy/`.
- Sin librerías externas, CDN ni frameworks.
- Mobile-first en ambas superficies.

## Decisiones confirmadas
- Solo permanecerán como apps operativas:
  - **Burgers.exe** (pública)
  - **Chekeo 2.0** (interna)
- Google Sheets es backend/base de datos.
- Google Drive será archivo externo de cierres/histórico detallado.
- Apps Script no es superficie operativa visible; solo backend/bridge si aplica.
- Históricamente se conservará a largo plazo la data de pedidos.
- Legacy podrá removerse después, únicamente con backup y aprobación explícita.
- `Pedidos Master` puede ser reemplazado por `PEDIDOS`.
- `MENU_LIVE` incluirá Burgers, Guarniciones y Extras.
- Imágenes de producto van en la celda correspondiente del producto.
- `COSTOS_PRECIOS` propone precio; `MENU_LIVE` aprueba precio público manualmente.
- Estados de pedido:
  - Nuevo
  - Confirmado
  - Preparando
  - Burgers listas
  - Entregado
  - Cancelado
- Estados de guarnición:
  - Sin guarnición
  - Pendiente
  - En preparación
  - Lista
- Nombre interno de la app: **Chekeo 2.0**.
- Pantallas de Chekeo 2.0:
  - Home
  - Pedidos
  - Cocina
  - Opciones

---

## Fases de migración

## Phase 0 – Contrato documental
**Objetivo:** alinear arquitectura y contratos sin tocar runtime.

**Entregables:**
- Contrato de datos (Sheets).
- Contrato de archivado en Drive.
- Plan de migración por fases.

**Riesgo:** mínimo (sin cambios de ejecución).

## Phase 1 – Alta segura de hojas nuevas
**Objetivo:** crear nuevas hojas objetivo sin borrado ni sustitución inmediata.

**Acciones:**
- Crear estructura de hojas objetivo.
- Mantener coexistencia con legacy.
- No eliminar hojas ni data existente.

**Salida esperada:** esquema nuevo disponible para integración progresiva.

## Phase 2 – Burgers.exe lee `MENU_LIVE`
**Objetivo:** desacoplar catálogo público hacia fuente limpia única.

**Acciones:**
- Configurar lectura de menú desde `MENU_LIVE`.
- Validar soporte de categorías (Burgers, Guarniciones, Extras).
- Mantener experiencia mobile-first.

## Phase 3 – Escritura a estructura limpia de `PEDIDOS`
**Objetivo:** empezar a persistir pedidos en `PEDIDOS` + detalle relacionado sin romper flujo vigente.

**Acciones:**
- Escribir pedidos nuevos en `PEDIDOS`.
- Escribir detalle en `PEDIDO_ITEMS` y `PEDIDO_BURGERS`.
- Preservar compatibilidad con el flujo actual mientras conviven estructuras.

## Phase 4 – Chekeo 2.0 lectura (read-only)
**Objetivo:** habilitar operación interna consultiva desde la nueva estructura.

**Acciones:**
- Chekeo 2.0 consume lectura de `PEDIDOS`, `PEDIDO_ITEMS`, `GUARNICIONES`, `EVENTOS_PEDIDO`.
- Sin acciones de escritura críticas todavía.

## Phase 5 – Chekeo 2.0 escritura operativa
**Objetivo:** activar transiciones operativas controladas desde Chekeo 2.0.

**Acciones:**
- Cambios de estado de pedidos.
- Registro de eventos en `EVENTOS_PEDIDO`.
- Actualización de estados de guarnición.

## Phase 6 – Cocina + guarniciones separadas
**Objetivo:** mejorar ejecución en piso operativo.

**Acciones:**
- Vista de tickets para cocina.
- Flujo separado de guarniciones con estados propios.
- Coordinación de estado “Burgers listas” y entrega.

## Phase 7 – Archivo Drive para cierres/histórico detallado
**Objetivo:** mover el detalle histórico de cierres a Drive y mantener el main Sheet liviano.

**Acciones:**
- Crear carpetas por corte en Drive.
- Guardar documento(s) detallado(s) de cierre e histórico de items/pedidos cerrados en Drive.
- Mantener en Sheet solo índices/sumarios y links (`ARCHIVO_CORTES`, y `HISTORICO_PEDIDOS` si aplica como resumen).
- Evitar `HISTORICO_ITEMS` como tabla permanente en el main Sheet.

## Phase 8 – Retiro de legacy (solo con aprobación explícita)
**Objetivo:** simplificación final post-migración.

**Precondiciones obligatorias:**
- Backup validado.
- Migración verificada extremo a extremo.
- Aprobación explícita del usuario/equipo responsable.

**Acciones:**
- Remover hojas legacy únicamente después de cumplir precondiciones.

---

## Criterios de seguridad transversales
- Cambios incrementales por fase con rollback claro.
- Sin cambios de producción en fases documentales.
- Sin borrado de datos hasta fase final aprobada.
- Mantener trazabilidad de estados/eventos.

## Estado de implementación – Phase 1 (alta segura)

Se implementó tooling manual en Apps Script para preparar la estructura objetivo sin afectar operación actual:

- Nuevo archivo: `setup_chekeo_2_sheets.gs`.
- Función manual principal: `setupChekeo2Sheets()`.
- Función opcional de previsualización: `previewChekeo2SheetSetup()`.

### Garantías de seguridad de `setupChekeo2Sheets()`

- Es **manual** (no se ejecuta automáticamente en runtime).
- Es **idempotente** (se puede ejecutar múltiples veces sin duplicar encabezados ni borrar datos).
- Solo crea hojas faltantes del contrato Chekeo 2.0.
- Si una hoja ya existe:
  - no la borra,
  - no la renombra,
  - no la limpia,
  - no elimina filas/columnas,
  - si está completamente vacía, escribe headers oficiales en fila 1,
  - si la fila 1 ya coincide exactamente con el contrato, no reescribe valores (solo puede aplicar freeze/formato de encabezado),
  - si **no está vacía** y la fila 1 **no coincide** con el contrato esperado, la reporta como conflicto y **no la modifica** (sin headers, sin formato, sin freeze).
- Esta protección evita alterar hojas actuales/legacy como `HOME` con layouts existentes.
- No migra datos legacy ni modifica hojas legacy existentes.
- No cambia `BOG_ACTIVE_ENV`.
- No altera comportamiento runtime actual de Burgers.exe público ni del Chekeo interno vigente.

### Uso operativo sugerido

1. Ejecutar `previewChekeo2SheetSetup()` para revisar cambios esperados.
2. Ejecutar manualmente `setupChekeo2Sheets()` para crear/completar estructura.
3. Revisar el objeto de resumen devuelto (`createdSheets`, `existingSheets`, `updatedHeaders`, `skippedHeaders`, `conflicts`, `timestamp`).


## Estado de implementación – Phase 2A (MENU_LIVE read-only)

Se implementó una capa read-only de Apps Script para preparar `MENU_LIVE` como fuente futura del menú público sin alterar runtime productivo:

- Nuevo archivo: `menu_live_service.gs`.
- Funciones nuevas:
  - `validateMenuLiveContract()`
  - `getMenuLive()`
  - `previewMenuLive()`
- Nuevo documento operativo: `docs/menu-live-contract.md`.

### Garantías de esta fase

- Solo lectura de `MENU_LIVE` (sin escrituras ni mutaciones de hojas).
- Normalización y validación del contrato de headers.
- Filtrado de activos para categorías (`Burger`, `Guarnicion`, `Extra`) y salida completa en `data.all`.
- Manejo best-effort de imágenes en celda sin bloquear carga del menú.
- Sin cambios en frontend público ni reemplazo de `PRICE_TABLE` en esta PR.

### Siguiente paso (fuera de esta PR)

La integración del frontend público para consumir `MENU_LIVE` se realizará en un PR posterior, una vez validado el contrato y la operación read-only.

