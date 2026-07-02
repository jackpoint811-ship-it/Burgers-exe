function bogGetDailySummary_() {
  var orders = bogGetAppOrders_();

  var summary = {
    totalVendido: 0,
    totalPagado: 0,
    totalPendiente: 0,
    conteoEstadoPedido: {},
    conteoEstadoPago: {}
  };

  orders.forEach(function (order) {
    var total = bogNormalizeMoney_(order['Total']);
    var estadoPago = bogTrim_(order['Estado Pago']) || BurgerOGConstants.DEFAULTS.ESTADO_PAGO;
    var estadoPedido = bogTrim_(order['Estado Pedido']) || BurgerOGConstants.DEFAULTS.ESTADO_PEDIDO;

    summary.totalVendido += total;
    if (estadoPago === 'Pagado') {
      summary.totalPagado += total;
    } else {
      summary.totalPendiente += total;
    }

    summary.conteoEstadoPedido[estadoPedido] = (summary.conteoEstadoPedido[estadoPedido] || 0) + 1;
    summary.conteoEstadoPago[estadoPago] = (summary.conteoEstadoPago[estadoPago] || 0) + 1;
  });

  return summary;
}

function bogGetCloseDayPreview_() {
  var orders = bogGetAppOrders_();

  var preview = {
    totalPedidos: 0,
    pedidosArchivables: 0,
    pedidosNoArchivables: 0,
    listosPendientesPago: 0,
    pagadosNoListos: 0,
    conAlerta: 0,
    sinTicketEnviado: 0,
    totalVendido: 0,
    totalPagado: 0,
    totalPendiente: 0,
    archivables: [],
    noArchivables: []
  };

  orders.forEach(function (order) {
    var total = bogNormalizeMoney_(order['Total']);
    var estadoPedido = bogTrim_(order['Estado Pedido']);
    var estadoPago = bogTrim_(order['Estado Pago']);
    var ticketEnviado = bogTrim_(order['Ticket Enviado']);
    var alerta = bogNormalizeAlertValue_(order['Alerta']);
    var isArchivable = bogIsArchivableOrder_(order);

    preview.totalPedidos += 1;
    preview.totalVendido += total;

    if (estadoPago === 'Pagado') {
      preview.totalPagado += total;
    } else {
      preview.totalPendiente += total;
    }

    if (alerta === '⚠️') {
      preview.conAlerta += 1;
    }

    if (ticketEnviado !== 'Si') {
      preview.sinTicketEnviado += 1;
    }

    if (estadoPedido === 'Listo' && estadoPago !== 'Pagado') {
      preview.listosPendientesPago += 1;
    }

    if (estadoPago === 'Pagado' && estadoPedido !== 'Listo') {
      preview.pagadosNoListos += 1;
    }

    if (isArchivable) {
      preview.pedidosArchivables += 1;
      preview.archivables.push({
        'ID Pedido': bogTrim_(order['ID Pedido']),
        'Nombre': bogTrim_(order['Nombre']),
        'Total': total,
        'Estado Pedido': estadoPedido,
        'Estado Pago': estadoPago,
        'Ticket Enviado': ticketEnviado || 'No',
        'Alerta': alerta
      });
      return;
    }

    preview.pedidosNoArchivables += 1;
    preview.noArchivables.push({
      'ID Pedido': bogTrim_(order['ID Pedido']),
      'Nombre': bogTrim_(order['Nombre']),
      razon: bogBuildNoArchivableReason_(estadoPedido, estadoPago)
    });
  });

  return preview;
}

