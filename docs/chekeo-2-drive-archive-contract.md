# Chekeo 2.0 – Drive Archive Contract (Cierre diario e histórico)

## Objetivo
Definir cómo se almacena el cierre diario y el histórico detallado usando **Google Drive** como archivo externo, manteniendo Google Sheets liviano y operativo.

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
La hoja `ARCHIVO_CORTES` almacena solo metadatos mínimos para localizar el detalle en Drive:

Columnas recomendadas:
- `corte_id`
- `fecha_corte`
- `drive_folder_id`
- `drive_file_id_principal`
- `resumen`
- `creado_en`
- `creado_por`

## Flujo esperado de archivado
1. Ejecutar cierre diario.
2. Crear carpeta del corte en Drive (si no existe).
3. Guardar archivo(s) detallado(s) del cierre en la carpeta.
4. Insertar fila índice en `ARCHIVO_CORTES` con IDs de Drive.
5. Mantener en Sheet solo el índice y agregados necesarios.

## Alcance de datos a largo plazo
- Mantener a largo plazo el histórico de pedidos (nivel negocio) y el enlace al archivo detallado en Drive.
- Evitar duplicar detalle pesado de cierres dentro del Sheet principal.

## Reglas operativas
- No usar Drive como superficie de app para usuarios finales; es repositorio de archivo.
- No depender de una Web App visible de Apps Script para operar el negocio.
- Mantener compatibilidad con operación mobile-first en Burgers.exe y Chekeo 2.0.

## Beneficios del contrato
- Hoja principal más rápida y mantenible.
- Historial detallado preservado para auditoría.
- Escalabilidad: crecimiento histórico desacoplado del runtime principal en Sheets.
