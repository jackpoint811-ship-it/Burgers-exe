var BOG_NORMALIZED_ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Listo', 'Cancelado', 'Completado'];
var BOG_NORMALIZED_PAYMENT_STATUSES = ['Pendiente', 'Pagado', 'Parcial', 'Cancelado'];
var BOG_NORMALIZED_OPERATIONAL_PEDIDOS_HEADERS = ['estado_pago', 'nota_interna', 'nota_cliente', 'ticket_enviado', 'ticket_enviado_en'];
var BOG_NORMALIZED_OPEN_ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Listo'];

function ensureNormalizedOperationalHeaders() {
  return bogNormalizedWrite_(function () {
    return bogEnsureNormalizedOperationalHeaders_();
  }, 'Headers operativos normalizados verificados.');
}

function previewNormalizedOperationsReadiness() {
  return bogNormalizedRead_(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetNames = Object.keys(BOG_NORMALIZED_SHEETS);
    var missingHeadersBySheet = {};
    var pedidosCount = 0;
    var openOrdersCount = 0;
    var pendingGuarnicionesCount = 0;

    sheetNames.forEach(function (key) {
      var sheetName = BOG_NORMALIZED_SHEETS[key];
      var expectedHeaders = BOG_NORMALIZED_HEADERS[key];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        missingHeadersBySheet[sheetName] = expectedHeaders.slice();
        return;
      }

      var headerValues = bogGetHeaderRowValues_(sheet, expectedHeaders.length);
      var headerMap = bogGetHeaderMap_(headerValues);
      var missing = bogFindMissingHeaders_(headerMap, expectedHeaders);
      if (missing.length) missingHeadersBySheet[sheetName] = missing;

      if (sheetName === BOG_NORMALIZED_SHEETS.PEDIDOS && missing.length === 0) {
        var pedidosData = bogReadSheetAsObjects_(sheet, expectedHeaders).rows.map(function (row) { return row.data; });
        pedidosCount = pedidosData.length;
        openOrdersCount = pedidosData.filter(function (pedido) {
          return BOG_NORMALIZED_OPEN_ORDER_STATUSES.indexOf(bogTrim_(pedido.estado)) !== -1;
        }).length;
      }

      if (sheetName === BOG_NORMALIZED_SHEETS.GUARNICIONES && missing.length === 0) {
        var guarnicionesData = bogReadSheetAsObjects_(sheet, expectedHeaders).rows.map(function (row) { return row.data; });
        pendingGuarnicionesCount = guarnicionesData.filter(function (guarnicion) {
          return bogNormalizeHeaderKey_(guarnicion.estado_guarnicion) !== bogNormalizeHeaderKey_('Hecha');
        }).length;
      }
    });

    return {
      ok: Object.keys(missingHeadersBySheet).length === 0,
      missingHeadersBySheet: missingHeadersBySheet,
      pedidosCount: pedidosCount,
      openOrdersCount: openOrdersCount,
      pendingGuarnicionesCount: pendingGuarnicionesCount,
      timestamp: bogNowIso_()
    };
  }, 'Diagnóstico de operaciones normalizadas obtenido.');
}

function updateNormalizedOrderStatus(pedidoId, nextStatus, user) {
  return bogNormalizedWrite_(function () {
    return bogUpdateNormalizedOrderStatus_(pedidoId, nextStatus, user);
  }, 'Estado normalizado actualizado.');
}

function updateNormalizedPaymentStatus(pedidoId, estadoPago, metodoPago, user) {
  return bogNormalizedWrite_(function () {
    return bogUpdateNormalizedPaymentStatus_(pedidoId, estadoPago, metodoPago, user);
  }, 'Pago normalizado actualizado.');
}

function markNormalizedOrderPaid(pedidoId, user) {
  return bogNormalizedWrite_(function () {
    return bogUpdateNormalizedPaymentStatus_(pedidoId, 'Pagado', '', user);
  }, 'Pedido normalizado marcado como pagado.');
}

function markNormalizedGuarnicionDone(guarnicionIdOrPedidoId, user) {
  return bogNormalizedWrite_(function () {
    return bogMarkNormalizedGuarnicionDone_(guarnicionIdOrPedidoId, user);
  }, 'Guarnición normalizada marcada como hecha.');
}

