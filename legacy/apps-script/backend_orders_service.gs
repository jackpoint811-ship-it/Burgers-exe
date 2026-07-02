function bogSyncOrdersFromMaster_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.MASTER_SHEET_NAME);
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());

  bogEnsureChekeoHeaders_(chekeoSheet);

  var masterData = bogReadSheetAsObjects_(masterSheet, BurgerOGConstants.MASTER_REQUIRED_COLUMNS);
  var chekeoData = bogReadSheetAsObjects_(chekeoSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);

  var existingByMasterRow = {};
  var existingByOrderId = {};
  chekeoData.rows.forEach(function (row) {
    var masterKey = bogTrim_(row.data['Fila Master']);
    var orderIdKey = bogTrim_(row.data['ID Pedido']);
    if (masterKey) {
      existingByMasterRow[masterKey] = row;
    }
    if (orderIdKey) {
      existingByOrderId[orderIdKey] = row;
    }
  });

  var inserted = 0;
  var updated = 0;
  var checked = 0;
  var appendRows = [];

  masterData.rows.forEach(function (masterRow) {
    var source = masterRow.data;
    if (bogIsEffectivelyEmptyOrder_(source)) {
      return;
    }

    checked += 1;
    var masterRowNumber = masterRow.rowNumber;
    var expectedOrderId = bogBuildOrderId_(masterRowNumber);
    var existing = existingByMasterRow[String(masterRowNumber)] || existingByOrderId[expectedOrderId] || null;

    var transformed = bogTransformMasterToChekeo_(source);
    var merged = bogBuildChekeoRowFromMaster_(transformed, masterRowNumber, existing && existing.data);

    var validationErrors = bogValidateChekeoRecord_(merged);
    if (validationErrors.length) {
      throw new Error('Error de validación en Fila Master ' + masterRowNumber + ': ' + validationErrors.join(' | '));
    }

    if (existing) {
      var fullRow = bogBuildRowByHeaderMap_(chekeoData.headers, chekeoData.headerMap, merged);
      chekeoSheet.getRange(existing.rowNumber, 1, 1, chekeoData.headers.length).setValues([fullRow]);
      updated += 1;
      return;
    }

    appendRows.push(bogBuildRowByHeaderMap_(chekeoData.headers, chekeoData.headerMap, merged));
    inserted += 1;
  });

  if (appendRows.length) {
    chekeoSheet
      .getRange(chekeoSheet.getLastRow() + 1, 1, appendRows.length, chekeoData.headers.length)
      .setValues(appendRows);
  }

  return {
    inserted: inserted,
    updated: updated,
    checked: checked
  };
}