function bogWriteDailySummary_(forcedCorteId, forcedPreview) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var summarySheet = bogGetOrCreateSheet_(spreadsheet, BurgerOGConstants.SHEETS.SUMMARY_SHEET_NAME);
  var summaryHeaderMap = bogEnsureSheetHeaders_(summarySheet, BurgerOGConstants.SUMMARY_COLUMNS);
  var summaryHeaders = summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).getValues()[0];

  var preview = forcedPreview || bogGetCloseDayPreview_();
  var nowParts = bogNowDateParts_();
  var corteId = forcedCorteId || bogBuildCorteId_();
  var notas = [];

  if (preview.pedidosNoArchivables > 0) {
    notas.push('Quedan ' + preview.pedidosNoArchivables + ' pedidos no archivables en Chekeo Nuevo.');
  }
  if (preview.conAlerta > 0) {
    notas.push('Pedidos con alerta: ' + preview.conAlerta + '.');
  }
  if (preview.sinTicketEnviado > 0) {
    notas.push('Pedidos sin ticket enviado: ' + preview.sinTicketEnviado + '.');
  }
  if (!notas.length) {
    notas.push('Corte sin advertencias.');
  }

  var existing = [];
  if (summarySheet.getLastRow() > 1) {
    existing = bogReadSheetAsObjects_(summarySheet, BurgerOGConstants.SUMMARY_REQUIRED_COLUMNS).rows;
  }

  var alreadyExists = existing.some(function (row) {
    return bogTrim_(row.data['Corte ID']) === corteId;
  });

  if (alreadyExists) {
    return {
      corteId: corteId,
      created: false,
      reason: 'Corte ya registrado en esta ejecución.',
      preview: preview
    };
  }

  var record = {
    'Corte ID': corteId,
    'Fecha Corte': nowParts.fecha,
    'Hora Corte': nowParts.hora,
    'Total Pedidos': preview.totalPedidos,
    'Pedidos Archivables': preview.pedidosArchivables,
    'Pedidos No Archivables': preview.pedidosNoArchivables,
    'Total Vendido': preview.totalVendido,
    'Total Pagado': preview.totalPagado,
    'Total Pendiente': preview.totalPendiente,
    'Con Alerta': preview.conAlerta,
    'Sin Ticket Enviado': preview.sinTicketEnviado,
    'Notas': notas.join(' '),
    'IDs Archivables': preview.archivables.map(function (item) { return item['ID Pedido']; }).join(', '),
    'IDs No Archivables': preview.noArchivables.map(function (item) { return item['ID Pedido']; }).join(', '),
    'Generado En': bogNowIso_()
  };

  var row = bogBuildRowByHeaderMap_(summaryHeaders, summaryHeaderMap, record);
  summarySheet.getRange(summarySheet.getLastRow() + 1, 1, 1, summaryHeaders.length).setValues([row]);

  return {
    corteId: corteId,
    created: true,
    preview: preview
  };
}

function bogArchiveCompletedOrders_(forcedCorteId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var historySheet = bogGetOrCreateSheet_(spreadsheet, BurgerOGConstants.SHEETS.HISTORY_SHEET_NAME);

  var chekeoData = bogReadSheetAsObjects_(chekeoSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);
  var historyHeaderMap = bogEnsureSheetHeaders_(historySheet, BurgerOGConstants.HISTORY_COLUMNS);
  var historyHeaders = historySheet.getRange(1, 1, 1, historySheet.getLastColumn()).getValues()[0];

  var existingHistoryIds = {};
  if (historySheet.getLastRow() > 1) {
    var historyData = bogReadSheetAsObjects_(historySheet, BurgerOGConstants.HISTORY_COLUMNS);
    historyData.rows.forEach(function (row) {
      var orderId = bogTrim_(row.data['ID Pedido']);
      if (orderId) {
        existingHistoryIds[orderId] = true;
      }
    });
  }

  var nowParts = bogNowDateParts_();
  var corteId = forcedCorteId || bogBuildCorteId_();
  var rowsToDelete = [];
  var rowsToInsert = [];

  var result = {
    corteId: corteId,
    archivados: 0,
    omitidosDuplicado: 0,
    eliminados: 0,
    idsArchivados: [],
    idsDuplicados: []
  };

  chekeoData.rows.forEach(function (row) {
    var order = row.data;
    var orderId = bogTrim_(order['ID Pedido']);

    if (!orderId || !bogIsArchivableOrder_(order)) {
      return;
    }

    if (existingHistoryIds[orderId]) {
      result.omitidosDuplicado += 1;
      result.idsDuplicados.push(orderId);
      rowsToDelete.push(row.rowNumber);
      return;
    }

    var historyRecord = {};
    BurgerOGConstants.CHEKEO_COLUMNS.forEach(function (column) {
      historyRecord[column] = order[column];
    });
    historyRecord['Fecha Archivado'] = nowParts.fecha;
    historyRecord['Hora Archivado'] = nowParts.hora;
    historyRecord['Corte ID'] = corteId;
    historyRecord['Motivo Archivo'] = 'Cierre operativo';

    rowsToInsert.push(bogBuildRowByHeaderMap_(historyHeaders, historyHeaderMap, historyRecord));
    existingHistoryIds[orderId] = true;
    result.archivados += 1;
    result.idsArchivados.push(orderId);
    rowsToDelete.push(row.rowNumber);
  });

  if (rowsToInsert.length) {
    historySheet
      .getRange(historySheet.getLastRow() + 1, 1, rowsToInsert.length, historyHeaders.length)
      .setValues(rowsToInsert);
  }

  if (rowsToDelete.length) {
    bogDeleteRowsDescending_(chekeoSheet, rowsToDelete);
    result.eliminados = rowsToDelete.length;
  }

  return result;
}

