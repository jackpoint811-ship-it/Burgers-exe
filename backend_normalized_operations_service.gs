var BOG_NORMALIZED_ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Listo', 'Cancelado', 'Completado'];
var BOG_NORMALIZED_PAYMENT_STATUSES = ['Pendiente', 'Pagado', 'Parcial', 'Cancelado'];
var BOG_NORMALIZED_OPERATIONAL_PEDIDOS_HEADERS = ['estado_pago', 'nota_interna', 'nota_cliente', 'ticket_enviado', 'ticket_enviado_en'];
var BOG_NORMALIZED_OPEN_ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Listo'];
var BOG_BURGER_STATUSES = ['Pendiente', 'Preparando', 'Lista'];
var BOG_GUARNICION_STATUSES = ['Pendiente', 'Preparando', 'Hecha'];

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
    return bogUpdateNormalizedGuarnicionStatus_(guarnicionIdOrPedidoId, 'Hecha', user);
  }, 'Guarnición normalizada marcada como hecha.');
}
function ensureNormalizedKitchenHeaders() { return bogNormalizedWrite_(function () { return bogEnsureNormalizedKitchenHeaders_(); }, 'Headers cocina verificados.'); }
function testEnsureNormalizedKitchenHeaders() { var result = ensureNormalizedKitchenHeaders(); console.log(JSON.stringify(result, null, 2)); }
function previewNormalizedKitchenReadiness() { return bogNormalizedRead_(function () { return bogPreviewNormalizedKitchenReadiness_(); }, 'Diagnóstico cocina listo.'); }
function testPreviewNormalizedKitchenReadiness() { var result = previewNormalizedKitchenReadiness(); console.log(JSON.stringify(result, null, 2)); }
function updateNormalizedBurgerStatus(target, nextStatus, user) { return bogNormalizedWrite_(function () { return bogUpdateNormalizedBurgerStatus_(target, nextStatus, user); }, 'Estado burgers actualizado.'); }
function markNormalizedBurgersReady(pedidoId, user) { return updateNormalizedBurgerStatus(pedidoId, 'Lista', user); }
function updateNormalizedGuarnicionStatus(target, nextStatus, user) { return bogNormalizedWrite_(function () { return bogUpdateNormalizedGuarnicionStatus_(target, nextStatus, user); }, 'Estado guarniciones actualizado.'); }
function completeNormalizedOrderIfReady(pedidoId, user) { return bogNormalizedWrite_(function () { return bogCompleteNormalizedOrderIfReady_(pedidoId, user); }, 'Orden completada operativamente.'); }

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
function bogUpdateNormalizedBurgerStatus_(target, nextStatus, user) { bogAssertAllowedValue_(nextStatus, BOG_BURGER_STATUSES, 'estado_burger'); var t = bogTrim_(target); if (!t) throw new Error('pedidoBurgerIdOrPedidoId es requerido.'); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var d = bogReadSheetAsObjects_(sh.burgers.sheet, ['pedido_burger_id','pedido_id','pedido_item_id','burger_base_id','extras_json','sin_ingredientes_json','comentarios']); var rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_burger_id) === t; }); if (!rows.length) rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === t; }); if (!rows.length) throw new Error('No se encontraron burgers para: ' + t); var u = rows.filter(function (r) { return (bogTrim_(r.data.estado_burger) || 'Pendiente') !== nextStatus; }); var p = {}; rows.forEach(function (r) { p[bogTrim_(r.data.pedido_id)] = true; }); var pids = Object.keys(p); if (!u.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: pids, message: 'Burgers sin cambios' }; var now = new Date(); var actor = bogTrim_(user) || 'chekeo-2'; var by = {}; u.forEach(function (r) { var pid = bogTrim_(r.data.pedido_id); if (!by[pid]) by[pid] = []; by[pid].push({ id: bogTrim_(r.data.pedido_burger_id), previous: bogTrim_(r.data.estado_burger) || 'Pendiente' }); bogPatchRowByHeaders_(sh.burgers.sheet, r.rowNumber, d.headerMap, { estado_burger: nextStatus, responsable: actor, actualizado_en: now }); }); Object.keys(by).forEach(function (pid) { var ent = by[pid]; bogAppendNormalizedEvent_(sh.eventos, pid, 'BURGER_ESTADO_ACTUALIZADO', ent.map(function (e) { return e.id + ':' + e.previous; }).join(', '), nextStatus, 'burgers=' + ent.map(function (e) { return e.id; }).join(',') + '; count=' + ent.length, user || 'chekeo-2-ui', now); }); return { ok: true, affectedCount: u.length, pedidoIds: Object.keys(by), estado_nuevo: nextStatus }; }
function bogUpdateNormalizedGuarnicionStatus_(target, nextStatus, user) { bogAssertAllowedValue_(nextStatus, BOG_GUARNICION_STATUSES, 'estado_guarnicion'); var t = bogTrim_(target); if (!t) throw new Error('guarnicionIdOrPedidoId es requerido.'); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var d = bogReadSheetAsObjects_(sh.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES); var rows = d.rows.filter(function (r) { return bogTrim_(r.data.guarnicion_id) === t; }); if (!rows.length) rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === t; }); if (!rows.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: [], message: 'Sin guarniciones' }; var by = {}; rows.forEach(function (r) { by[bogTrim_(r.data.pedido_id)] = true; }); var u = rows.filter(function (r) { return (bogTrim_(r.data.estado_guarnicion) || 'Pendiente') !== nextStatus; }); if (!u.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: Object.keys(by) }; var now = new Date(); var actor = bogTrim_(user) || 'chekeo-2'; var changeBy = {}; u.forEach(function (r) { var pid = bogTrim_(r.data.pedido_id); if (!changeBy[pid]) changeBy[pid] = []; changeBy[pid].push({ id: bogTrim_(r.data.guarnicion_id), previous: bogTrim_(r.data.estado_guarnicion) || 'Pendiente' }); bogPatchRowByHeaders_(sh.guarniciones.sheet, r.rowNumber, d.headerMap, { estado_guarnicion: nextStatus, responsable: actor, actualizado_en: now }); }); Object.keys(changeBy).forEach(function (pid) { var ent = changeBy[pid]; bogAppendNormalizedEvent_(sh.eventos, pid, 'GUARNICION_ESTADO_ACTUALIZADO', ent.map(function (e) { return e.id + ':' + e.previous; }).join(', '), nextStatus, 'guarniciones=' + ent.map(function (e) { return e.id; }).join(',') + '; count=' + ent.length, user || 'chekeo-2-ui', now); }); return { ok: true, affectedCount: u.length, pedidoIds: Object.keys(changeBy), estado_nuevo: nextStatus }; }
function bogCompleteNormalizedOrderIfReady_(pedidoId, user) { var pid = bogTrim_(pedidoId); if (!pid) throw new Error('pedidoId es requerido.'); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid); if (!p) throw new Error('Pedido normalizado no encontrado: ' + pid); var burgers = bogReadSheetAsObjects_(sh.burgers.sheet, ['pedido_burger_id','pedido_id','pedido_item_id','burger_base_id','extras_json','sin_ingredientes_json','comentarios']).rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === pid; }).map(function (r) { return r.data; }); var guas = bogReadSheetAsObjects_(sh.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === pid; }).map(function (r) { return r.data; }); var blockers = []; var burgersReady = burgers.length > 0 && burgers.every(function (b) { return (bogTrim_(b.estado_burger) || 'Pendiente') === 'Lista'; }); var guaReady = guas.length === 0 || guas.every(function (g) { return (bogTrim_(g.estado_guarnicion) || 'Pendiente') === 'Hecha'; }); var payReady = (bogTrim_(p.rowData.estado_pago) || 'Pendiente') === 'Pagado'; if (!burgersReady) blockers.push('Burgers pendientes'); if (!guaReady) blockers.push('Guarniciones pendientes'); if (!payReady) blockers.push('Pago pendiente'); if (blockers.length) return { ok: true, blocked: true, pedido_id: pid, blockers: blockers, message: 'Orden no lista para completar' }; if (bogTrim_(p.rowData.estado) === 'Listo') return { ok: true, unchanged: true, pedido_id: pid }; var now = new Date(); bogPatchRowByHeaders_(sh.pedidos.sheet, p.rowNumber, p.headerMap, { estado: 'Listo', fecha_actualizacion: now }); bogAppendNormalizedEvent_(sh.eventos, pid, 'ORDEN_COMPLETADA_OPERATIVAMENTE', bogTrim_(p.rowData.estado), 'Listo', 'Completar orden explícito', user || 'chekeo-2-ui', now); return { ok: true, pedido_id: pid, estado_nuevo: 'Listo' }; }
function bogEnsureNormalizedKitchenHeaders_() { var r = bogEnsureNormalizedOperationalHeaders_(); if (!r.ok) return r; var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = ss.getSheetByName(BOG_NORMALIZED_SHEETS.PEDIDO_BURGERS); var exp = BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS; var hv = bogGetHeaderRowValues_(sh, exp.length); var fe = hv.length; while (fe > 0 && bogTrim_(hv[fe - 1]) === '') fe -= 1; for (var i = 0; i < Math.min(fe, exp.length); i += 1) { if (bogTrim_(hv[i]) !== exp[i]) { r.conflicts.push({ sheetName: sh.getName(), reason: 'Header mismatch', column: i + 1, expected: exp[i], actual: bogTrim_(hv[i]) }); return r; } } var miss = []; for (var j = fe; j < exp.length; j += 1) miss.push(exp[j]); if (miss.length) { sh.getRange(1, fe + 1, 1, miss.length).setValues([miss]); r.updatedSheets.push(sh.getName()); r.addedHeaders[sh.getName()] = miss; } else if (!r.addedHeaders[sh.getName()]) r.addedHeaders[sh.getName()] = []; r.ok = r.conflicts.length === 0; return r; }
function bogPreviewNormalizedKitchenReadiness_() { var ss = SpreadsheetApp.getActiveSpreadsheet(); var s = bogGetNormalizedSheetsWithHeaders_(ss); var b = bogReadSheetAsObjects_(s.burgers.sheet, ['pedido_burger_id','pedido_id','pedido_item_id','burger_base_id','extras_json','sin_ingredientes_json','comentarios']).rows.map(function (r) { return r.data; }); var g = bogReadSheetAsObjects_(s.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows.map(function (r) { return r.data; }); var hm = bogGetHeaderMap_(bogGetHeaderRowValues_(s.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS.length)); var miss = bogFindMissingHeaders_(hm, ['estado_burger','responsable','actualizado_en']); var bk = { total: b.length, pending: 0, preparing: 0, ready: 0 }; b.forEach(function (x) { var st = bogTrim_(x.estado_burger) || 'Pendiente'; if (st === 'Preparando') bk.preparing += 1; else if (st === 'Lista') bk.ready += 1; else bk.pending += 1; }); var gk = { total: g.length, pending: 0, preparing: 0, done: 0 }; g.forEach(function (x) { var st = bogTrim_(x.estado_guarnicion) || 'Pendiente'; if (st === 'Preparando') gk.preparing += 1; else if (st === 'Hecha') gk.done += 1; else gk.pending += 1; }); return { ok: miss.length === 0, missingHeadersBySheet: miss.length ? { PEDIDO_BURGERS: miss } : {}, burgerCounts: bk, guarnicionCounts: gk, timestamp: bogNowIso_() }; }

// Phase 6 compatibility overrides
function bogGetOperationalExpectedHeaders_(key) {
  if (key === 'PEDIDO_BURGERS') return BOG_PEDIDO_BURGERS_BASE_HEADERS;
  return BOG_NORMALIZED_HEADERS[key];
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
      var expectedHeaders = bogGetOperationalExpectedHeaders_(key);
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) { missingHeadersBySheet[sheetName] = expectedHeaders.slice(); return; }
      var headerValues = bogGetHeaderRowValues_(sheet, expectedHeaders.length);
      var headerMap = bogGetHeaderMap_(headerValues);
      var missing = bogFindMissingHeaders_(headerMap, expectedHeaders);
      if (missing.length) missingHeadersBySheet[sheetName] = missing;
      if (sheetName === BOG_NORMALIZED_SHEETS.PEDIDOS && missing.length === 0) {
        var pedidosData = bogReadSheetAsObjects_(sheet, expectedHeaders).rows.map(function (row) { return row.data; });
        pedidosCount = pedidosData.length;
        openOrdersCount = pedidosData.filter(function (pedido) { return BOG_NORMALIZED_OPEN_ORDER_STATUSES.indexOf(bogTrim_(pedido.estado)) !== -1; }).length;
      }
      if (sheetName === BOG_NORMALIZED_SHEETS.GUARNICIONES && missing.length === 0) {
        var guarnicionesData = bogReadSheetAsObjects_(sheet, expectedHeaders).rows.map(function (row) { return row.data; });
        pendingGuarnicionesCount = guarnicionesData.filter(function (g) { return bogNormalizeHeaderKey_(g.estado_guarnicion) !== bogNormalizeHeaderKey_('Hecha'); }).length;
      }
    });
    return { ok: Object.keys(missingHeadersBySheet).length === 0, missingHeadersBySheet: missingHeadersBySheet, pedidosCount: pedidosCount, openOrdersCount: openOrdersCount, pendingGuarnicionesCount: pendingGuarnicionesCount, timestamp: bogNowIso_() };
  }, 'Diagnóstico de operaciones normalizadas obtenido.');
}