function bogTransformMasterToChekeo_(masterRecord) {
  var timestamp = bogParseMasterTimestamp_(bogSafeGetByAliases_(masterRecord, ['Marca temporal']));
  var totalRaw = bogSafeGetByAliases_(masterRecord, ['Total']);
  var manualTotalRaw = bogSafeGetByAliases_(masterRecord, ['Precio Manual total']);
  var totalUsesManual = bogIsManualTotal_(totalRaw) || !bogHasUsefulValue_(totalRaw);
  var hasManualPrice = bogHasUsefulValue_(manualTotalRaw);
  var missingManualAmount = totalUsesManual && !hasManualPrice;
  var totalValue = missingManualAmount ? 0 : (totalUsesManual ? manualTotalRaw : totalRaw);

  var dynamic = bogCollectDynamicOrderParts_(masterRecord);
  var estadoPedidoRaw = bogSafeGetByAliases_(masterRecord, ['Estado?']);
  var estadoPagoRaw = bogSafeGetByAliases_(masterRecord, ['Pagado?']);
  var metodoPagoRaw = bogSafeGetByAliases_(masterRecord, ['Tipo', 'Forma de pago']);
  var ubicacionRaw = bogSafeGetByAliases_(masterRecord, ['Ubicación', 'Ubicacion', 'Lugar', 'Torre']);

  var transformed = {
    'Fecha Pedido': timestamp.fecha,
    'Hora Pedido': timestamp.hora,
    'Nombre': bogSafeGetByAliases_(masterRecord, ['Nombre']),
    'Teléfono': bogSafeGetByAliases_(masterRecord, ['Telefono', 'Teléfono']),
    'Resumen Pedido': bogBuildCompactSummary_(dynamic),
    'Hamburguesas': dynamic.hamburguesas.join(' + '),
    'Extras': dynamic.extras.join(' + '),
    'Guarniciones': dynamic.guarniciones.join(' + '),
    'Total': bogNormalizeMoney_(totalValue),
    'Estado Pedido': bogNormalizeOrderStatus_(estadoPedidoRaw),
    'Estado Pago': bogNormalizePaymentStatus_(estadoPagoRaw),
    'Método Pago': bogNormalizePaymentMethod_(metodoPagoRaw),
    'Ubicación': bogTrim_(ubicacionRaw),
    'Master Notes': dynamic.notes.join(' | '),
    'Detected Alerts': dynamic.alertReasons
  };

  if (totalUsesManual && hasManualPrice) {
    transformed['Detected Alerts'].push('total manual');
  }

  if (missingManualAmount) {
    transformed['Total'] = 0;
    transformed['Detected Alerts'].push('total faltante o manual sin precio');
  }

  if (bogIsManualTotal_(totalRaw) || bogIsManualTotal_(manualTotalRaw)) {
    transformed['Detected Alerts'].push('Chequeo Manual');
  }

  return transformed;
}

