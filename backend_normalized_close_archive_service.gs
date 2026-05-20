function previewNormalizedCloseDay() {
  return bogNormalizedRead_(function () {
    return bogBuildNormalizedCloseDayAnalysis_();
  }, 'Preview cierre normalizado listo.');
}

function archiveNormalizedCloseDayToDrive() {
  return bogNormalizedWrite_(function () {
    var analysis = bogBuildNormalizedCloseDayAnalysis_();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var archivoSheet = bogGetSheetWithHeaderContract_(ss, 'ARCHIVO_CORTES', CHEKEO_2_SHEET_HEADERS.ARCHIVO_CORTES);
    var archivoRows = bogReadSheetAsObjects_(archivoSheet.sheet, CHEKEO_2_SHEET_HEADERS.ARCHIVO_CORTES).rows.map(function (row) { return row.data; });
    var existing = bogFindExistingCorteByFecha_(archivoRows, analysis.fecha_corte);

    if (existing) {
      return {
        ok: true,
        archived: false,
        duplicate: true,
        fecha_corte: analysis.fecha_corte,
        corte_id: bogTrim_(existing.corte_id),
        drive_folder_url: bogTrim_(existing.drive_folder_url),
        drive_summary_file_url: bogTrim_(existing.drive_summary_file_url),
        timestamp: bogNowIso_()
      };
    }

    if (analysis.finalizedCount === 0) {
      return {
        ok: true,
        archived: false,
        message: analysis.alreadyArchivedCount > 0 ? 'Sin pedidos finalizados nuevos para archivar.' : 'Sin pedidos finalizados para archivar.',
        fecha_corte: analysis.fecha_corte,
        alreadyArchivedCount: analysis.alreadyArchivedCount,
        timestamp: bogNowIso_()
      };
    }

    var corteId = 'CORTE-' + analysis.fecha_corte.replace(/-/g, '') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    var createdAt = new Date();
    var folderInfo = bogEnsureDriveArchiveFolder_(analysis.fecha_corte);
    var archiveEvents = analysis.finalizedOrders.map(function (order) {
      return bogBuildArchiveEventRecord_(bogTrim_(order.pedido_id), corteId, folderInfo.folderUrl, createdAt);
    });

    folderInfo = bogEnsureDriveArchiveFiles_(folderInfo.folder, folderInfo.folderUrl, analysis, corteId, archiveEvents);

    bogAppendRecordByHeaders_(archivoSheet.sheet, archivoSheet.headers, archivoSheet.headerMap, {
      corte_id: corteId,
      fecha_corte: analysis.fecha_corte,
      total_pedidos: analysis.total_pedidos,
      total_vendido: analysis.totals.total_vendido,
      total_burgers: analysis.totals.total_burgers,
      total_guarniciones: analysis.totals.total_guarniciones,
      drive_folder_url: folderInfo.folderUrl,
      drive_summary_file_url: folderInfo.summaryFileUrl,
      creado_en: createdAt,
      creado_por: 'chekeo-2-close'
    });

    var normalizedSheets = bogGetNormalizedSheetsWithHeaders_(ss);
    archiveEvents.forEach(function (eventRecord) {
      bogAppendRecordByHeaders_(normalizedSheets.eventos.sheet, normalizedSheets.eventos.headers, normalizedSheets.eventos.headerMap, eventRecord);
    });

    return {
      ok: true,
      archived: true,
      duplicate: false,
      corte_id: corteId,
      fecha_corte: analysis.fecha_corte,
      finalizedCount: analysis.finalizedCount,
      blockedCount: analysis.blockedCount,
      alreadyArchivedCount: analysis.alreadyArchivedCount,
      drive_folder_url: folderInfo.folderUrl,
      drive_summary_file_url: folderInfo.summaryFileUrl,
      timestamp: bogNowIso_()
    };
  }, 'Cierre normalizado archivado en Drive.');
}

