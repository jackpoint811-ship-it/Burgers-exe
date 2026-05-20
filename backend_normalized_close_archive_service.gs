function previewNormalizedCloseDay() {
  return bogNormalizedRead_(function () {
    return bogBuildNormalizedCloseDayAnalysis_();
  }, 'Preview cierre normalizado listo.');
}

function archiveNormalizedCloseDayToDrive() {
  return bogNormalizedWrite_(function () {
    var analysis = bogBuildNormalizedCloseDayAnalysis_();
    if (analysis.finalizedCount === 0) {
      return {
        ok: true,
        archived: false,
        message: 'Sin pedidos finalizados para archivar.',
        fecha_corte: analysis.fecha_corte,
        timestamp: bogNowIso_()
      };
    }

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

    var corteId = 'CORTE-' + analysis.fecha_corte.replace(/-/g, '') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    var folderInfo = bogEnsureDriveArchiveFiles_(analysis, corteId);
    var createdAt = new Date();

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
    analysis.finalizedOrders.forEach(function (order) {
      bogAppendNormalizedEvent_(
        normalizedSheets.eventos,
        bogTrim_(order.pedido_id),
        'PEDIDO_ARCHIVADO_DRIVE',
        'Finalizada',
        'Archivado en Drive',
        corteId + ' | ' + folderInfo.folderUrl,
        'chekeo-2-close',
        createdAt
      );
    });

    return {
      ok: true,
      archived: true,
      duplicate: false,
      corte_id: corteId,
      fecha_corte: analysis.fecha_corte,
      finalizedCount: analysis.finalizedCount,
      blockedCount: analysis.blockedCount,
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

  var finalizedOrders = [];
  var blockedOrders = [];
  var totalVendido = 0;
  var totalBurgers = 0;
  var totalGuarniciones = 0;

  pedidos.forEach(function (pedido) {
    var order = bogBuildCloseDayOrderView_(pedido);
    var blockers = bogBuildCloseDayBlockers_(pedido);

    if (blockers.length === 0) {
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
        blockers: blockers
      });
    }
  });

  return {
    ok: true,
    fecha_corte: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/UTC', 'yyyy-MM-dd'),
    total_pedidos: pedidos.length,
    finalizedCount: finalizedOrders.length,
    blockedCount: blockedOrders.length,
    totals: {
      total_vendido: totalVendido,
      total_burgers: totalBurgers,
      total_guarniciones: totalGuarniciones
    },
    finalizedOrders: finalizedOrders,
    blockedOrders: blockedOrders,
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

function bogBuildCloseDayBlockers_(pedido) {
  var blockers = [];
  var estadoProduccion = bogTrim_(pedido.estado_produccion) || 'Pendiente';
  var estadoPago = bogTrim_(pedido.estado_pago) || 'Pendiente';
  var estadoEntrega = bogTrim_(pedido.estado_entrega) || 'Pendiente';
  if (estadoProduccion !== 'Preparada') blockers.push('Producción pendiente');
  if (estadoPago !== 'Pagado') blockers.push('Pago pendiente');
  if (estadoEntrega !== 'Entregada') blockers.push('Entrega pendiente');
  return blockers;
}

function bogFindExistingCorteByFecha_(archivoRows, fechaCorte) {
  for (var i = 0; i < archivoRows.length; i += 1) {
    if (bogTrim_(archivoRows[i].fecha_corte) === bogTrim_(fechaCorte)) return archivoRows[i];
  }
  return null;
}

function bogEnsureDriveArchiveFiles_(analysis, corteId) {
  var rootFolder = bogGetOrCreateFolderByName_(DriveApp, null, 'Burgers.exe Cortes');
  var dayFolder = bogGetOrCreateFolderByName_(DriveApp, rootFolder, 'Corte ' + analysis.fecha_corte);

  var summaryPayload = {
    corte_id: corteId,
    fecha_corte: analysis.fecha_corte,
    total_pedidos: analysis.total_pedidos,
    finalizedCount: analysis.finalizedCount,
    blockedCount: analysis.blockedCount,
    totals: analysis.totals,
    timestamp: analysis.timestamp
  };

  var summaryFile = bogUpsertJsonFile_(dayFolder, 'resumen_corte.json', summaryPayload);
  bogUpsertJsonFile_(dayFolder, 'pedidos_finalizados.json', analysis.finalizedOrders);
  bogUpsertJsonFile_(dayFolder, 'pedidos_bloqueados.json', analysis.blockedOrders);
  bogUpsertJsonFile_(dayFolder, 'eventos_pedidos.json', {
    corte_id: corteId,
    tipo_evento: 'PEDIDO_ARCHIVADO_DRIVE',
    pedidos: analysis.finalizedOrders.map(function (order) { return order.pedido_id; }),
    timestamp: bogNowIso_()
  });

  return { folderUrl: dayFolder.getUrl(), summaryFileUrl: summaryFile.getUrl() };
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