function bogCollectDynamicOrderParts_(masterRecord) {
  var hamburguesas = [];
  var extras = [];
  var guarniciones = [];
  var notes = [];
  var alertReasons = [];
  var burgerNames = [];

  Object.keys(masterRecord).forEach(function (header) {
    var value = masterRecord[header];

    var burgerLabel = bogExtractBracketLabel_(header, /^¿?\s*Cuantas\?\s*\[(.+?)\]/i);
    if (burgerLabel) {
      var count = bogParseCount_(value);
      if (count) {
        hamburguesas.push(bogFormatBurgerOrSideWithCount_(count, burgerLabel));
        burgerNames.push(burgerLabel);
      } else if (bogHasUsefulValue_(value)) {
        hamburguesas.push('1x ' + burgerLabel);
        notes.push('Cantidad no estándar en ' + burgerLabel + ': ' + bogTrim_(value));
        alertReasons.push('inconsistencias entre cantidad y personalización');
      }
      return;
    }

    var extraLabel = bogExtractBracketLabel_(header, /^Extras\s*\[(.+?)\]/i);
    if (extraLabel && bogHasUsefulValue_(value)) {
      extras.push(bogFormatExtraWithCount_(bogParseCount_(value), extraLabel));
      return;
    }

    var sideLabel = bogExtractBracketLabel_(header, /^Date\s+un\s+extra\s*\[(.+?)\]/i);
    if (sideLabel && bogHasUsefulValue_(value)) {
      guarniciones.push(bogFormatBurgerOrSideWithCount_(bogParseCount_(value), sideLabel));
      return;
    }
  });

  var generalPersonalization = [];
  ['¿Personalizar tu(s) hamburguesa(s)?', 'Describe como quieres tus Burgers'].forEach(function (headerAlias) {
    var value = bogSafeGetByAliases_(masterRecord, [headerAlias]);
    if (bogHasUsefulValue_(value)) {
      generalPersonalization.push(bogTrim_(value));
    }
  });

  if (generalPersonalization.length) {
    notes.push('Personalización general: ' + generalPersonalization.join(' / '));
    var globalNotePreview = bogTrim_(bogSafeGetByAliases_(masterRecord, ['Nota']));
    var isCloudflareOrder = globalNotePreview.indexOf('Canal: Burgers.exe Cloudflare') !== -1;
    var hasStructuredBurgerPersonalizations =
      bogHasUsefulValue_(bogSafeGetByAliases_(masterRecord, ['Burger OG'])) ||
      bogHasUsefulValue_(bogSafeGetByAliases_(masterRecord, ['BBQ Burger']));
    var shouldSkipAmbiguousAlert = isCloudflareOrder && hasStructuredBurgerPersonalizations;
    if ((hamburguesas.length > 1 || hamburguesas.length === 0) && !shouldSkipAmbiguousAlert) {
      alertReasons.push('personalización ambigua');
    }
  }

  Object.keys(masterRecord).forEach(function (header) {
    var value = masterRecord[header];
    if (!bogHasUsefulValue_(value)) {
      return;
    }

    var normalizedHeader = bogNormalizeHeaderKey_(header);
    if (normalizedHeader.indexOf('personalizar ') === 0 || normalizedHeader.indexOf('burger ') === 0) {
      notes.push(header + ': ' + bogTrim_(value));
      return;
    }

    for (var i = 0; i < burgerNames.length; i += 1) {
      if (normalizedHeader.indexOf(bogNormalizeHeaderKey_(burgerNames[i])) !== -1 && normalizedHeader.indexOf('cuantas? [') === -1) {
        notes.push(header + ': ' + bogTrim_(value));
        break;
      }
    }
  });

  var globalNote = bogSafeGetByAliases_(masterRecord, ['Nota']);
  if (bogHasUsefulValue_(globalNote)) {
    notes.push('Nota: ' + bogTrim_(globalNote));
  }

  var valuesText = Object.keys(masterRecord).map(function (header) {
    return header + ': ' + bogTrim_(masterRecord[header]);
  }).join(' | ');

  if (/\(\+1\)/i.test(valuesText)) {
    alertReasons.push('(+1)');
  }
  if (/Chequeo\s*Manual/i.test(valuesText)) {
    alertReasons.push('Chequeo Manual');
  }

  if (notes.length && hamburguesas.length === 0) {
    alertReasons.push('descripción libre que no se puede asociar claramente');
  }

  return {
    hamburguesas: bogUniqueNonEmpty_(hamburguesas),
    extras: bogUniqueNonEmpty_(extras),
    guarniciones: bogUniqueNonEmpty_(guarniciones),
    notes: bogUniqueNonEmpty_(notes),
    alertReasons: bogUniqueNonEmpty_(alertReasons)
  };
}

function bogBuildCompactSummary_(dynamicParts) {
  var parts = [];
  if (dynamicParts.hamburguesas.length) {
    parts.push(dynamicParts.hamburguesas.join(' + '));
  }
  if (dynamicParts.extras.length) {
    parts.push(dynamicParts.extras.join(' + '));
  }
  if (dynamicParts.guarniciones.length) {
    parts.push(dynamicParts.guarniciones.join(' + '));
  }
  return parts.join(' + ');
}

function bogIsManualTotal_(value) {
  var text = bogNormalizeHeaderKey_(value);
  return text.indexOf('chequeo manual') !== -1;
}

function bogNormalizeOrderStatus_(value) {
  var clean = bogTrim_(value);
  if (BurgerOGConstants.ENUMS.ESTADO_PEDIDO.indexOf(clean) !== -1) {
    return clean;
  }

  var normalized = bogNormalizeHeaderKey_(clean);
  if (
    normalized === 'en preparacion' ||
    normalized === 'preparacion'
  ) {
    return 'Preparando';
  }

  return BurgerOGConstants.DEFAULTS.ESTADO_PEDIDO;
}

function bogNormalizePaymentStatus_(value) {
  var normalized = bogNormalizeHeaderKey_(value);
  if (normalized === 'si' || normalized === 'sí' || normalized === 'pagado') {
    return 'Pagado';
  }
  return BurgerOGConstants.DEFAULTS.ESTADO_PAGO;
}

