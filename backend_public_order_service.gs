function bogCreatePublicOrderFromCloudflare_(requestBody) {
  if (!requestBody || requestBody.action !== 'createPublicOrder') {
    throw new Error('Acción inválida.');
  }

  var auth = requestBody.auth || {};
  var providedSecret = bogTrim_(auth.secret);
  var expectedSecret = bogTrim_(PropertiesService.getScriptProperties().getProperty('PUBLIC_ORDER_SHARED_SECRET'));

  if (!expectedSecret) {
    throw new Error('PUBLIC_ORDER_SHARED_SECRET no configurado en Script Properties.');
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Error('No autorizado. Secret inválido.');
  }

  var payload = requestBody.payload || {};
  var required = ['customerName', 'phone', 'location', 'paymentMethod'];
  required.forEach(function (field) {
    if (!bogTrim_(payload[field])) {
      throw new Error('Campo requerido faltante: ' + field);
    }
  });

  bogValidatePublicOrderPayload_(payload);

  if (!Array.isArray(payload.items)) {
    throw new Error('Items inválidos: se esperaba array.');
  }
  var items = payload.items;
  if (!items.length) {
    throw new Error('Items inválidos: agrega al menos un producto.');
  }
  var normalizedItems = bogBuildNormalizedItemsMap_(items);
  if (!Object.keys(normalizedItems).length) {
    throw new Error('Items inválidos: no hay productos válidos para procesar.');
  }
  var computedTotal = bogComputePublicOrderTotal_(normalizedItems);
  var providedTotal = Number(payload.total || 0);
  if (isNaN(providedTotal) || providedTotal < 0) {
    throw new Error('Total inválido.');
  }
  if (computedTotal !== providedTotal) {
    throw new Error('Total inconsistente. Esperado ' + computedTotal + ' pero recibido ' + providedTotal + '.');
  }

  var personalizationSummary = bogBuildPublicOrderPersonalizationsSummary_(payload.personalizations, normalizedItems);

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.MASTER_SHEET_NAME);
  var sheetData = bogReadSheetAsObjects_(masterSheet, BurgerOGConstants.MASTER_REQUIRED_COLUMNS);

  var hasAnyPersonalization = personalizationSummary.all.length > 0;
  var rowRecord = {
    'Marca temporal': new Date(),
    'Nombre': bogTrim_(payload.customerName),
    '¿Cuantas? [OG]': normalizedItems.OG || '',
    '¿Cuantas? [BBQ]': normalizedItems.BBQ || '',
    '¿Personalizar tu(s) hamburguesa(s)?': hasAnyPersonalization ? 'Si' : 'No',
    'Describe como quieres tus Burgers': personalizationSummary.full,
    'Personalizar OG': personalizationSummary.og.length ? 'Si' : 'No',
    'Personalizar BBQ': personalizationSummary.bbq.length ? 'Si' : 'No',
    'Burger OG': personalizationSummary.ogText,
    'BBQ Burger': personalizationSummary.bbqText,
    'Extras [Pepinillos]': normalizedItems.EXTRA_PEPINILLOS || '',
    'Extras [Queso americano]': normalizedItems.EXTRA_QUESO_AMERICANO || '',
    'Extras [Queso manchego]': normalizedItems.EXTRA_QUESO_MANCHEGO || '',
    'Extras [Tocino]': normalizedItems.EXTRA_TOCINO || '',
    'Extras [Catsup]': normalizedItems.EXTRA_CATSUP || '',
    'Extras [Mostaza]': normalizedItems.EXTRA_MOSTAZA || '',
    'Extras [Tomate]': normalizedItems.EXTRA_TOMATE || '',
    'Date un extra [Papas a la francesa OG]': normalizedItems.PAPAS_OG || '',
    'Date un extra [Papas a la francesa Especiales]': normalizedItems.PAPAS_ESPECIALES || '',
    'Date un extra [Papas a la francesa Lemon&Pepper]': normalizedItems.PAPAS_LEMON_PEPPER || '',
    'Date un extra [Aros de Cebolla]': normalizedItems.AROS_CEBOLLA || '',
    'Telefono': bogTrim_(payload.phone),
    'Forma de pago': bogTrim_(payload.paymentMethod),
    'Ubicación': bogTrim_(payload.location),
    'Total': providedTotal,
    'Precio Manual total': '',
    'Nota': bogBuildPublicOrderNote_(payload.note),
    'Confirmado': '',
    'Pagado?': 'No',
    'Tipo': ''
  };

  var row = bogBuildRowByHeaderMap_(sheetData.headers, sheetData.headerMap, rowRecord);
  masterSheet.getRange(masterSheet.getLastRow() + 1, 1, 1, sheetData.headers.length).setValues([row]);

  return {
    accepted: true,
    mode: 'write',
    total: providedTotal,
    itemCount: items.length
  };
}