function bogEnsureNormalizedOperationalHeaders_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = { ok: true, updatedSheets: [], addedHeaders: {}, conflicts: [], timestamp: bogNowIso_() };
  var pendingPedidosUpdate = null;
  Object.keys(BOG_NORMALIZED_SHEETS).forEach(function (key) {
    var sheetName = BOG_NORMALIZED_SHEETS[key];
    var expectedHeaders = bogGetOperationalExpectedHeaders_(key);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) { result.conflicts.push({ sheetName: sheetName, reason: 'Hoja normalizada requerida no encontrada.' }); return; }
    if (sheetName === BOG_NORMALIZED_SHEETS.PEDIDOS) pendingPedidosUpdate = bogAnalyzePedidosOperationalHeaders_(sheet, expectedHeaders, result);
    else bogVerifyExactHeaderContract_(sheet, expectedHeaders, result);
  });
  result.ok = result.conflicts.length === 0;
  if (!result.ok) return result;
  if (pendingPedidosUpdate && pendingPedidosUpdate.missingTrailing.length) {
    pendingPedidosUpdate.sheet.getRange(1, pendingPedidosUpdate.startColumn, 1, pendingPedidosUpdate.missingTrailing.length).setValues([pendingPedidosUpdate.missingTrailing]);
    result.updatedSheets.push(pendingPedidosUpdate.sheet.getName());
    result.addedHeaders[pendingPedidosUpdate.sheet.getName()] = pendingPedidosUpdate.missingTrailing;
  } else if (pendingPedidosUpdate) {
    result.addedHeaders[pendingPedidosUpdate.sheet.getName()] = [];
  }
  return result;
}

