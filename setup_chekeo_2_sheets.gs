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

function previewChekeo2SheetSetup() {
  return runChekeo2SheetSetup_(true);
}

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
    conflicts: [],
    timestamp: new Date().toISOString()
  };

  var sheetNames = Object.keys(CHEKEO_2_SHEET_HEADERS);
  for (var i = 0; i < sheetNames.length; i++) {
    var sheetName = sheetNames[i];
    var expectedHeaders = CHEKEO_2_SHEET_HEADERS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    var isCreated = false;

    if (!sheet) {
      summary.createdSheets.push(sheetName);
      isCreated = true;
      if (!dryRun) {
        sheet = ss.insertSheet(sheetName);
      }
    } else {
      summary.existingSheets.push(sheetName);
    }

    if (dryRun && isCreated) {
      summary.updatedHeaders[sheetName] = expectedHeaders.slice();
      summary.skippedHeaders[sheetName] = [];
      continue;
    }

    var isEmptySheet = isSheetCompletelyEmpty_(sheet);
    var existingRow1 = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    var row1Matches = doesRow1MatchHeaders_(existingRow1, expectedHeaders);

    if (isCreated || isEmptySheet) {
      if (!dryRun) {
        applyHeadersAndFormatting_(sheet, expectedHeaders);
      }
      summary.updatedHeaders[sheetName] = expectedHeaders.slice();
      summary.skippedHeaders[sheetName] = [];
      continue;
    }

    if (row1Matches) {
      if (!dryRun) {
        applyHeaderFormattingOnly_(sheet, expectedHeaders.length);
      }
      summary.updatedHeaders[sheetName] = [];
      summary.skippedHeaders[sheetName] = expectedHeaders.slice();
      continue;
    }

    summary.updatedHeaders[sheetName] = [];
    summary.skippedHeaders[sheetName] = expectedHeaders.slice();
    summary.conflicts.push({
      sheetName: sheetName,
      reason: 'Existing non-empty sheet with row 1 that does not match expected header contract.',
      existingRow1: existingRow1,
      expectedHeaders: expectedHeaders.slice()
    });
  }

  return summary;
}

function isSheetCompletelyEmpty_(sheet) {
  return sheet.getLastRow() === 0 && sheet.getLastColumn() === 0;
}

function doesRow1MatchHeaders_(existingRow1, expectedHeaders) {
  for (var i = 0; i < expectedHeaders.length; i++) {
    var existingText = normalizeCellText_(existingRow1[i]);
    if (existingText !== expectedHeaders[i]) {
      return false;
    }
  }
  return true;
}

function normalizeCellText_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function applyHeadersAndFormatting_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  applyHeaderFormattingOnly_(sheet, headers.length);
}

function applyHeaderFormattingOnly_(sheet, headerLength) {
  var headerRange = sheet.getRange(1, 1, 1, headerLength);
  sheet.setFrozenRows(1);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f1f3f4');
}