function bogCloseDay_() {
  var initialPreview = bogGetCloseDayPreview_();
  var corteId = bogBuildCorteId_();
  var summaryResult = bogWriteDailySummary_(corteId, initialPreview);
  var archiveResult = bogArchiveCompletedOrders_(corteId);
  var finalPreview = bogGetCloseDayPreview_();

  var message = archiveResult.archivados > 0
    ? 'Cierre completado con archivo parcial/total de pedidos Listo + Pagado.'
    : 'Cierre completado sin archivados: no había pedidos Listo + Pagado.';

  return {
    message: message,
    corteId: corteId,
    previewInicial: initialPreview,
    resumen: summaryResult,
    archivo: archiveResult,
    previewFinal: finalPreview
  };
}

function bogGetHistoryPreview_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var historySheet = bogGetOrCreateSheet_(spreadsheet, BurgerOGConstants.SHEETS.HISTORY_SHEET_NAME);
  bogEnsureSheetHeaders_(historySheet, BurgerOGConstants.HISTORY_COLUMNS);

  if (historySheet.getLastRow() <= 1) {
    return {
      totalHistorico: 0,
      ultimosPedidosArchivados: [],
      totalVendidoHistorico: 0,
      ultimosCortes: []
    };
  }

  var historyData = bogReadSheetAsObjects_(historySheet, BurgerOGConstants.HISTORY_COLUMNS);
  var rows = historyData.rows
    .map(function (row) { return row.data; })
    .filter(function (row) { return bogTrim_(row['ID Pedido']) !== ''; });

  var totalVendidoHistorico = 0;
  var cortes = {};

  rows.forEach(function (order) {
    totalVendidoHistorico += bogNormalizeMoney_(order['Total']);
    var corteId = bogTrim_(order['Corte ID']);
    if (corteId) {
      if (!cortes[corteId]) {
        cortes[corteId] = {
          corteId: corteId,
          fechaArchivado: bogTrim_(order['Fecha Archivado']),
          horaArchivado: bogTrim_(order['Hora Archivado']),
          pedidos: 0,
          total: 0
        };
      }
      cortes[corteId].pedidos += 1;
      cortes[corteId].total += bogNormalizeMoney_(order['Total']);
    }
  });

  var ultimosPedidos = rows.slice(-20).reverse().map(function (order) {
    return {
      'ID Pedido': bogTrim_(order['ID Pedido']),
      'Nombre': bogTrim_(order['Nombre']),
      'Total': bogNormalizeMoney_(order['Total']),
      'Fecha Archivado': bogTrim_(order['Fecha Archivado']),
      'Hora Archivado': bogTrim_(order['Hora Archivado']),
      'Corte ID': bogTrim_(order['Corte ID'])
    };
  });

  var ultimosCortes = Object.keys(cortes)
    .map(function (key) { return cortes[key]; })
    .sort(function (a, b) { return String(b.corteId).localeCompare(String(a.corteId)); })
    .slice(0, 20);

  return {
    totalHistorico: rows.length,
    ultimosPedidosArchivados: ultimosPedidos,
    totalVendidoHistorico: totalVendidoHistorico,
    ultimosCortes: ultimosCortes
  };
}