function updateNormalizedOrderNotes(pedidoId, notaInterna, notaCliente, user) {
  return bogNormalizedWrite_(function () {
    return bogUpdateNormalizedOrderNotes_(pedidoId, notaInterna, notaCliente, user);
  }, 'Notas normalizadas actualizadas.');
}

function markNormalizedTicketSent(pedidoId, user) {
  return bogNormalizedWrite_(function () {
    return bogMarkNormalizedTicketSent_(pedidoId, user);
  }, 'Ticket normalizado marcado como enviado.');
}

function bogNormalizedRead_(operation, successMessage) {
  try {
    return operation();
  } catch (err) {
    return bogErrorEnvelope_(err);
  }
}

function bogNormalizedWrite_(operation, successMessage) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    return operation();
  } catch (err) {
    return bogErrorEnvelope_(err);
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function bogEnsureNormalizedOperationalHeaders_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {
    ok: true,
    updatedSheets: [],
    addedHeaders: {},
    conflicts: [],
    timestamp: bogNowIso_()
  };
  var pendingPedidosUpdate = null;

  Object.keys(BOG_NORMALIZED_SHEETS).forEach(function (key) {
    var sheetName = BOG_NORMALIZED_SHEETS[key];
    var expectedHeaders = BOG_NORMALIZED_HEADERS[key];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      result.conflicts.push({ sheetName: sheetName, reason: 'Hoja normalizada requerida no encontrada.' });
      return;
    }

    if (sheetName === BOG_NORMALIZED_SHEETS.PEDIDOS) {
      pendingPedidosUpdate = bogAnalyzePedidosOperationalHeaders_(sheet, expectedHeaders, result);
    } else {
      bogVerifyExactHeaderContract_(sheet, expectedHeaders, result);
    }
  });

  result.ok = result.conflicts.length === 0;
  if (!result.ok) return result;

  if (pendingPedidosUpdate && pendingPedidosUpdate.missingTrailing.length) {
    pendingPedidosUpdate.sheet
      .getRange(1, pendingPedidosUpdate.startColumn, 1, pendingPedidosUpdate.missingTrailing.length)
      .setValues([pendingPedidosUpdate.missingTrailing]);
    result.updatedSheets.push(pendingPedidosUpdate.sheet.getName());
    result.addedHeaders[pendingPedidosUpdate.sheet.getName()] = pendingPedidosUpdate.missingTrailing;
  } else if (pendingPedidosUpdate) {
    result.addedHeaders[pendingPedidosUpdate.sheet.getName()] = [];
  }

  return result;
}

function bogAnalyzePedidosOperationalHeaders_(sheet, expectedHeaders, result) {
  var headerValues = bogGetHeaderRowValues_(sheet, expectedHeaders.length);
  var firstEmptyIndex = headerValues.length;
  while (firstEmptyIndex > 0 && bogTrim_(headerValues[firstEmptyIndex - 1]) === '') {
    firstEmptyIndex -= 1;
  }

  for (var i = 0; i < firstEmptyIndex; i += 1) {
    if (i >= expectedHeaders.length) break;
    if (bogTrim_(headerValues[i]) !== expectedHeaders[i]) {
      result.conflicts.push({
        sheetName: sheet.getName(),
        reason: 'Header mismatch before trailing operational columns.',
        column: i + 1,
        expected: expectedHeaders[i],
        actual: bogTrim_(headerValues[i])
      });
      return null;
    }
  }

  if (firstEmptyIndex > expectedHeaders.length) {
    result.conflicts.push({
      sheetName: sheet.getName(),
      reason: 'PEDIDOS tiene columnas no vacías fuera del contrato esperado.',
      firstUnexpectedColumn: expectedHeaders.length + 1
    });
    return null;
  }

  var missingTrailing = [];
  for (var j = firstEmptyIndex; j < expectedHeaders.length; j += 1) {
    if (bogTrim_(headerValues[j]) !== '') {
      result.conflicts.push({
        sheetName: sheet.getName(),
        reason: 'No se puede sobrescribir una celda de header no vacía.',
        column: j + 1,
        expected: expectedHeaders[j],
        actual: bogTrim_(headerValues[j])
      });
      return null;
    }
    missingTrailing.push(expectedHeaders[j]);
  }

  return {
    sheet: sheet,
    startColumn: firstEmptyIndex + 1,
    missingTrailing: missingTrailing
  };
}

