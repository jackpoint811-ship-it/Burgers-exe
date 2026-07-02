# 04 — Fase 1: Contrato de datos y hojas (detallado)

## 1) Hojas del sistema y propósito

| Hoja | Propósito |
|---|---|
| `Pedidos Master` | Fuente principal operativa; origen de los pedidos y datos base del cliente/pedido. |
| `Chekeo Nuevo` | Hoja de trabajo normalizada para operación diaria, seguimiento de estado y preparación de salida a ticket/WhatsApp. |
| `Chekeo` | Compatibilidad histórica y referencia de control durante transición documental. |
| `Configuración` | Hoja de datos bancarios para WhatsApp. Campos requeridos: `Banco`, `Nombre`, `Número de cuenta`. |
| `Resumen Pedidos` | Vista agregada para seguimiento operativo y control de volumen. |
| `Historico` | Resguardo histórico de pedidos cerrados y trazabilidad. |

## 2) Contrato detallado de columnas — `Chekeo Nuevo`

| Columna | Tipo esperado | Origen | Editable por app | Preservar en sync | Aparece en ticket cliente | Aparece en WhatsApp |
|---|---|---|---|---|---|---|
| ID Pedido | Texto (`BOG-` + número) | Derivado de `Fila Master` | No | Sí | Sí | No |
| Fila Master | Número entero | `Pedidos Master` (número de fila) | No | Sí | No | No |
| Fecha Pedido | Fecha (YYYY-MM-DD) | `Pedidos Master` | No | No | No | No |
| Hora Pedido | Hora (HH:MM) | `Pedidos Master` | No | No | No | No |
| Nombre | Texto | `Pedidos Master` | No | No | Sí | Sí |
| Teléfono | Texto | `Pedidos Master` | No | No | No | No |
| Resumen Pedido | Texto | `Pedidos Master` (normalizado) | No | No | Sí | No |
| Hamburguesas | Texto | `Pedidos Master` | No | No | Sí | No |
| Extras | Texto | `Pedidos Master` | No | No | Sí | No |
| Guarniciones | Texto | `Pedidos Master` | No | No | Sí | No |
| Total | Número decimal | `Pedidos Master` | No | No | Sí | Sí |
| Estado Pedido | Enum | Inicial desde `Pedidos Master`; luego operación | Sí | Sí | No | No |
| Estado Pago | Enum | Inicial desde `Pedidos Master`; luego operación | Sí | Sí | No | No |
| Método Pago | Enum | Inicial desde `Pedidos Master`; luego operación | Sí | Sí | No | No |
| Nota Interna | Texto | Operación interna | Sí | Sí | No | No |
| Nota Cliente | Texto | Operación / aclaraciones | Sí | Sí | Sí | No |
| Alerta | Texto / indicador visual (vacío o `⚠️`) | Regla de negocio | Sí (solo ajuste manual excepcional) | Sí | No | No |
| Ticket Enviado | Enum (`Si` / `No`) | Operación | Sí | Sí | No | No |
| Fecha Ticket Enviado | Fecha | Operación | Sí | Sí | No | No |
| Hora Inicio | Hora | Operación cocina | Sí | Sí | No | No |
| Hora Listo | Hora | Operación cocina | Sí | Sí | No | No |
| Última Actualización | FechaHora ISO | Sistema (sync/app) | No | No (siempre refrescable) | No | No |

## 3) Regla de ID
- Fila Master 2 → `BOG-001`
- Fila Master 3 → `BOG-002`
- Fila Master 11 → `BOG-010`
- Fila Master 1001 → `BOG-1000`

**Regla general:** `ID Pedido = "BOG-" + (Fila Master - 1)` usando mínimo 3 dígitos con cero a la izquierda y crecimiento variable cuando el número supera 3 dígitos.

**Aclaración operativa:** `ID Pedido` se genera una sola vez al crear/sincronizar por primera vez el pedido. Se deriva de la `Fila Master` original. Después se conserva y no se recalcula en sincronizaciones futuras. `Fila Master` también se conserva como referencia original. La app asume que `Pedidos Master` funciona como hoja *append-only* para pedidos; si se reordenan o insertan filas manualmente, eso debe tratarse como caso de revisión futura.

## 4) Campos que vienen de `Pedidos Master`
- `Fila Master`
- `Fecha Pedido`
- `Hora Pedido`
- `Nombre`
- `Teléfono`
- `Resumen Pedido`
- `Hamburguesas`
- `Extras`
- `Guarniciones`
- `Total`
- (semilla inicial) `Estado Pedido`, `Estado Pago`, `Método Pago`