function bogAssertBurgerKitchenHeadersReady_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = bogGetRequiredSheet_(ss, BOG_NORMALIZED_SHEETS.PEDIDO_BURGERS);
  var headerMap = bogGetHeaderMap_(bogGetHeaderRowValues_(sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS.length));
  var missing = bogFindMissingHeaders_(headerMap, ['estado_burger', 'responsable', 'actualizado_en']);
  if (missing.length) throw new Error('Ejecuta ensureNormalizedKitchenHeaders() antes de usar cocina.');
}

function bogUpdateNormalizedBurgerStatus_(target, nextStatus, user) {
  bogAssertBurgerKitchenHeadersReady_();
  bogAssertAllowedValue_(nextStatus, BOG_BURGER_STATUSES, 'estado_burger');
  var t = bogTrim_(target);
  if (!t) throw new Error('pedidoBurgerIdOrPedidoId es requerido.');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = bogGetNormalizedSheetsWithHeaders_(ss);
  var d = bogReadSheetAsObjects_(sh.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS);
  var rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_burger_id) === t; });
  if (!rows.length) rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === t; });
  if (!rows.length) throw new Error('No se encontraron burgers para: ' + t);
  var u = rows.filter(function (r) { return (bogTrim_(r.data.estado_burger) || 'Pendiente') !== nextStatus; });
  var pedidoIdsMap = {}; rows.forEach(function (r) { pedidoIdsMap[bogTrim_(r.data.pedido_id)] = true; });
  var pedidoIds = Object.keys(pedidoIdsMap);
  if (!u.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: pedidoIds, message: 'Burgers sin cambios' };
  var now = new Date();
  var actor = bogTrim_(user) || 'chekeo-2';
  var by = {};
  u.forEach(function (r) {
    var pid = bogTrim_(r.data.pedido_id);
    if (!by[pid]) by[pid] = [];
    by[pid].push({ id: bogTrim_(r.data.pedido_burger_id), previous: bogTrim_(r.data.estado_burger) || 'Pendiente' });
    bogPatchRowByHeaders_(sh.burgers.sheet, r.rowNumber, d.headerMap, { estado_burger: nextStatus, responsable: actor, actualizado_en: now });
  });
  Object.keys(by).forEach(function (pid) {
    var ent = by[pid];
    bogAppendNormalizedEvent_(sh.eventos, pid, 'BURGER_ESTADO_ACTUALIZADO', ent.map(function (e) { return e.id + ':' + e.previous; }).join(', '), nextStatus, 'burgers=' + ent.map(function (e) { return e.id; }).join(',') + '; count=' + ent.length, user || 'chekeo-2-ui', now);
  });
  return { ok: true, affectedCount: u.length, pedidoIds: Object.keys(by), estado_nuevo: nextStatus };
}

