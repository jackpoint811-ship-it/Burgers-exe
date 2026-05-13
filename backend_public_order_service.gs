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

  var items = Array.isArray(payload.items) ? payload.items : [];
  var total = Number(payload.total || 0);
  if (isNaN(total) || total < 0) {
    throw new Error('Total inválido.');
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.MASTER_SHEET_NAME);
  var sheetData = bogReadSheetAsObjects_(masterSheet, BurgerOGConstants.MASTER_REQUIRED_COLUMNS);

  var rowRecord = {
    'Marca temporal': new Date(),
    'Nombre': bogTrim_(payload.customerName),
    '¿Cuantas? [OG]': '',
    '¿Cuantas? [BBQ]': '',
    '¿Personalizar tu(s) hamburguesa(s)?': 'No',
    'Describe como quieres tus Burgers': '',
    'Personalizar OG': '',
    'Personalizar BBQ': '',
    'Burger OG': '',
    'BBQ Burger': '',
    'Extras [Pepinillos]': '',
    'Extras [Queso americano]': '',
    'Extras [Queso manchego]': '',
    'Extras [Tocino]': '',
    'Extras [Catsup]': '',
    'Extras [Mostaza]': '',
    'Extras [Tomate]': '',
    'Date un extra [Papas a la francesa OG]': '',
    'Date un extra [Papas a la francesa Especiales]': '',
    'Date un extra [Papas a la francesa Lemon&Pepper]': '',
    'Date un extra [Aros de Cebolla]': '',
    'Telefono': bogTrim_(payload.phone),
    'Forma de pago': bogTrim_(payload.paymentMethod),
    'Ubicación': bogTrim_(payload.location),
    'Total': total,
    'Precio Manual total': '',
    'Nota': bogBuildPublicOrderNote_(payload.note),
    'Confirmado': '',
    'Pagado?': 'No',
    'Tipo': ''
  };

  var normalizedItems = bogBuildNormalizedItemsMap_(items);
  rowRecord['¿Cuantas? [OG]'] = normalizedItems.OG || '';
  rowRecord['¿Cuantas? [BBQ]'] = normalizedItems.BBQ || '';
  rowRecord['Date un extra [Papas a la francesa OG]'] = normalizedItems.PAPAS_OG || '';
  rowRecord['Date un extra [Papas a la francesa Especiales]'] = normalizedItems.PAPAS_ESPECIALES || '';
  rowRecord['Date un extra [Papas a la francesa Lemon&Pepper]'] = normalizedItems.PAPAS_LEMON_PEPPER || '';
  rowRecord['Date un extra [Aros de Cebolla]'] = normalizedItems.AROS_CEBOLLA || '';
  rowRecord['Extras [Pepinillos]'] = normalizedItems.EXTRA_PEPINILLOS || '';
  rowRecord['Extras [Queso americano]'] = normalizedItems.EXTRA_QUESO_AMERICANO || '';
  rowRecord['Extras [Queso manchego]'] = normalizedItems.EXTRA_QUESO_MANCHEGO || '';
  rowRecord['Extras [Tocino]'] = normalizedItems.EXTRA_TOCINO || '';
  rowRecord['Extras [Catsup]'] = normalizedItems.EXTRA_CATSUP || '';
  rowRecord['Extras [Mostaza]'] = normalizedItems.EXTRA_MOSTAZA || '';
  rowRecord['Extras [Tomate]'] = normalizedItems.EXTRA_TOMATE || '';

  var row = bogBuildRowByHeaderMap_(sheetData.headers, sheetData.headerMap, rowRecord);
  masterSheet.getRange(masterSheet.getLastRow() + 1, 1, 1, sheetData.headers.length).setValues([row]);

  return {
    accepted: true,
    mode: 'write',
    total: total,
    itemCount: items.length
  };
}

function bogBuildNormalizedItemsMap_(items) {
  var map = {};
  items.forEach(function (item) {
    var sku = bogTrim_(item && item.sku);
    if (!sku) {
      return;
    }
    var qty = Number(item && item.qty);
    if (isNaN(qty) || qty <= 0) {
      return;
    }
    map[sku] = (map[sku] || 0) + qty;
  });
  return map;
}


function bogBuildPublicOrderNote_(clientNote) {
  var note = bogTrim_(clientNote);
  var channel = 'Canal: Burgers.exe Cloudflare';
  return note ? (note + ' | ' + channel) : channel;
}