## 5) Campos editables desde la futura app
- `Estado Pedido`
- `Estado Pago`
- `Método Pago`
- `Nota Interna`
- `Nota Cliente`
- `Alerta` (solo uso manual excepcional)
- `Ticket Enviado`
- `Fecha Ticket Enviado`
- `Hora Inicio`
- `Hora Listo`

## 6) Campos preservados al sincronizar
En toda sincronización con `Pedidos Master` se preservan los campos de referencia y operativos en `Chekeo Nuevo`:
- `Fila Master`
- `Estado Pedido`
- `Estado Pago`
- `Método Pago`
- `Nota Interna`
- `Nota Cliente`
- `Alerta`
- `Ticket Enviado`
- `Fecha Ticket Enviado`
- `Hora Inicio`
- `Hora Listo`

## 7) Campos refrescables desde `Pedidos Master`
Se refrescan desde `Pedidos Master` cuando cambie la fuente:
- `Fecha Pedido`
- `Hora Pedido`
- `Nombre`
- `Teléfono`
- `Resumen Pedido`
- `Hamburguesas`
- `Extras`
- `Guarniciones`
- `Total`

No se refrescan por sincronización:
- `ID Pedido`
- `Fila Master`
- Campos operativos preservados (sección 6)

## 8) Regla para pedidos especiales
Si en el pedido aparece cualquiera de estas señales:
- `(+1)`
- `Chequeo Manual`
- Ambigüedad en composición/cantidades

Entonces:
- Usar `Alerta` vacío cuando no hay alerta.
- Usar `Alerta = ⚠️` cuando requiere revisión.
- **No bloquear** el flujo del pedido.
- Mantener pedido visible y operable para resolución manual.

## 9) Reglas de ticket cliente
El ticket cliente debe incluir:
- `ID Pedido`
- `Nombre`
- `Resumen Pedido`
- `Hamburguesas`
- `Extras`
- `Guarniciones`
- `Nota Cliente` (si existe)
- `Total`

No debe incluir:
- `Teléfono`
- `Fila Master`
- `Estado Pedido`
- `Estado Pago`
- `Método Pago`
- `Nota Interna`
- `Alerta`
- `Ticket Enviado`
- Fechas internas
- Horas internas
- `Última Actualización`

## 10) Reglas de WhatsApp
El mensaje de WhatsApp debe incluir:
- Saludo con nombre del cliente.
- Total de la orden.
- Datos bancarios desde `Configuración`:
  - `Banco`
  - `Nombre`
  - `Número de cuenta`
- Frase indicando que se adjunta el ticket con el resumen del pedido.

Restricciones:
- No intentar adjuntar imagen automáticamente.
- No convertir WhatsApp en resumen completo del pedido.

## 11) Validaciones esperadas
- `ID Pedido` único y con formato `BOG-` + número (mínimo 3 dígitos, crecimiento variable).
- `Fila Master` numérica y sin duplicados en `Chekeo Nuevo`.
- Enums válidos para `Estado Pedido`, `Estado Pago`, `Método Pago`, `Ticket Enviado` (`Si`/`No`).
- `Alerta` solo acepta vacío (sin alerta) o `⚠️` (revisar).
- `Hamburguesas` debe aceptarse como texto libre estructurado (ej. `1x OG`, `2x BBQ`, `1x OG sin pepinillos`).
- `Total` numérico mayor o igual a 0.
- Fechas y horas en formato consistente.
- Si `Ticket Enviado = Si`, debe existir `Fecha Ticket Enviado`.
- Si hay señales especiales (`(+1)`, `Chequeo Manual`, ambigüedad), `Alerta` debe quedar en `⚠️`.
- `Configuración` debe contener `Banco`, `Nombre`, `Número de cuenta` no vacíos para construir mensaje de WhatsApp.

## 12) Criterios de cierre de Fase 1
Se considera cerrada la Fase 1 cuando:
1. Existe contrato definitivo resumido en `planning/02-data-contract.md`.
2. Existe documento detallado campo a campo en este archivo.
3. Quedan establecidas reglas de ID, sync, ticket cliente y WhatsApp.
4. Quedan definidas validaciones mínimas operativas.
5. Se registra cierre en `planning/03-phase-log.md`.