function bogVerifyExactHeaderContract_(sheet, expectedHeaders, result) {
  var headerValues = bogGetHeaderRowValues_(sheet, expectedHeaders.length);
  for (var i = 0; i < expectedHeaders.length; i += 1) {
    if (bogTrim_(headerValues[i]) !== expectedHeaders[i]) {
      result.conflicts.push({
        sheetName: sheet.getName(),
        reason: 'Header contract mismatch.',
        column: i + 1,
        expected: expectedHeaders[i],
        actual: bogTrim_(headerValues[i])
      });
      return;
    }
  }
}

function bogGetHeaderRowValues_(sheet, minWidth) {
  var width = Math.max(sheet.getLastColumn(), minWidth || 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0];
}

function bogFindMissingHeaders_(headerMap, expectedHeaders) {
  return expectedHeaders.filter(function (header) {
    return headerMap[bogNormalizeHeaderKey_(header)] === undefined;
  });
}

function bogUpdateNormalizedOrderStatus_(pedidoId, nextStatus, user) {
  bogAssertAllowedValue_(nextStatus, BOG_NORMALIZED_ORDER_STATUSES, 'estado');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  var found = bogFindNormalizedRowById_(sheets.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pedidoId);
  if (!found) throw new Error('Pedido normalizado no encontrado: ' + pedidoId);

  var now = new Date();
  var previousStatus = bogTrim_(found.rowData.estado);
  if (previousStatus === nextStatus) {
    return {
      ok: true,
      unchanged: true,
      pedido_id: bogTrim_(pedidoId),
      estado_anterior: previousStatus,
      estado_nuevo: nextStatus,
      message: 'Estado sin cambios'
    };
  }
  bogPatchRowByHeaders_(sheets.pedidos.sheet, found.rowNumber, found.headerMap, {
    estado: nextStatus,
    fecha_actualizacion: now
  });
  bogAppendNormalizedEvent_(sheets.eventos, bogTrim_(pedidoId), 'ESTADO_PEDIDO_CAMBIADO', previousStatus, nextStatus, 'Estado actualizado desde Chekeo 2.0', user, now);

  return { ok: true, pedido_id: bogTrim_(pedidoId), estado_anterior: previousStatus, estado_nuevo: nextStatus };
}

function bogUpdateNormalizedPaymentStatus_(pedidoId, estadoPago, metodoPago, user) {
  bogAssertAllowedValue_(estadoPago, BOG_NORMALIZED_PAYMENT_STATUSES, 'estado_pago');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  bogRequireHeader_(sheets.pedidos.headerMap, 'estado_pago', BOG_NORMALIZED_SHEETS.PEDIDOS);
  var found = bogFindNormalizedRowById_(sheets.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pedidoId);
  if (!found) throw new Error('Pedido normalizado no encontrado: ' + pedidoId);

  var now = new Date();
  var previousPaymentStatus = bogTrim_(found.rowData.estado_pago) || 'Pendiente';
  var currentMetodoPago = bogTrim_(found.rowData.metodo_pago);
  var nextMetodoPago = bogTrim_(metodoPago) || currentMetodoPago;
  var paymentUnchanged = previousPaymentStatus === estadoPago;
  var methodUnchanged = nextMetodoPago === currentMetodoPago;
  if (paymentUnchanged && methodUnchanged) {
    return {
      ok: true,
      unchanged: true,
      pedido_id: bogTrim_(pedidoId),
      estado_pago: estadoPago,
      metodo_pago: nextMetodoPago,
      message: 'Pago sin cambios'
    };
  }
  var patch = {
    estado_pago: estadoPago,
    fecha_actualizacion: now
  };
  if (bogTrim_(metodoPago)) patch.metodo_pago = nextMetodoPago;

  bogPatchRowByHeaders_(sheets.pedidos.sheet, found.rowNumber, found.headerMap, patch);
  var detail = 'Pago actualizado desde Chekeo 2.0';
  if (bogTrim_(metodoPago) && nextMetodoPago !== currentMetodoPago) {
    detail += '; metodo_pago=' + nextMetodoPago;
  }
  bogAppendNormalizedEvent_(sheets.eventos, bogTrim_(pedidoId), 'PAGO_ACTUALIZADO', previousPaymentStatus, estadoPago, detail, user, now);

  return { ok: true, pedido_id: bogTrim_(pedidoId), estado_pago: estadoPago, metodo_pago: nextMetodoPago };
}