function bogBuildChekeoRowFromMaster_(transformed, masterRowNumber, existingRecord) {
  var row = {};

  row['ID Pedido'] = existingRecord ? existingRecord['ID Pedido'] : bogBuildOrderId_(masterRowNumber);
  row['Fila Master'] = existingRecord ? existingRecord['Fila Master'] : String(masterRowNumber);

  row['Fecha Pedido'] = transformed['Fecha Pedido'] || '';
  row['Hora Pedido'] = transformed['Hora Pedido'] || '';
  row['Nombre'] = transformed['Nombre'] || '';
  row['Teléfono'] = transformed['Teléfono'] || '';
  row['Resumen Pedido'] = transformed['Resumen Pedido'] || '';
  row['Hamburguesas'] = transformed['Hamburguesas'] || '';
  row['Extras'] = transformed['Extras'] || '';
  row['Guarniciones'] = transformed['Guarniciones'] || '';
  row['Guarnición Lista'] = (existingRecord && existingRecord['Guarnición Lista']) || BurgerOGConstants.DEFAULTS.GUARNICION_LISTA;
  row['Ubicación'] = transformed['Ubicación'] || '';
  row['Total'] = transformed['Total'] || 0;

  row['Estado Pedido'] = (existingRecord && existingRecord['Estado Pedido']) || transformed['Estado Pedido'] || BurgerOGConstants.DEFAULTS.ESTADO_PEDIDO;
  row['Estado Pago'] = (existingRecord && existingRecord['Estado Pago']) || transformed['Estado Pago'] || BurgerOGConstants.DEFAULTS.ESTADO_PAGO;
  row['Método Pago'] = (existingRecord && existingRecord['Método Pago']) || transformed['Método Pago'] || BurgerOGConstants.DEFAULTS.METODO_PAGO;
  row['Nota Interna'] = (existingRecord && existingRecord['Nota Interna']) || transformed['Master Notes'] || '';
  row['Nota Cliente'] = (existingRecord && existingRecord['Nota Cliente']) || '';

  var incomingAlert = transformed['Detected Alerts'] && transformed['Detected Alerts'].length ? '⚠️' : '';
  row['Alerta'] = bogNormalizeAlertValue_((existingRecord && existingRecord['Alerta']) || incomingAlert);

  row['Ticket Enviado'] = (existingRecord && existingRecord['Ticket Enviado']) || BurgerOGConstants.DEFAULTS.TICKET_ENVIADO;
  row['Fecha Ticket Enviado'] = (existingRecord && existingRecord['Fecha Ticket Enviado']) || '';
  row['Hora Inicio'] = (existingRecord && existingRecord['Hora Inicio']) || '';
  row['Hora Listo'] = (existingRecord && existingRecord['Hora Listo']) || '';
  row['Última Actualización'] = bogNowIso_();

  return row;
}

function bogGetAppOrders_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  bogEnsureChekeoHeaders_(chekeoSheet);
  var chekeoData = bogReadSheetAsObjects_(chekeoSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);

  return chekeoData.rows
    .map(function (row) { return row.data; })
    .filter(function (record) { return bogTrim_(record['ID Pedido']) !== ''; });
}

function bogGetOrderDetail_(orderId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  bogEnsureChekeoHeaders_(chekeoSheet);
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);
  return found ? found.rowData : null;
}

function bogMarkOrderSideReady_(orderId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  bogEnsureChekeoHeaders_(chekeoSheet);
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);
  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, {
    'Guarnición Lista': 'Si',
    'Última Actualización': bogNowIso_()
  });

  return {
    orderId: orderId,
    guarnicionLista: 'Si'
  };
}

