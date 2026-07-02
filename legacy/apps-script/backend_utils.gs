function bogNowIso_() {
  return new Date().toISOString();
}

function bogNowDateMx_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function bogNowTimeMx_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
}

function bogNormalizeHeaderKey_(value) {
  return bogTrim_(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function bogPadOrderNumber_(masterRow) {
  var orderNumber = Number(masterRow) - 1;
  var asText = String(orderNumber);
  while (asText.length < 3) {
    asText = '0' + asText;
  }
  return asText;
}

function bogBuildOrderId_(masterRow) {
  return 'BOG-' + bogPadOrderNumber_(masterRow);
}

function bogToObjectByHeaderMap_(headers, headerMap, row) {
  var obj = {};
  headers.forEach(function (header) {
    obj[header] = bogSerializeSheetValue_(row[headerMap[bogNormalizeHeaderKey_(header)]]);
  });
  return obj;
}

function bogSerializeSheetValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  if (Array.isArray(value)) {
    return value.map(function (item) {
      return bogSerializeSheetValue_(item);
    });
  }

  if (value && typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = bogSerializeSheetValue_(value[key]);
    });
    return out;
  }

  if (value === undefined) {
    return '';
  }

  return value;
}

function bogTrim_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function bogNormalizeAlertValue_(value) {
  return bogTrim_(value) === '⚠️' ? '⚠️' : '';
}

function bogHasUsefulValue_(value) {
  var text = bogNormalizeHeaderKey_(value);
  if (!text) {
    return false;
  }
  return ['0', 'no', 'n/a', 'na', 'ninguno', 'ninguna', 'false'].indexOf(text) === -1;
}

function bogParseCount_(value) {
  if (typeof value === 'number') {
    return value > 0 ? value : null;
  }

  var text = bogTrim_(value);
  if (!text) {
    return null;
  }

  var normalized = bogNormalizeHeaderKey_(text);
  if (['si', 'sí', 'yes', 'x'].indexOf(normalized) !== -1) {
    return 1;
  }

  var matched = normalized.match(/-?\d+(?:[\.,]\d+)?/);
  if (!matched) {
    return null;
  }

  var asNumber = Number(matched[0].replace(',', '.'));
  if (isNaN(asNumber) || asNumber <= 0) {
    return null;
  }

  return asNumber;
}

function bogFormatBurgerOrSideWithCount_(count, name) {
  var cleanName = bogTrim_(name);
  if (!cleanName) {
    return '';
  }
  var normalizedCount = count && count > 0 ? count : 1;
  return String(normalizedCount) + 'x ' + cleanName;
}

function bogFormatExtraWithCount_(count, name) {
  var cleanName = bogTrim_(name);
  if (!cleanName) {
    return '';
  }
  if (!count || count === 1) {
    return cleanName;
  }
  return String(count) + 'x ' + cleanName;
}

function bogExtractBracketLabel_(header, prefixPattern) {
  var text = bogTrim_(header);
  var match = text.match(prefixPattern);
  return match ? bogTrim_(match[1]) : '';
}

function bogNormalizeMoney_(value) {
  if (typeof value === 'number') {
    if (isNaN(value)) {
      throw new Error('Total inválido: NaN.');
    }
    return value;
  }

  var raw = bogTrim_(value);
  if (!raw) {
    return 0;
  }

  var cleaned = raw
    .replace(/mxn/gi, '')
    .replace(/\$/g, '')
    .replace(/\s+/g, '');

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') === -1) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  var parsed = Number(cleaned);
  if (isNaN(parsed)) {
    throw new Error('No se pudo normalizar Total: ' + raw);
  }
  return parsed;
}

function bogParseMasterTimestamp_(value) {
  if (!value) {
    return { fecha: '', hora: '' };
  }

  var dateValue = value;
  if (!(value instanceof Date)) {
    dateValue = new Date(value);
  }

  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
    return { fecha: bogTrim_(value), hora: '' };
  }

  return {
    fecha: Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    hora: Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'HH:mm')
  };
}

function bogNormalizePaymentMethod_(value) {
  var text = bogNormalizeHeaderKey_(value);

  if (!text) {
    return BurgerOGConstants.DEFAULTS.METODO_PAGO;
  }
  if (text.indexOf('mixto') !== -1) {
    return 'Mixto';
  }
  if (text.indexOf('transf') !== -1 || text.indexOf('deposit') !== -1 || text.indexOf('tarjeta') !== -1) {
    return 'Transferencia';
  }
  if (text.indexOf('efectivo') !== -1 || text === 'cash') {
    return 'Efectivo';
  }
  return BurgerOGConstants.DEFAULTS.METODO_PAGO;
}

function bogIsEffectivelyEmptyOrder_(record) {
  return !Object.keys(record).some(function (key) {
    return bogHasUsefulValue_(record[key]);
  });
}

function bogSafeGetByAliases_(record, aliases) {
  var normalizedToKey = {};
  Object.keys(record).forEach(function (key) {
    normalizedToKey[bogNormalizeHeaderKey_(key)] = key;
  });

  for (var i = 0; i < aliases.length; i += 1) {
    var aliasKey = normalizedToKey[bogNormalizeHeaderKey_(aliases[i])];
    if (aliasKey !== undefined) {
      return record[aliasKey];
    }
  }
  return '';
}

function bogUniqueNonEmpty_(items) {
  var seen = {};
  var out = [];
  items.forEach(function (item) {
    var text = bogTrim_(item);
    if (!text) {
      return;
    }
    if (!seen[text]) {
      seen[text] = true;
      out.push(text);
    }
  });
  return out;
}

function bogNowDateParts_() {
  var now = new Date();
  return {
    fecha: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    hora: Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
    compact: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
  };
}

function bogBuildCorteId_() {
  return 'CORTE-' + bogNowDateParts_().compact;
}

function bogGetActiveEnvironment_() {
  var properties = PropertiesService.getScriptProperties();
  var configuredMode = bogTrim_(properties.getProperty('BOG_ACTIVE_ENV'));
  if (configuredMode === BurgerOGConstants.ENVIRONMENTS.PROD) {
    return BurgerOGConstants.ENVIRONMENTS.PROD;
  }
  return BurgerOGConstants.ENVIRONMENTS.TEST;
}

function bogGetActiveChekeoSheetName_() {
  var activeEnvironment = bogGetActiveEnvironment_();
  if (activeEnvironment === BurgerOGConstants.ENVIRONMENTS.PROD) {
    return BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME;
  }
  return BurgerOGConstants.SHEETS.CHEKEO_ACTIVE_SHEET_NAME;
}