function bogMarkNormalizedGuarnicionDone_(guarnicionIdOrPedidoId, user) {
  var target = bogTrim_(guarnicionIdOrPedidoId);
  if (!target) throw new Error('guarnicionIdOrPedidoId es requerido.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  var data = bogReadSheetAsObjects_(sheets.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES);
  var affectedRows = data.rows.filter(function (row) {
    return bogTrim_(row.data.guarnicion_id) === target;
  });
  if (!affectedRows.length) {
    affectedRows = data.rows.filter(function (row) {
      return bogTrim_(row.data.pedido_id) === target;
    });
  }
  if (!affectedRows.length) {
    return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: [], message: 'Sin guarniciones' };
  }

  var now = new Date();
  var actor = bogTrim_(user) || 'chekeo-2';
  var byPedido = {};
  affectedRows.forEach(function (row) {
    var pedidoId = bogTrim_(row.data.pedido_id);
    if (!byPedido[pedidoId]) byPedido[pedidoId] = [];
  });
  var updatableRows = affectedRows.filter(function (row) {
    return bogTrim_(row.data.estado_guarnicion) !== 'Hecha';
  });
  if (!updatableRows.length) {
    return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: Object.keys(byPedido), message: 'Guarniciones ya estaban hechas' };
  }

  updatableRows.forEach(function (row) {
    var pedidoId = bogTrim_(row.data.pedido_id);
    if (!byPedido[pedidoId]) byPedido[pedidoId] = [];
    byPedido[pedidoId].push({
      guarnicion_id: bogTrim_(row.data.guarnicion_id),
      previous: bogTrim_(row.data.estado_guarnicion)
    });
    bogPatchRowByHeaders_(sheets.guarniciones.sheet, row.rowNumber, data.headerMap, {
      estado_guarnicion: 'Hecha',
      responsable: actor,
      actualizado_en: now
    });
  });

  var pedidoIds = Object.keys(byPedido);
  pedidoIds.forEach(function (pedidoId) {
    var entries = byPedido[pedidoId];
    var previousSummary = entries.map(function (entry) {
      return entry.guarnicion_id + ':' + (entry.previous || '');
    }).join(', ');
    var detail = 'guarniciones=' + entries.map(function (entry) { return entry.guarnicion_id; }).join(',') + '; count=' + entries.length;
    bogAppendNormalizedEvent_(sheets.eventos, pedidoId, 'GUARNICION_HECHA', previousSummary, 'Hecha', detail, user, now);
  });

  return { ok: true, affectedCount: updatableRows.length, pedidoIds: pedidoIds };
}

function bogUpdateNormalizedOrderNotes_(pedidoId, notaInterna, notaCliente, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  bogRequireHeader_(sheets.pedidos.headerMap, 'nota_interna', BOG_NORMALIZED_SHEETS.PEDIDOS);
  bogRequireHeader_(sheets.pedidos.headerMap, 'nota_cliente', BOG_NORMALIZED_SHEETS.PEDIDOS);
  var found = bogFindNormalizedRowById_(sheets.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pedidoId);
  if (!found) throw new Error('Pedido normalizado no encontrado: ' + pedidoId);

  var nextNotaInterna = bogTrim_(notaInterna);
  var nextNotaCliente = bogTrim_(notaCliente);
  var prevNotaInterna = bogTrim_(found.rowData.nota_interna);
  var prevNotaCliente = bogTrim_(found.rowData.nota_cliente);
  if (nextNotaInterna === prevNotaInterna && nextNotaCliente === prevNotaCliente) {
    return { ok: true, unchanged: true, pedido_id: bogTrim_(pedidoId), message: 'Notas sin cambios' };
  }
  var now = new Date();
  bogPatchRowByHeaders_(sheets.pedidos.sheet, found.rowNumber, found.headerMap, {
    nota_interna: nextNotaInterna,
    nota_cliente: nextNotaCliente,
    fecha_actualizacion: now
  });
  bogAppendNormalizedEvent_(sheets.eventos, bogTrim_(pedidoId), 'NOTAS_ACTUALIZADAS', '', '', 'Notas actualizadas desde Chekeo 2.0', user, now);

  return { ok: true, pedido_id: bogTrim_(pedidoId) };
}