function bogValidatePublicOrderPayload_(payload) {
  var paymentMethod = bogTrim_(payload.paymentMethod);
  if (paymentMethod !== 'Pago mismo dia' && paymentMethod !== 'Pagar Antes') {
    throw new Error('Forma de pago inválida.');
  }

  var location = bogTrim_(payload.location);
  if (location !== 'Torre GGA' && location !== 'Torre Valcob') {
    throw new Error('Ubicación inválida.');
  }
}

function bogBuildNormalizedItemsMap_(items) {
  var map = {};
  items.forEach(function (item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Item inválido: estructura no válida.');
    }
    if (!Object.prototype.hasOwnProperty.call(item, 'sku')) {
      throw new Error('Item inválido: falta sku.');
    }
    var sku = bogTrim_(item.sku);
    if (!sku) {
      throw new Error('Item inválido: sku vacío.');
    }
    if (!Object.prototype.hasOwnProperty.call(BurgerOGConstants.PUBLIC_ORDER_PRICE_TABLE, sku)) {
      throw new Error('SKU inválido: ' + sku);
    }
    var qty = Number(item && item.qty);
    if (isNaN(qty) || qty <= 0 || Math.floor(qty) !== qty) {
      throw new Error('Cantidad inválida para SKU: ' + sku);
    }
    map[sku] = (map[sku] || 0) + qty;
  });
  return map;
}

function bogComputePublicOrderTotal_(normalizedItems) {
  return Object.keys(normalizedItems).reduce(function (acc, sku) {
    return acc + (normalizedItems[sku] * BurgerOGConstants.PUBLIC_ORDER_PRICE_TABLE[sku]);
  }, 0);
}

var BOG_PUBLIC_ORDER_WITHOUT_ALLOWED = {
  OG: {
    'Sin Tocino': true,
    'Sin Queso americano': true,
    'Sin Queso manchego': true,
    'Sin Jitomate': true,
    'Sin Lechuga': true,
    'Sin Pepinillos': true,
    'Sin Catsup': true,
    'Sin Mostaza': true,
    'Sin Mayonesa': true
  },
  BBQ: {
    'Sin Tocino': true,
    'Sin Queso americano': true,
    'Sin Queso manchego': true,
    'Sin Aros de cebolla': true,
    'Sin Salsa bbq': true
  }
};

function bogBuildPublicOrderPersonalizationsSummary_(rawPersonalizations, normalizedItems) {
  var burgers = rawPersonalizations && Array.isArray(rawPersonalizations.burgers) ? rawPersonalizations.burgers : [];
  var skuLimits = {
    OG: Number(normalizedItems.OG || 0),
    BBQ: Number(normalizedItems.BBQ || 0)
  };

  var lines = { OG: [], BBQ: [] };

  burgers.forEach(function (entry) {
    var sku = bogTrim_(entry && entry.sku);
    if (sku !== 'OG' && sku !== 'BBQ') {
      throw new Error('Personalización con SKU inválido: ' + sku);
    }
    var max = skuLimits[sku] || 0;
    var burgerIndex = Number(entry && entry.burgerIndex);
    if (isNaN(burgerIndex) || Math.floor(burgerIndex) !== burgerIndex || burgerIndex <= 0 || burgerIndex > max) {
      throw new Error('Personalización fuera de rango para ' + sku + ': burgerIndex ' + burgerIndex + ' (qty=' + max + ').');
    }
    var without = Array.isArray(entry && entry.without) ? entry.without : [];
    var cleanedWithout = without.map(function (label) { return bogTrim_(label); }).filter(Boolean);
    cleanedWithout.forEach(function (label) {
      if (BurgerOGConstants.SPECIAL_FLAGS_REGEX.test(label)) {
        throw new Error('Personalización inválida: contiene texto restringido.');
      }
      if (!BOG_PUBLIC_ORDER_WITHOUT_ALLOWED[sku][label]) {
        throw new Error('Personalización inválida para ' + sku + ': ' + label);
      }
    });
    var description = cleanedWithout.length ? cleanedWithout.join(', ') : 'Con todo';
    lines[sku].push({
      idx: burgerIndex,
      text: sku + ' #' + burgerIndex + ': ' + description
    });
  });

  lines.OG.sort(function (a, b) { return a.idx - b.idx; });
  lines.BBQ.sort(function (a, b) { return a.idx - b.idx; });

  var ogText = lines.OG.map(function (row) { return row.text; }).join(' | ');
  var bbqText = lines.BBQ.map(function (row) { return row.text; }).join(' | ');
  var all = lines.OG.concat(lines.BBQ).map(function (row) { return row.text; });

  return {
    og: lines.OG,
    bbq: lines.BBQ,
    ogText: ogText,
    bbqText: bbqText,
    full: all.join(' | '),
    all: all
  };
}

function bogBuildPublicOrderNote_(clientNote) {
  var note = bogTrim_(clientNote);
  var channel = 'Canal: Burgers.exe Cloudflare';
  return note ? (note + ' | ' + channel) : channel;
}
