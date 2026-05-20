# Chekeo 2.0 – Drive Archive Contract (Cierre diario e histórico)

## Objetivo
Definir cómo se almacena el cierre diario y el histórico detallado usando **Google Drive** como archivo externo, manteniendo Google Sheets liviano y operativo.

## Decisión de arquitectura
- **Google Drive es la fuente de verdad del detalle histórico de cierres/días cerrados**.
- El main Sheet de Burgers.exe guarda solo índices/sumarios ligeros y enlaces de navegación.
- `ARCHIVO_CORTES` es un índice liviano (metadata + links), no un repositorio detallado.

## Principio clave
La hoja de cálculo de Burgers.exe **no debe crecer indefinidamente** con detalle histórico completo. El detalle de cierres y evidencia operativa vive en Drive; en Sheet queda un índice liviano.

## Estructura de Drive objetivo

## 1) Carpeta raíz de archivo
Crear una carpeta raíz única, por ejemplo:
- `Burgers.exe - Archivo`

Esta carpeta contendrá todos los cortes/cierres históricos.

## 2) Carpeta por corte (día)
Dentro de la raíz, crear una carpeta por cada corte diario, por ejemplo:
- `2026-05-18_corte-dia`

Cada carpeta de corte agrupa todos los archivos del cierre correspondiente.

## 3) Documento/archivo detallado de cierre
En cada carpeta diaria, guardar uno o más archivos de detalle (según formato operativo), por ejemplo:
- Resumen de cierre detallado.
- Exportables de pedidos/items del día.
- Evidencia adicional necesaria para auditoría.

## Índice liviano en Google Sheets (`ARCHIVO_CORTES`)
La hoja `ARCHIVO_CORTES` almacena solo metadatos mínimos y enlaces para localizar el detalle en Drive.

Campos recomendados:
- `corte_id`
- `fecha_corte`
- `total_pedidos`
- `total_vendido`
- `total_burgers`
- `total_guarniciones`
- `drive_folder_url`
- `drive_summary_file_url`
- `creado_en`
- `creado_por`

## Flujo esperado de archivado
1. Ejecutar cierre diario.
2. Crear carpeta del corte en Drive (si no existe).
3. Guardar archivo(s) detallado(s) del cierre en la carpeta.
4. Insertar fila índice en `ARCHIVO_CORTES` con métricas clave y links de Drive.
5. Mantener en Sheet solo índice/sumarios ligeros y referencias de navegación.

## Alcance de datos a largo plazo
- Mantener en Sheet solo resumen operativo e índices históricos livianos.
- Mantener en Drive el detalle histórico de pedidos/items de días cerrados.
- Evitar duplicar detalle pesado de cierres dentro del Sheet principal.

## Reglas operativas
- No usar Drive como superficie de app para usuarios finales; es repositorio de archivo.
- No depender de una Web App visible de Apps Script para operar el negocio.
- Mantener compatibilidad con operación mobile-first en Burgers.exe y Chekeo 2.0.

## Beneficios del contrato
- Hoja principal más rápida y mantenible.
- Historial detallado preservado para auditoría.
- Escalabilidad: crecimiento histórico desacoplado del runtime principal en Sheets.


## Phase 7 implementation notes
- Drive-first archive is now implemented via manual Apps Script function `archiveNormalizedCloseDayToDrive()`.
- `ARCHIVO_CORTES` remains a lightweight index row per day with pointers (`drive_folder_url`, `drive_summary_file_url`).
- No destructive sheet operations are part of this phase (no clear/delete/rename operations).
- Active order rows are not removed in this phase.
- Same-day close is idempotent and duplicate-safe by `fecha_corte`.