function bogMarkNormalizedTicketSent_(pedidoId, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  bogRequireHeader_(sheets.pedidos.headerMap, 'ticket_enviado', BOG_NORMALIZED_SHEETS.PEDIDOS);
  bogRequireHeader_(sheets.pedidos.headerMap, 'ticket_enviado_en', BOG_NORMALIZED_SHEETS.PEDIDOS);
  var found = bogFindNormalizedRowById_(sheets.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pedidoId);
  if (!found) throw new Error('Pedido normalizado no encontrado: ' + pedidoId);

  var alreadySent = String(found.rowData.ticket_enviado).toLowerCase() === 'true';
  if (alreadySent) {
    return {
      ok: true,
      unchanged: true,
      pedido_id: bogTrim_(pedidoId),
      ticket_enviado: true,
      message: 'Ticket ya marcado como enviado'
    };
  }
  var now = new Date();
  bogPatchRowByHeaders_(sheets.pedidos.sheet, found.rowNumber, found.headerMap, {
    ticket_enviado: true,
    ticket_enviado_en: now,
    fecha_actualizacion: now
  });
  bogAppendNormalizedEvent_(sheets.eventos, bogTrim_(pedidoId), 'TICKET_ENVIADO', '', 'true', 'Ticket marcado como enviado desde Chekeo 2.0', user, now);

  return { ok: true, pedido_id: bogTrim_(pedidoId), ticket_enviado: true };
}

function bogFindNormalizedRowById_(sheet, requiredHeaders, idHeader, idValue) {
  var data = bogReadSheetAsObjects_(sheet, requiredHeaders);
  var target = bogTrim_(idValue);
  if (!target) throw new Error(idHeader + ' es requerido.');

  for (var i = 0; i < data.rows.length; i += 1) {
    if (bogTrim_(data.rows[i].data[idHeader]) === target) {
      return {
        rowNumber: data.rows[i].rowNumber,
        headerMap: data.headerMap,
        headers: data.headers,
        rowData: data.rows[i].data
      };
    }
  }
  return null;
}

function bogAppendNormalizedEvent_(eventosSheetMeta, pedidoId, tipoEvento, estadoAnterior, estadoNuevo, detalle, user, timestamp) {
  var now = timestamp || new Date();
  bogAppendRecordByHeaders_(eventosSheetMeta.sheet, eventosSheetMeta.headers, eventosSheetMeta.headerMap, {
    evento_id: bogBuildNormalizedEventId_(pedidoId, now),
    pedido_id: pedidoId,
    tipo_evento: tipoEvento,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    detalle: detalle,
    usuario: bogTrim_(user) || 'chekeo-2',
    timestamp: now,
    origen_app: 'chekeo-2'
  });
}

function bogBuildNormalizedEventId_(pedidoId, now) {
  var timezone = Session.getScriptTimeZone() || 'Etc/UTC';
  var stamp = Utilities.formatDate(now || new Date(), timezone, 'yyyyMMddHHmmssSSS');
  var suffix = Math.floor(Math.random() * 10000);
  return bogTrim_(pedidoId) + '-EVT-' + stamp + '-' + ('000' + suffix).slice(-4);
}

function bogAssertAllowedValue_(value, allowed, fieldName) {
  var text = bogTrim_(value);
  if (allowed.indexOf(text) === -1) {
    throw new Error(fieldName + ' inválido: ' + text + '. Permitidos: ' + allowed.join(', '));
  }
}

function bogRequireHeader_(headerMap, header, sheetName) {
  if (headerMap[bogNormalizeHeaderKey_(header)] === undefined) {
    throw new Error('Falta columna obligatoria en ' + sheetName + ': ' + header);
  }
}