function bogCompleteNormalizedOrderIfReady_(pedidoId, user) {
  bogAssertBurgerKitchenHeadersReady_();
  var pid = bogTrim_(pedidoId);
  if (!pid) throw new Error('pedidoId es requerido.');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = bogGetNormalizedSheetsWithHeaders_(ss);
  var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid);
  if (!p) throw new Error('Pedido normalizado no encontrado: ' + pid);
  var burgers = bogReadSheetAsObjects_(sh.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS).rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === pid; }).map(function (r) { return r.data; });
  var guas = bogReadSheetAsObjects_(sh.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === pid; }).map(function (r) { return r.data; });
  var blockers = [];
  var burgersReady = burgers.length > 0 && burgers.every(function (b) { return (bogTrim_(b.estado_burger) || 'Pendiente') === 'Lista'; });
  var guaReady = guas.length === 0 || guas.every(function (g) { return (bogTrim_(g.estado_guarnicion) || 'Pendiente') === 'Hecha'; });
  var payReady = (bogTrim_(p.rowData.estado_pago) || 'Pendiente') === 'Pagado';
  if (!burgersReady) blockers.push('Burgers pendientes');
  if (!guaReady) blockers.push('Guarniciones pendientes');
  if (!payReady) blockers.push('Pago pendiente');
  if (blockers.length) return { ok: true, blocked: true, pedido_id: pid, blockers: blockers, message: 'Orden no lista para completar' };
  if (bogTrim_(p.rowData.estado) === 'Listo') return { ok: true, unchanged: true, pedido_id: pid };
  var now = new Date();
  bogPatchRowByHeaders_(sh.pedidos.sheet, p.rowNumber, p.headerMap, { estado: 'Listo', fecha_actualizacion: now });
  bogAppendNormalizedEvent_(sh.eventos, pid, 'ORDEN_COMPLETADA_OPERATIVAMENTE', bogTrim_(p.rowData.estado), 'Listo', 'Completar orden explícito', user || 'chekeo-2-ui', now);
  return { ok: true, pedido_id: pid, estado_nuevo: 'Listo' };
}

