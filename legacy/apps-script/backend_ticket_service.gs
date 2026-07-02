function bogGetClientTicketData_(orderId) {
  var cleanOrderId = bogTrim_(orderId);
  if (!cleanOrderId) {
    throw new Error('ID de pedido requerido.');
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var chekeoSheet = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
  var orderRow = bogFindChekeoOrderRowById_(chekeoSheet, cleanOrderId);
  if (!orderRow || !orderRow.rowData) {
    throw new Error('Pedido no encontrado: ' + cleanOrderId);
  }

  var order = orderRow.rowData;
  return {
    orderId: String(order['ID Pedido'] || ''),
    name: String(order['Nombre'] || ''),
    payment: String(order['Método Pago'] || order['Estado Pago'] || ''),
    noteClient: String(order['Nota Cliente'] || ''),
    total: bogNormalizeMoney_(order['Total']),
    priceBreakdown: bogBuildTicketPriceBreakdown_(order, bogReadPublishedPricesMap_(spreadsheet))
  };
}

function bogReadPublishedPricesMap_(spreadsheet) {
  var pricesSheet = bogGetRequiredSheet_(spreadsheet, 'Precios Publicados');
  var data = bogReadSheetAsObjects_(pricesSheet, ['Nombre', 'Precio']);
  var map = {};

  data.rows.forEach(function (row) {
    if (!row || !row.data) {
      return;
    }

    var concept = bogTrim_(row.data['Nombre']);
    if (!concept || concept === '-' || bogNormalizeHeaderKey_(concept) === 'n/a') {
      return;
    }

    var rawPrice = row.data['Precio'];
    if (rawPrice === null || rawPrice === undefined || bogTrim_(rawPrice) === '') {
      return;
    }

    var amount;
    try {
      amount = bogNormalizeMoney_(rawPrice);
    } catch (err) {
      return;
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      return;
    }

    map[bogNormalizeTicketConceptKey_(concept)] = amount;

    var idAlias = bogTrim_(row.data['ID']);
    if (idAlias) {
      var normalizedId = bogNormalizeTicketConceptKey_(idAlias);
      if (normalizedId && map[normalizedId] === undefined) {
        map[normalizedId] = amount;
      }
    }
  });

  return map;
}

function bogBuildTicketPriceBreakdown_(order, priceMap) {
  var lines = [];
  lines = lines.concat(bogBuildTicketLinesFromText_(order['Hamburguesas'], 'item', priceMap));
  lines = lines.concat(bogBuildTicketLinesFromText_(order['Extras'], 'extra', priceMap));
  lines = lines.concat(bogBuildTicketLinesFromText_(order['Guarniciones'], 'item', priceMap));
  return lines;
}

function bogBuildTicketLinesFromText_(text, kind, priceMap) {
  var cleaned = bogTrim_(text);
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') {
    return [];
  }

  return cleaned.split(/\s*\+\s*/).map(function (part) {
    var concept = bogTrim_(part);
    if (!concept || concept === '-') {
      return null;
    }

    var quantity = 1;
    var conceptText = concept;
    var qtyMatch = concept.match(/^(\d+)\s*x\s+(.*)$/i);
    if (qtyMatch) {
      quantity = Number(qtyMatch[1]) || 1;
      conceptText = bogTrim_(qtyMatch[2]);
    }

    var amount = bogFindTicketConceptPrice_(conceptText, priceMap);
    return {
      kind: kind,
      concept: kind === 'extra'
        ? ('+ ' + (quantity > 1 ? (quantity + 'x ') : '') + conceptText)
        : (quantity + 'x ' + conceptText),
      amount: amount === null ? null : amount * quantity,
      review: amount === null
    };
  }).filter(function (line) { return !!line; });
}

function bogFindTicketConceptPrice_(concept, priceMap) {
  var exact = priceMap[bogNormalizeTicketConceptKey_(concept)];
  if (typeof exact === 'number' && !isNaN(exact)) {
    return exact;
  }
  return null;
}

function bogNormalizeTicketConceptKey_(text) {
  return bogNormalizeHeaderKey_(text)
    .replace(/^\+\s*/g, '')
    .replace(/^(\d+)\s*x\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