function bogBuildNormalizedCloseDayAnalysis_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedSheetsWithHeaders_(ss);
  var pedidos = bogReadSheetAsObjects_(sheets.pedidos.sheet, BOG_NORMALIZED_HEADERS.PEDIDOS).rows.map(function (row) { return row.data; });
  var items = bogReadSheetAsObjects_(sheets.items.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_ITEMS).rows.map(function (row) { return row.data; });
  var burgers = bogReadSheetAsObjects_(sheets.burgers.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS).rows.map(function (row) { return row.data; });
  var guarniciones = bogReadSheetAsObjects_(sheets.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows.map(function (row) { return row.data; });
  var eventos = bogReadSheetAsObjects_(sheets.eventos.sheet, BOG_NORMALIZED_HEADERS.EVENTOS_PEDIDO).rows.map(function (row) { return row.data; });

  var itemTotalsByPedido = {};
  items.forEach(function (item) {
    var pedidoId = bogTrim_(item.pedido_id);
    if (!pedidoId) return;
    if (!itemTotalsByPedido[pedidoId]) itemTotalsByPedido[pedidoId] = { burgers: 0, guarniciones: 0 };
    var tipo = bogTrim_(item.tipo);
    var cantidad = Number(item.cantidad);
    if (isNaN(cantidad)) cantidad = 0;
    if (tipo === 'Burger') itemTotalsByPedido[pedidoId].burgers += cantidad;
    if (tipo === 'Guarnicion') itemTotalsByPedido[pedidoId].guarniciones += cantidad;
  });

  var burgersByPedido = bogGroupRowsByPedidoId_(burgers);
  var guarnicionesByPedido = bogGroupRowsByPedidoId_(guarniciones);
  var eventsByPedido = bogGroupRowsByPedidoId_(eventos);
  var archivedEventsByPedido = bogBuildArchivedEventsMap_(eventos);

  var finalizedOrders = [];
  var blockedOrders = [];
  var alreadyArchivedOrders = [];
  var totalVendido = 0;
  var totalBurgers = 0;
  var totalGuarniciones = 0;

  pedidos.forEach(function (pedido) {
    var order = bogBuildCloseDayOrderView_(pedido);
    var finalization = bogGetCloseDayFinalizationState_(pedido, burgersByPedido[order.pedido_id] || [], guarnicionesByPedido[order.pedido_id] || []);
    var archivedEvent = archivedEventsByPedido[order.pedido_id] || null;

    if (finalization.finalized && archivedEvent) {
      alreadyArchivedOrders.push({
        pedido_id: order.pedido_id,
        folio: order.folio,
        archived_event_id_or_timestamp: bogTrim_(archivedEvent.evento_id) || bogTrim_(archivedEvent.timestamp)
      });
      return;
    }

    if (finalization.finalized) {
      finalizedOrders.push(order);
      var total = Number(pedido.total);
      if (!isNaN(total)) totalVendido += total;
      var itemAgg = itemTotalsByPedido[order.pedido_id] || { burgers: 0, guarniciones: 0 };
      totalBurgers += itemAgg.burgers;
      totalGuarniciones += itemAgg.guarniciones;
    } else {
      blockedOrders.push({
        pedido_id: order.pedido_id,
        folio: order.folio,
        blockers: finalization.blockers
      });
    }
  });

  var detailedEvents = bogCollectEventsForFinalizedOrders_(finalizedOrders, eventsByPedido);

  return {
    ok: true,
    fecha_corte: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/UTC', 'yyyy-MM-dd'),
    total_pedidos: pedidos.length,
    finalizedCount: finalizedOrders.length,
    blockedCount: blockedOrders.length,
    alreadyArchivedCount: alreadyArchivedOrders.length,
    totals: {
      total_vendido: totalVendido,
      total_burgers: totalBurgers,
      total_guarniciones: totalGuarniciones
    },
    finalizedOrders: finalizedOrders,
    blockedOrders: blockedOrders,
    alreadyArchivedOrders: alreadyArchivedOrders,
    finalizedOrderEvents: detailedEvents,
    timestamp: bogNowIso_()
  };
}

function bogBuildCloseDayOrderView_(pedido) {
  return {
    pedido_id: bogTrim_(pedido.pedido_id),
    folio: bogTrim_(pedido.folio),
    cliente_nombre: bogTrim_(pedido.cliente_nombre),
    total: Number(pedido.total) || 0,
    estado_produccion: bogTrim_(pedido.estado_produccion) || 'Pendiente',
    estado_pago: bogTrim_(pedido.estado_pago) || 'Pendiente',
    estado_entrega: bogTrim_(pedido.estado_entrega) || 'Pendiente'
  };
}

function bogGetCloseDayFinalizationState_(pedido, burgers, guarniciones) {
  var estadoLegacy = bogTrim_(pedido.estado);
  var estadoProduccion = bogTrim_(pedido.estado_produccion) || 'Pendiente';
  var estadoPago = bogTrim_(pedido.estado_pago) || 'Pendiente';
  var estadoEntrega = bogTrim_(pedido.estado_entrega) || 'Pendiente';

  var burgersReady = burgers.length > 0 && burgers.every(function (b) { return (bogTrim_(b.estado_burger) || 'Pendiente') === 'Lista'; });
  var guarnicionesReady = guarniciones.length === 0 || guarniciones.every(function (g) { return (bogTrim_(g.estado_guarnicion) || 'Pendiente') === 'Hecha'; });

  var productionReady = estadoProduccion === 'Preparada' || estadoLegacy === 'Listo' || estadoLegacy === 'Preparada' || (burgersReady && guarnicionesReady);
  var paymentReady = estadoPago === 'Pagado';
  var deliveryReady = estadoEntrega === 'Entregada';

  var blockers = [];
  if (!productionReady) blockers.push('Producción pendiente');
  if (!paymentReady) blockers.push('Pago pendiente');
  if (!deliveryReady) blockers.push('Entrega pendiente');

  return {
    production_ready: productionReady,
    payment_ready: paymentReady,
    delivery_ready: deliveryReady,
    finalized: productionReady && paymentReady && deliveryReady,
    blockers: blockers
  };
}