var BOG_PRODUCTION_STATUSES = ['Pendiente', 'Preparando', 'Preparada'];
var BOG_DELIVERY_STATUSES = ['Pendiente', 'Entregada'];

function updateNormalizedProductionStatus(pedidoId, nextStatus, user) { return bogNormalizedWrite_(function () { return bogUpdateNormalizedProductionStatus_(pedidoId, nextStatus, user, 'PRODUCCION_ESTADO_ACTUALIZADO'); }, 'Producción normalizada actualizada.'); }
function updateNormalizedDeliveryStatus(pedidoId, nextStatus, user) { return bogNormalizedWrite_(function () { return bogUpdateNormalizedDeliveryStatus_(pedidoId, nextStatus, user); }, 'Entrega normalizada actualizada.'); }
function markNormalizedOrderDelivered(pedidoId, user) { return updateNormalizedDeliveryStatus(pedidoId, 'Entregada', user); }
function getNormalizedOrderFinalizationState(pedidoId) { return bogNormalizedRead_(function () { return bogGetNormalizedOrderFinalizationState_(pedidoId); }, 'Estado de finalización obtenido.'); }

function bogUpdateNormalizedProductionStatus_(pedidoId, nextStatus, user, eventType) { bogAssertAllowedValue_(nextStatus, BOG_PRODUCTION_STATUSES, 'estado_produccion'); var pid = bogTrim_(pedidoId); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid); if (!p) throw new Error('Pedido normalizado no encontrado: ' + pid); var prev = bogTrim_(p.rowData.estado_produccion) || (bogTrim_(p.rowData.estado) === 'Listo' ? 'Preparada' : 'Pendiente'); if (prev === nextStatus) return { ok: true, unchanged: true, pedido_id: pid, estado_produccion: nextStatus }; var patch = { estado_produccion: nextStatus, fecha_actualizacion: new Date() }; if (nextStatus === 'Preparada') patch.estado = 'Preparada'; else if (nextStatus === 'Preparando') patch.estado = 'Preparando'; else if (['', 'Nuevo', 'Confirmado', 'Preparando', 'Listo', 'Preparada'].indexOf(bogTrim_(p.rowData.estado)) !== -1) patch.estado = 'Nuevo'; bogPatchRowByHeaders_(sh.pedidos.sheet, p.rowNumber, p.headerMap, patch); bogAppendNormalizedEvent_(sh.eventos, pid, eventType || 'PRODUCCION_ESTADO_ACTUALIZADO', prev, nextStatus, 'estado_produccion actualizado', user || 'chekeo-2-ui', patch.fecha_actualizacion); return { ok: true, pedido_id: pid, estado_produccion: nextStatus }; }
function bogUpdateNormalizedDeliveryStatus_(pedidoId, nextStatus, user) { bogAssertAllowedValue_(nextStatus, BOG_DELIVERY_STATUSES, 'estado_entrega'); var pid = bogTrim_(pedidoId); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid); if (!p) throw new Error('Pedido normalizado no encontrado: ' + pid); var prev = bogTrim_(p.rowData.estado_entrega) || 'Pendiente'; if (prev === nextStatus) return { ok: true, unchanged: true, pedido_id: pid, estado_entrega: nextStatus }; var now = new Date(); bogPatchRowByHeaders_(sh.pedidos.sheet, p.rowNumber, p.headerMap, { estado_entrega: nextStatus, fecha_actualizacion: now }); bogAppendNormalizedEvent_(sh.eventos, pid, 'ENTREGA_ESTADO_ACTUALIZADO', prev, nextStatus, 'estado_entrega actualizado', user || 'chekeo-2-ui', now); return { ok: true, pedido_id: pid, estado_entrega: nextStatus }; }
function bogComputeProductionReadiness_(sh, pid) { var burgers = bogReadSheetAsObjects_(sh.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS).rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === pid; }).map(function (r) { return r.data; }); var guas = bogReadSheetAsObjects_(sh.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === pid; }).map(function (r) { return r.data; }); var burgersReady = burgers.length > 0 && burgers.every(function (b) { return (bogTrim_(b.estado_burger) || 'Pendiente') === 'Lista'; }); var guaReady = guas.length === 0 || guas.every(function (g) { return (bogTrim_(g.estado_guarnicion) || 'Pendiente') === 'Hecha'; }); var preparing = burgers.some(function (b) { return bogTrim_(b.estado_burger) === 'Preparando'; }) || guas.some(function (g) { return bogTrim_(g.estado_guarnicion) === 'Preparando'; }); return { burgersReady: burgersReady, guaReady: guaReady, productionReady: burgersReady && guaReady, preparing: preparing }; }
function bogCompleteNormalizedOrderIfReady_(pedidoId, user) { var pid = bogTrim_(pedidoId); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid); if (!p) throw new Error('Pedido normalizado no encontrado: ' + pid); var estadoProd = bogTrim_(p.rowData.estado_produccion) || (bogTrim_(p.rowData.estado) === 'Listo' ? 'Preparada' : 'Pendiente'); if (estadoProd === 'Preparada') return { ok: true, unchanged: true, pedido_id: pid }; var r = bogComputeProductionReadiness_(sh, pid); var blockers = []; if (!r.burgersReady) blockers.push('Burgers pendientes'); if (!r.guaReady) blockers.push('Guarniciones pendientes'); if (blockers.length) return { ok: true, blocked: true, pedido_id: pid, blockers: blockers }; return bogUpdateNormalizedProductionStatus_(pid, 'Preparada', user, 'PRODUCCION_PREPARADA'); }
function bogApplyProductionAutoStatus_(pedidoId, sh, user) { var pid = bogTrim_(pedidoId); if (!pid) return; var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid); if (!p) return; var r = bogComputeProductionReadiness_(sh, pid); var estadoProd = bogTrim_(p.rowData.estado_produccion) || (bogTrim_(p.rowData.estado) === 'Listo' ? 'Preparada' : 'Pendiente'); if (r.productionReady && estadoProd !== 'Preparada') bogUpdateNormalizedProductionStatus_(pid, 'Preparada', user, 'PRODUCCION_PREPARADA_AUTO'); else if (!r.productionReady && r.preparing && estadoProd !== 'Preparada' && estadoProd !== 'Preparando') bogUpdateNormalizedProductionStatus_(pid, 'Preparando', user, 'PRODUCCION_ESTADO_ACTUALIZADO'); }
function bogUpdateNormalizedGuarnicionStatus_(target, nextStatus, user) { bogAssertAllowedValue_(nextStatus, BOG_GUARNICION_STATUSES, 'estado_guarnicion'); var t = bogTrim_(target); if (!t) throw new Error('guarnicionIdOrPedidoId es requerido.'); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var d = bogReadSheetAsObjects_(sh.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES); var rows = d.rows.filter(function (r) { return bogTrim_(r.data.guarnicion_id) === t; }); if (!rows.length) rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === t; }); if (!rows.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: [], message: 'Sin guarniciones' }; var by = {}; rows.forEach(function (r) { by[bogTrim_(r.data.pedido_id)] = true; }); var u = rows.filter(function (r) { return (bogTrim_(r.data.estado_guarnicion) || 'Pendiente') !== nextStatus; }); if (!u.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: Object.keys(by) }; var now = new Date(); var actor = bogTrim_(user) || 'chekeo-2'; var changeBy = {}; u.forEach(function (r) { var pid = bogTrim_(r.data.pedido_id); if (!changeBy[pid]) changeBy[pid] = []; changeBy[pid].push({ id: bogTrim_(r.data.guarnicion_id), previous: bogTrim_(r.data.estado_guarnicion) || 'Pendiente' }); bogPatchRowByHeaders_(sh.guarniciones.sheet, r.rowNumber, d.headerMap, { estado_guarnicion: nextStatus, responsable: actor, actualizado_en: now }); }); Object.keys(changeBy).forEach(function (pid) { var ent = changeBy[pid]; bogAppendNormalizedEvent_(sh.eventos, pid, 'GUARNICION_ESTADO_ACTUALIZADO', ent.map(function (e) { return e.id + ':' + e.previous; }).join(', '), nextStatus, 'guarniciones=' + ent.map(function (e) { return e.id; }).join(',') + '; count=' + ent.length, user || 'chekeo-2-ui', now); bogApplyProductionAutoStatus_(pid, sh, user); }); return { ok: true, affectedCount: u.length, pedidoIds: Object.keys(changeBy), estado_nuevo: nextStatus }; }
function bogUpdateNormalizedBurgerStatus_(target, nextStatus, user) { bogAssertBurgerKitchenHeadersReady_(); bogAssertAllowedValue_(nextStatus, BOG_BURGER_STATUSES, 'estado_burger'); var t = bogTrim_(target); if (!t) throw new Error('pedidoBurgerIdOrPedidoId es requerido.'); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var d = bogReadSheetAsObjects_(sh.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS); var rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_burger_id) === t; }); if (!rows.length) rows = d.rows.filter(function (r) { return bogTrim_(r.data.pedido_id) === t; }); if (!rows.length) throw new Error('No se encontraron burgers para: ' + t); var u = rows.filter(function (r) { return (bogTrim_(r.data.estado_burger) || 'Pendiente') !== nextStatus; }); var pedidoIdsMap = {}; rows.forEach(function (r) { pedidoIdsMap[bogTrim_(r.data.pedido_id)] = true; }); var pedidoIds = Object.keys(pedidoIdsMap); if (!u.length) return { ok: true, unchanged: true, affectedCount: 0, pedidoIds: pedidoIds, message: 'Burgers sin cambios' }; var now = new Date(); var actor = bogTrim_(user) || 'chekeo-2'; var by = {}; u.forEach(function (r) { var pid = bogTrim_(r.data.pedido_id); if (!by[pid]) by[pid] = []; by[pid].push({ id: bogTrim_(r.data.pedido_burger_id), previous: bogTrim_(r.data.estado_burger) || 'Pendiente' }); bogPatchRowByHeaders_(sh.burgers.sheet, r.rowNumber, d.headerMap, { estado_burger: nextStatus, responsable: actor, actualizado_en: now }); }); Object.keys(by).forEach(function (pid) { var ent = by[pid]; bogAppendNormalizedEvent_(sh.eventos, pid, 'BURGER_ESTADO_ACTUALIZADO', ent.map(function (e) { return e.id + ':' + e.previous; }).join(', '), nextStatus, 'burgers=' + ent.map(function (e) { return e.id; }).join(',') + '; count=' + ent.length, user || 'chekeo-2-ui', now); bogApplyProductionAutoStatus_(pid, sh, user); }); return { ok: true, affectedCount: u.length, pedidoIds: Object.keys(by), estado_nuevo: nextStatus }; }
function bogGetNormalizedOrderFinalizationState_(pedidoId) { var pid = bogTrim_(pedidoId); if (!pid) throw new Error('pedidoId es requerido.'); var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = bogGetNormalizedSheetsWithHeaders_(ss); var p = bogFindNormalizedRowById_(sh.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS, 'pedido_id', pid); if (!p) throw new Error('Pedido normalizado no encontrado: ' + pid); var r = bogComputeProductionReadiness_(sh, pid); var paymentReady = (bogTrim_(p.rowData.estado_pago) || 'Pendiente') === 'Pagado'; var deliveryReady = (bogTrim_(p.rowData.estado_entrega) || 'Pendiente') === 'Entregada'; var blockers = []; if (!r.productionReady) blockers.push('Producción pendiente'); if (!paymentReady) blockers.push('Pago pendiente'); if (!deliveryReady) blockers.push('Entrega pendiente'); return { ok: true, pedido_id: pid, production_ready: r.productionReady, payment_ready: paymentReady, delivery_ready: deliveryReady, finalized: r.productionReady && paymentReady && deliveryReady, blockers: blockers }; }
