function previewNormalizedProcessStateBackfill() {
  return bogNormalizedRead_(function () {
    return bogAnalyzeNormalizedProcessStateBackfill_();
  }, 'Preview backfill estados de proceso listo.');
}

function backfillNormalizedProcessStates() {
  return bogNormalizedWrite_(function () {
    var analysis = bogAnalyzeNormalizedProcessStateBackfill_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
    var now = new Date();
    var updatedPedidos = [];

    analysis.candidates.forEach(function (candidate) {
      var patch = {};
      if (candidate.shouldPatchProduccion) patch.estado_produccion = candidate.next_estado_produccion;
      if (candidate.shouldPatchEntrega) patch.estado_entrega = candidate.next_estado_entrega;
      if (!Object.keys(patch).length) return;
      patch.fecha_actualizacion = now;

      bogPatchRowByHeaders_(sheets.pedidos.sheet, candidate.rowNumber, candidate.headerMap, patch);

      var previousState = {
        estado_produccion: candidate.current_estado_produccion || '',
        estado_entrega: candidate.current_estado_entrega || ''
      };
      var nextState = {
        estado_produccion: patch.estado_produccion || candidate.current_estado_produccion || '',
        estado_entrega: patch.estado_entrega || candidate.current_estado_entrega || ''
      };
      bogAppendRecordByHeaders_(sheets.eventos.sheet, sheets.eventos.headers, sheets.eventos.headerMap, {
        evento_id: bogBuildNormalizedEventId_(candidate.pedido_id, now),
        pedido_id: candidate.pedido_id,
        tipo_evento: 'BACKFILL_ESTADOS_PROCESO',
        estado_anterior: JSON.stringify(previousState),
        estado_nuevo: JSON.stringify(nextState),
        detalle: 'Backfill post Phase 6: estado_produccion/estado_entrega',
        usuario: 'chekeo-2-backfill',
        timestamp: now,
        origen_app: 'chekeo-2-backfill'
      });

      updatedPedidos.push({
        pedido_id: candidate.pedido_id,
        folio: candidate.folio,
        estado_produccion: nextState.estado_produccion,
        estado_entrega: nextState.estado_entrega
      });
    });

    return {
      ok: true,
      updatedCount: updatedPedidos.length,
      skippedCount: analysis.totalPedidos - updatedPedidos.length,
      updatedPedidos: updatedPedidos,
      timestamp: bogNowIso_()
    };
  }, 'Backfill estados de proceso aplicado.');
}

function bogAnalyzeNormalizedProcessStateBackfill_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  bogAssertNormalizedBackfillHeaders_(sheets.pedidos.headerMap);

  var pedidosData = bogReadSheetAsObjects_(sheets.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS);
  var burgers = bogReadSheetAsObjects_(sheets.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS).rows;
  var guarniciones = bogReadSheetAsObjects_(sheets.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows;

  var burgersByPedido = {};
  burgers.forEach(function (row) {
    var pid = bogTrim_(row.data.pedido_id);
    if (!pid) return;
    if (!burgersByPedido[pid]) burgersByPedido[pid] = [];
    burgersByPedido[pid].push(row.data);
  });

  var guarnicionesByPedido = {};
  guarniciones.forEach(function (row) {
    var pid = bogTrim_(row.data.pedido_id);
    if (!pid) return;
    if (!guarnicionesByPedido[pid]) guarnicionesByPedido[pid] = [];
    guarnicionesByPedido[pid].push(row.data);
  });

  var changes = [];
  var candidates = [];
  pedidosData.rows.forEach(function (row) {
    var p = row.data;
    var change = bogBuildBackfillChange_(p, burgersByPedido[bogTrim_(p.pedido_id)] || [], guarnicionesByPedido[bogTrim_(p.pedido_id)] || []);
    if (!change.needsPatch) return;
    change.rowNumber = row.rowNumber;
    change.headerMap = pedidosData.headerMap;
    candidates.push(change);
    changes.push({
      pedido_id: change.pedido_id,
      folio: change.folio,
      current_estado: change.current_estado,
      current_estado_produccion: change.current_estado_produccion,
      next_estado_produccion: change.next_estado_produccion,
      current_estado_entrega: change.current_estado_entrega,
      next_estado_entrega: change.next_estado_entrega,
      reasons: change.reasons
    });
  });

  return {
    ok: true,
    totalPedidos: pedidosData.rows.length,
    candidatesCount: candidates.length,
    changes: changes,
    candidates: candidates,
    timestamp: bogNowIso_()
  };
}