function bogGetHistoryOrders_(limit) {
  var preview = bogGetHistoryPreview_();
  var safeLimit = Number(limit);
  if (!safeLimit || safeLimit < 1) {
    safeLimit = 30;
  }

  return preview.ultimosPedidosArchivados.slice(0, safeLimit);
}

function bogBuildNoArchivableReason_(estadoPedido, estadoPago) {
  if (estadoPedido !== 'Listo' && estadoPago !== 'Pagado') {
    return 'Estado Pedido debe ser Listo y Estado Pago debe ser Pagado.';
  }
  if (estadoPedido !== 'Listo') {
    return 'Estado Pedido pendiente de Listo.';
  }
  return 'Estado Pago pendiente de Pagado.';
}

function bogIsArchivableOrder_(order) {
  return bogTrim_(order['Estado Pedido']) === 'Listo' && bogTrim_(order['Estado Pago']) === 'Pagado';
}

function bogGetBankConfig_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.CONFIG_SHEET_NAME);
  var values = configSheet.getDataRange().getValues();

  if (!values.length) {
    throw new Error('La hoja Configuración está vacía.');
  }

  var headers = values[0];
  var normalizedHeaderMap = bogGetHeaderMap_(headers);
  var bancoIndex = normalizedHeaderMap[bogNormalizeHeaderKey_('Banco')];
  var nombreIndex = normalizedHeaderMap[bogNormalizeHeaderKey_('Nombre')];
  var cuentaIndex = normalizedHeaderMap[bogNormalizeHeaderKey_('Número de cuenta')];

  if (bancoIndex !== undefined && nombreIndex !== undefined && cuentaIndex !== undefined) {
    for (var i = 1; i < values.length; i += 1) {
      var row = values[i];
      var rowConfig = {
        Banco: bogTrim_(row[bancoIndex]),
        Nombre: bogTrim_(row[nombreIndex]),
        'Número de cuenta': bogTrim_(row[cuentaIndex])
      };

      if (rowConfig.Banco || rowConfig.Nombre || rowConfig['Número de cuenta']) {
        return bogValidateBankConfigOrThrow_(rowConfig, 'Formato por columnas incompleto');
      }
    }
  }

  var keyValue = {};
  values.forEach(function (row) {
    var key = bogNormalizeHeaderKey_(row[0]);
    var value = bogTrim_(row[1]);
    if (key) {
      keyValue[key] = value;
    }
  });

  var fieldValueConfig = {
    Banco: keyValue[bogNormalizeHeaderKey_('Banco')] || '',
    Nombre: keyValue[bogNormalizeHeaderKey_('Nombre')] || '',
    'Número de cuenta': keyValue[bogNormalizeHeaderKey_('Número de cuenta')] || ''
  };

  return bogValidateBankConfigOrThrow_(fieldValueConfig, 'Formato Campo|Valor incompleto');
}

function bogValidateBankConfigOrThrow_(config, contextLabel) {
  var missing = [];

  if (!config.Banco) {
    missing.push('Banco');
  }
  if (!config.Nombre) {
    missing.push('Nombre');
  }
  if (!config['Número de cuenta']) {
    missing.push('Número de cuenta');
  }

  if (missing.length) {
    throw new Error(contextLabel + ': faltan ' + missing.join(', ') + '.');
  }

  return config;
}