function bogUpdateOrderStatus_(orderId, nextStatus) {
  if (BurgerOGConstants.ENUMS.ESTADO_PEDIDO.indexOf(nextStatus) === -1) {
    throw new Error('Estado Pedido inválido: ' + nextStatus);
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);

  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  var patch = {
    'Estado Pedido': nextStatus,
    'Última Actualización': bogNowIso_()
  };

  if (nextStatus === 'Preparando' && bogTrim_(found.rowData['Hora Inicio']) === '') {
    patch['Hora Inicio'] = bogNowTimeMx_();
  }

  if (nextStatus === 'Listo' && bogTrim_(found.rowData['Hora Listo']) === '') {
    patch['Hora Listo'] = bogNowTimeMx_();
  }

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, patch);
  return { orderId: orderId, updatedFields: patch };
}



function bogUpdateOrderOperationalData_(orderId, payload) {
  var nextStatus = payload && payload.status;
  var paymentStatus = payload && payload.paymentStatus;
  var paymentMethod = payload && payload.paymentMethod;

  if (BurgerOGConstants.ENUMS.ESTADO_PEDIDO.indexOf(nextStatus) === -1) {
    throw new Error('Estado Pedido inválido: ' + nextStatus);
  }
  if (BurgerOGConstants.ENUMS.ESTADO_PAGO.indexOf(paymentStatus) === -1) {
    throw new Error('Estado Pago inválido: ' + paymentStatus);
  }
  if (BurgerOGConstants.ENUMS.METODO_PAGO.indexOf(paymentMethod) === -1) {
    throw new Error('Método Pago inválido: ' + paymentMethod);
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);

  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  var patch = {
    'Estado Pedido': nextStatus,
    'Estado Pago': paymentStatus,
    'Método Pago': paymentMethod,
    'Nota Interna': bogTrim_(payload && payload.noteInternal),
    'Nota Cliente': bogTrim_(payload && payload.noteClient),
    'Última Actualización': bogNowIso_()
  };

  if (nextStatus === 'Preparando' && bogTrim_(found.rowData['Hora Inicio']) === '') {
    patch['Hora Inicio'] = bogNowTimeMx_();
  }

  if (nextStatus === 'Listo' && bogTrim_(found.rowData['Hora Listo']) === '') {
    patch['Hora Listo'] = bogNowTimeMx_();
  }

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, patch);
  return { orderId: orderId, updatedFields: patch };
}

function bogUpdateOrderPayment_(orderId, paymentStatus, paymentMethod) {
  if (BurgerOGConstants.ENUMS.ESTADO_PAGO.indexOf(paymentStatus) === -1) {
    throw new Error('Estado Pago inválido: ' + paymentStatus);
  }

  if (BurgerOGConstants.ENUMS.METODO_PAGO.indexOf(paymentMethod) === -1) {
    throw new Error('Método Pago inválido: ' + paymentMethod);
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);

  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  var patch = {
    'Estado Pago': paymentStatus,
    'Método Pago': paymentMethod,
    'Última Actualización': bogNowIso_()
  };

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, patch);
  return { orderId: orderId, updatedFields: patch };
}

function bogMarkOrderPaid_(orderId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);

  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  var patch = {
    'Estado Pago': 'Pagado',
    'Última Actualización': bogNowIso_()
  };

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, patch);
  return { orderId: orderId, updatedFields: patch };
}

function bogUpdateOrderNotes_(orderId, noteInternal, noteClient) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);

  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  var patch = {
    'Nota Interna': bogTrim_(noteInternal),
    'Nota Cliente': bogTrim_(noteClient),
    'Última Actualización': bogNowIso_()
  };

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, patch);
  return { orderId: orderId, updatedFields: patch };
}

function bogMarkTicketSent_(orderId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var found = bogFindChekeoOrderRowById_(chekeoSheet, orderId);

  if (!found) {
    throw new Error('Pedido no encontrado: ' + orderId);
  }

  var patch = {
    'Ticket Enviado': 'Si',
    'Fecha Ticket Enviado': bogNowDateMx_(),
    'Última Actualización': bogNowIso_()
  };

  bogPatchRowByHeaders_(chekeoSheet, found.rowNumber, found.headerMap, patch);
  return { orderId: orderId, updatedFields: patch };
}