function bogBuildBackfillChange_(pedido, burgers, guarniciones) {
  var pedidoId = bogTrim_(pedido.pedido_id);
  var estado = bogTrim_(pedido.estado);
  var estadoProduccion = bogTrim_(pedido.estado_produccion);
  var estadoEntrega = bogTrim_(pedido.estado_entrega);
  var reasons = [];
  var nextEstadoProduccion = estadoProduccion;
  var nextEstadoEntrega = estadoEntrega;
  var shouldPatchProduccion = false;
  var shouldPatchEntrega = false;

  if (!bogIsValidProductionState_(estadoProduccion)) {
    nextEstadoProduccion = bogInferBackfillProductionState_(estado, burgers, guarniciones, reasons);
    shouldPatchProduccion = true;
  }

  if (!bogIsValidDeliveryState_(estadoEntrega)) {
    nextEstadoEntrega = 'Pendiente';
    shouldPatchEntrega = true;
    reasons.push('estado_entrega vacío/inválido -> Pendiente');
  }

  return {
    pedido_id: pedidoId,
    folio: bogTrim_(pedido.folio),
    current_estado: estado,
    current_estado_produccion: estadoProduccion,
    next_estado_produccion: nextEstadoProduccion,
    current_estado_entrega: estadoEntrega,
    next_estado_entrega: nextEstadoEntrega,
    shouldPatchProduccion: shouldPatchProduccion,
    shouldPatchEntrega: shouldPatchEntrega,
    needsPatch: shouldPatchProduccion || shouldPatchEntrega,
    reasons: reasons
  };
}

function bogInferBackfillProductionState_(estadoPedido, burgers, guarniciones, reasons) {
  if (estadoPedido === 'Listo' || estadoPedido === 'Preparada') {
    reasons.push('estado legado indica listo/preparada -> estado_produccion=Preparada');
    return 'Preparada';
  }

  var burgersReady = burgers.length > 0 && burgers.every(function (b) { return (bogTrim_(b.estado_burger) || 'Pendiente') === 'Lista'; });
  var guarnicionesReady = guarniciones.length === 0 || guarniciones.every(function (g) { return (bogTrim_(g.estado_guarnicion) || 'Pendiente') === 'Hecha'; });
  if (burgersReady && guarnicionesReady) {
    reasons.push('burgers Lista y guarniciones Hecha/sin guarniciones -> Preparada');
    return 'Preparada';
  }

  var hasPreparing = estadoPedido === 'Preparando' || burgers.some(function (b) { return bogTrim_(b.estado_burger) === 'Preparando'; }) || guarniciones.some(function (g) { return bogTrim_(g.estado_guarnicion) === 'Preparando'; });
  if (hasPreparing) {
    reasons.push('hay estado Preparando en pedido/burger/guarnición -> Preparando');
    return 'Preparando';
  }

  reasons.push('sin señales de preparación/completado -> Pendiente');
  return 'Pendiente';
}

function bogIsValidProductionState_(value) {
  return ['Pendiente', 'Preparando', 'Preparada'].indexOf(bogTrim_(value)) !== -1;
}

function bogIsValidDeliveryState_(value) {
  return ['Pendiente', 'Entregada'].indexOf(bogTrim_(value)) !== -1;
}

function bogAssertNormalizedBackfillHeaders_(headerMap) {
  if (headerMap[bogNormalizeHeaderKey_('estado_produccion')] === undefined || headerMap[bogNormalizeHeaderKey_('estado_entrega')] === undefined) {
    throw new Error('Ejecuta ensureNormalizedKitchenHeaders() antes del backfill.');
  }
}
