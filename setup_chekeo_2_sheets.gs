/**
 * Phase 1 setup for Chekeo 2.0 normalized Sheets backend.
 * Manual and non-destructive tooling only.
 */

var CHEKEO_2_SHEET_HEADERS = {
  HOME: ['clave', 'valor', 'actualizado_en', 'actualizado_por'],
  AJUSTES_APP: ['ajuste', 'valor', 'descripcion', 'ambito', 'editable', 'actualizado_en', 'actualizado_por'],
  MENU_LIVE: ['producto_id', 'tipo', 'nombre', 'descripcion', 'precio_publico', 'activo', 'orden_visual', 'imagen', 'origen_costo_ref', 'actualizado_en', 'actualizado_por'],
  INVENTARIO: ['insumo_id', 'insumo', 'categoria', 'unidad', 'stock_actual', 'stock_minimo', 'costo_unitario_ref', 'activo', 'actualizado_en', 'actualizado_por'],
  COSTOS_PRECIOS: ['producto_id', 'nombre_producto', 'costo_total', 'margen_objetivo', 'precio_sugerido', 'precio_vigente_menu_live', 'diferencia', 'actualizado_en', 'actualizado_por'],
  PEDIDOS: ['pedido_id', 'folio', 'canal', 'cliente_nombre', 'cliente_telefono', 'metodo_pago', 'total', 'estado', 'fecha_creacion', 'fecha_actualizacion', 'origen_app'],
  PEDIDO_ITEMS: ['pedido_item_id', 'pedido_id', 'producto_id', 'tipo', 'nombre', 'cantidad', 'precio_unitario', 'subtotal', 'notas'],
  PEDIDO_BURGERS: ['pedido_burger_id', 'pedido_id', 'pedido_item_id', 'burger_base_id', 'extras_json', 'sin_ingredientes_json', 'comentarios'],
  GUARNICIONES: ['guarnicion_id', 'pedido_id', 'pedido_item_id', 'producto_id', 'cantidad', 'estado_guarnicion', 'responsable', 'actualizado_en'],
  EVENTOS_PEDIDO: ['evento_id', 'pedido_id', 'tipo_evento', 'estado_anterior', 'estado_nuevo', 'detalle', 'usuario', 'timestamp', 'origen_app'],
  RESUMEN_DIARIO: ['fecha', 'pedidos_total', 'ventas_total', 'cancelados_total', 'ticket_promedio', 'ultimo_calculo_en'],
  HISTORICO_PEDIDOS: ['pedido_id', 'folio', 'fecha_cierre', 'total', 'estado_final', 'cliente_hash_o_ref', 'drive_corte_ref'],
  ARCHIVO_CORTES: ['corte_id', 'fecha_corte', 'total_pedidos', 'total_vendido', 'total_burgers', 'total_guarniciones', 'drive_folder_url', 'drive_summary_file_url', 'creado_en', 'creado_por']
};

/**
 * Preview only: reports what setupChekeo2Sheets would do without changing the spreadsheet.
 * @return {{createdSheets: string[], existingSheets: string[], updatedHeaders: Object<string, string[]>, skippedHeaders: Object<string, string[]>, timestamp: string}}
 */
function previewChekeo2SheetSetup() {
  return runChekeo2SheetSetup_(true);
}

/**
 * Manual setup: creates missing sheets and safely fills missing header cells in row 1.
 * Idempotent and non-destructive.
 * @return {{createdSheets: string[], existingSheets: string[], updatedHeaders: Object<string, string[]>, skippedHeaders: Object<string, string[]>, timestamp: string}}
 */
function setupChekeo2Sheets() {
  return runChekeo2SheetSetup_(false);
}

function runChekeo2SheetSetup_(dryRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summary = {
    createdSheets: [],
    existingSheets: [],
    updatedHeaders: {},
    skippedHeaders: {},
    timestamp: new Date().toISOString()
  };

  var sheetNames = Object.keys(CHEKEO_2_SHEET_HEADERS);
  for (var i = 0; i < sheetNames.length; i++) {
    var sheetName = sheetNames[i];
    var headers = CHEKEO_2_SHEET_HEADERS[sheetName];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      summary.createdSheets.push(sheetName);
      if (!dryRun) {
        sheet = ss.insertSheet(sheetName);
      }
    } else {
      summary.existingSheets.push(sheetName);
    }

    if (dryRun && !sheet) {
      summary.updatedHeaders[sheetName] = headers.slice();
      continue;
    }

    var updated = [];
    var skipped = [];
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    var existingValues = headerRange.getValues()[0];

    for (var col = 0; col < headers.length; col++) {
      var expected = headers[col];
      var existing = existingValues[col];
      var existingText = existing === null || existing === undefined ? '' : String(existing).trim();

      if (existingText === '') {
        updated.push(expected);
        if (!dryRun) {
          sheet.getRange(1, col + 1).setValue(expected);
        }
      } else {
        skipped.push(expected);
      }
    }

    summary.updatedHeaders[sheetName] = updated;
    summary.skippedHeaders[sheetName] = skipped;

    if (!dryRun) {
      sheet.setFrozenRows(1);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f1f3f4');
    }
  }

  return summary;
}