function bogBuildArchivedEventsMap_(eventos) {
  var map = {};
  eventos.forEach(function (eventRow) {
    if (bogTrim_(eventRow.tipo_evento) !== 'PEDIDO_ARCHIVADO_DRIVE') return;
    var pedidoId = bogTrim_(eventRow.pedido_id);
    if (!pedidoId) return;
    if (!map[pedidoId]) map[pedidoId] = eventRow;
  });
  return map;
}

function bogCollectEventsForFinalizedOrders_(finalizedOrders, eventsByPedido) {
  var merged = [];
  finalizedOrders.forEach(function (order) {
    var pedidoId = bogTrim_(order.pedido_id);
    var rows = eventsByPedido[pedidoId] || [];
    rows.forEach(function (eventRow) {
      merged.push(bogMapNormalizedEventRecord_(eventRow));
    });
  });
  return merged;
}

function bogMapNormalizedEventRecord_(eventRow) {
  return {
    evento_id: bogTrim_(eventRow.evento_id),
    pedido_id: bogTrim_(eventRow.pedido_id),
    tipo_evento: bogTrim_(eventRow.tipo_evento),
    estado_anterior: bogTrim_(eventRow.estado_anterior),
    estado_nuevo: bogTrim_(eventRow.estado_nuevo),
    detalle: bogTrim_(eventRow.detalle),
    usuario: bogTrim_(eventRow.usuario),
    timestamp: eventRow.timestamp,
    origen_app: bogTrim_(eventRow.origen_app)
  };
}

function bogBuildArchiveEventRecord_(pedidoId, corteId, folderUrl, createdAt) {
  return {
    evento_id: bogBuildNormalizedEventId_(pedidoId, createdAt),
    pedido_id: pedidoId,
    tipo_evento: 'PEDIDO_ARCHIVADO_DRIVE',
    estado_anterior: 'Finalizada',
    estado_nuevo: 'Archivado en Drive',
    detalle: corteId + (folderUrl ? ' | ' + folderUrl : ''),
    usuario: 'chekeo-2-close',
    timestamp: createdAt,
    origen_app: 'chekeo-2'
  };
}

function bogGroupRowsByPedidoId_(rows) {
  var map = {};
  rows.forEach(function (row) {
    var pedidoId = bogTrim_(row.pedido_id);
    if (!pedidoId) return;
    if (!map[pedidoId]) map[pedidoId] = [];
    map[pedidoId].push(row);
  });
  return map;
}

function bogFindExistingCorteByFecha_(archivoRows, fechaCorte) {
  for (var i = 0; i < archivoRows.length; i += 1) {
    if (bogTrim_(archivoRows[i].fecha_corte) === bogTrim_(fechaCorte)) return archivoRows[i];
  }
  return null;
}

function bogEnsureDriveArchiveFolder_(fechaCorte) {
  var rootFolder = bogGetOrCreateFolderByName_(DriveApp, null, 'Burgers.exe Cortes');
  var dayFolder = bogGetOrCreateFolderByName_(DriveApp, rootFolder, 'Corte ' + fechaCorte);
  return { folder: dayFolder, folderUrl: dayFolder.getUrl() };
}

function bogEnsureDriveArchiveFiles_(dayFolder, folderUrl, analysis, corteId, archiveEvents) {

  var summaryPayload = {
    corte_id: corteId,
    fecha_corte: analysis.fecha_corte,
    total_pedidos: analysis.total_pedidos,
    finalizedCount: analysis.finalizedCount,
    blockedCount: analysis.blockedCount,
    alreadyArchivedCount: analysis.alreadyArchivedCount,
    totals: analysis.totals,
    timestamp: analysis.timestamp
  };

  var allEvents = analysis.finalizedOrderEvents.slice();
  archiveEvents.forEach(function (eventRecord) {
    var mapped = bogMapNormalizedEventRecord_(eventRecord);
    mapped.detalle = eventRecord.detalle ? eventRecord.detalle : (corteId + ' | ' + folderUrl);
    allEvents.push(mapped);
  });

  var summaryFile = bogUpsertJsonFile_(dayFolder, 'resumen_corte.json', summaryPayload);
  bogUpsertJsonFile_(dayFolder, 'pedidos_finalizados.json', analysis.finalizedOrders);
  bogUpsertJsonFile_(dayFolder, 'pedidos_bloqueados.json', analysis.blockedOrders);
  bogUpsertJsonFile_(dayFolder, 'eventos_pedidos.json', {
    corte_id: corteId,
    fecha_corte: analysis.fecha_corte,
    eventos: allEvents
  });

  return { folder: dayFolder, folderUrl: folderUrl, summaryFileUrl: summaryFile.getUrl() };
}

function bogGetOrCreateFolderByName_(driveApp, parentFolder, folderName) {
  var iterator = parentFolder ? parentFolder.getFoldersByName(folderName) : driveApp.getFoldersByName(folderName);
  if (iterator.hasNext()) return iterator.next();
  return parentFolder ? parentFolder.createFolder(folderName) : driveApp.createFolder(folderName);
}

function bogUpsertJsonFile_(folder, fileName, payload) {
  var json = JSON.stringify(payload, null, 2);
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var existing = files.next();
    existing.setContent(json);
    return existing;
  }
  return folder.createFile(fileName, json, MimeType.JSON);
}
