/**
 * Phase 2A (read-only): MENU_LIVE parser/validator service.
 *
 * Nota sobre imágenes:
 * En esta fase el campo `imagen` se interpreta en modo best-effort.
 * Si la celda expone un string/URL usable se devuelve en `image_url`.
 * Si la imagen está insertada como objeto de celda o no es extraíble por Apps Script,
 * se devuelve `image_url: ""` y `image_status: "cell_image_or_blank"`.
 */

var MENU_LIVE_HEADERS = [
  'producto_id',
  'tipo',
  'nombre',
  'descripcion',
  'precio_publico',
  'activo',
  'orden_visual',
  'imagen',
  'origen_costo_ref',
  'actualizado_en',
  'actualizado_por'
];

var MENU_LIVE_ALLOWED_TIPOS = {
  Burger: true,
  Guarnicion: true,
  Extra: true
};

function validateMenuLiveContract() {
  var nowIso = new Date().toISOString();
  var warnings = [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MENU_LIVE');

  if (!sheet) {
    return {
      ok: false,
      missingHeaders: MENU_LIVE_HEADERS.slice(),
      extraHeaders: [],
      warnings: ['No existe la hoja MENU_LIVE.'],
      timestamp: nowIso
    };
  }

  var headerMeta = _menuLiveGetHeaderMap_(sheet);
  var missingHeaders = MENU_LIVE_HEADERS.filter(function(expected) {
    return !headerMeta.map.hasOwnProperty(expected);
  });

  var expectedLookup = {};
  MENU_LIVE_HEADERS.forEach(function(h) { expectedLookup[h] = true; });
  var extraHeaders = headerMeta.headers.filter(function(h) {
    return !expectedLookup[h];
  });

  if (extraHeaders.length > 0) {
    warnings.push('Se detectaron headers extra en MENU_LIVE: ' + extraHeaders.join(', '));
  }

  return {
    ok: missingHeaders.length === 0,
    missingHeaders: missingHeaders,
    extraHeaders: extraHeaders,
    warnings: warnings,
    timestamp: nowIso
  };
}

function getMenuLive() {
  var nowIso = new Date().toISOString();
  var validation = validateMenuLiveContract();
  var warnings = (validation.warnings || []).slice();

  if (!validation.ok) {
    warnings.push('Contrato MENU_LIVE inválido. Faltan headers requeridos.');
    return {
      ok: false,
      data: { burgers: [], guarniciones: [], extras: [], all: [] },
      warnings: warnings,
      timestamp: nowIso
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MENU_LIVE');
  var headerMeta = _menuLiveGetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      data: { burgers: [], guarniciones: [], extras: [], all: [] },
      warnings: warnings,
      timestamp: nowIso
    };
  }

  var rowCount = lastRow - 1;
  var columnCount = Math.max(sheet.getLastColumn(), headerMeta.width);
  var rawRows = sheet.getRange(2, 1, rowCount, columnCount).getValues();
  var displayRows = sheet.getRange(2, 1, rowCount, columnCount).getDisplayValues();

  var all = [];
  rawRows.forEach(function(rawRow, rowOffset) {
    var rowNum = rowOffset + 2;
    var displayRow = displayRows[rowOffset] || [];
    var item = _menuLiveBuildItem(rawRow, displayRow, headerMeta.map, rowNum, warnings);
    if (item) all.push(item);
  });

  var active = all.filter(function(item) { return item.activo === true; });
  var burgers = active.filter(function(item) { return item.tipo === 'Burger'; });
  var guarniciones = active.filter(function(item) { return item.tipo === 'Guarnicion'; });
  var extras = active.filter(function(item) { return item.tipo === 'Extra'; });

  var sorter = function(a, b) {
    if (a.orden_visual !== b.orden_visual) return a.orden_visual - b.orden_visual;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  };

  burgers.sort(sorter);
  guarniciones.sort(sorter);
  extras.sort(sorter);

  return {
    ok: true,
    data: { burgers: burgers, guarniciones: guarniciones, extras: extras, all: all },
    warnings: warnings,
    timestamp: nowIso
  };
}

function previewMenuLive() {
  var nowIso = new Date().toISOString();
  var parsed = getMenuLive();
  var all = parsed.data && parsed.data.all ? parsed.data.all : [];
  var inactiveCount = all.filter(function(item) { return item.activo !== true; }).length;

  return {
    ok: parsed.ok,
    totalRowsParsed: all.length,
    activeBurgers: parsed.data.burgers.length,
    activeGuarniciones: parsed.data.guarniciones.length,
    activeExtras: parsed.data.extras.length,
    inactiveItems: inactiveCount,
    warnings: parsed.warnings || [],
    timestamp: nowIso
  };
}

function _menuLiveGetHeaderMap_(sheet) {
  var width = Math.max(sheet.getLastColumn(), MENU_LIVE_HEADERS.length);
  var headerRow = sheet.getRange(1, 1, 1, width).getDisplayValues()[0] || [];
  var map = {};
  var headers = [];

  headerRow.forEach(function(value, index) {
    var normalized = String(value || '').trim();
    if (!normalized) return;
    headers.push(normalized);
    if (!map.hasOwnProperty(normalized)) {
      map[normalized] = index;
    }
  });

  return {
    map: map,
    headers: headers,
    width: width
  };
}

function _menuLiveBuildItem(rawRow, displayRow, indexByHeader, rowNum, warnings) {
  var productoId = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.producto_id));
  var tipo = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.tipo));
  var nombre = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.nombre));
  var descripcion = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.descripcion));
  var precioPublico = _menuLiveParseNonNegativeNumber(
    _menuLiveReadRawCell_(rawRow, indexByHeader.precio_publico),
    _menuLiveReadDisplayCell_(displayRow, indexByHeader.precio_publico)
  );
  var activoParsed = _menuLiveParseBooleanLike(_menuLiveReadRawCell_(rawRow, indexByHeader.activo));
  var ordenVisual = _menuLiveParseOrder(_menuLiveReadRawCell_(rawRow, indexByHeader.orden_visual));
  var imagenRaw = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.imagen));
  var origenCostoRef = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.origen_costo_ref));
  var actualizadoEn = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.actualizado_en));
  var actualizadoPor = _menuLiveToTrimmedString(_menuLiveReadCell_(rawRow, displayRow, indexByHeader.actualizado_por));

  var rowErrors = [];
  if (!productoId) rowErrors.push('producto_id requerido');
  if (!nombre) rowErrors.push('nombre requerido');
  if (!MENU_LIVE_ALLOWED_TIPOS[tipo]) rowErrors.push('tipo inválido: ' + tipo);
  if (precioPublico === null) rowErrors.push('precio_publico inválido');
  if (activoParsed === null) rowErrors.push('activo inválido');

  if (rowErrors.length > 0) {
    warnings.push('Fila ' + rowNum + ' ignorada: ' + rowErrors.join('; '));
    return null;
  }

  var imageUrl = '';
  var imageStatus = 'cell_image_or_blank';
  if (imagenRaw && /^https?:\/\//i.test(imagenRaw)) {
    imageUrl = imagenRaw;
    imageStatus = 'string_url';
  } else if (imagenRaw && imagenRaw.indexOf('=IMAGE(') !== 0) {
    imageUrl = imagenRaw;
    imageStatus = 'string_value';
  }

  return {
    producto_id: productoId,
    tipo: tipo,
    nombre: nombre,
    descripcion: descripcion,
    precio_publico: precioPublico,
    activo: activoParsed,
    orden_visual: ordenVisual,
    image_url: imageUrl,
    image_status: imageStatus,
    origen_costo_ref: origenCostoRef,
    actualizado_en: actualizadoEn,
    actualizado_por: actualizadoPor
  };
}

function _menuLiveReadRawCell_(row, index) {
  if (typeof index !== 'number' || index < 0) return null;
  return row[index];
}

function _menuLiveReadDisplayCell_(row, index) {
  if (typeof index !== 'number' || index < 0) return '';
  return row[index];
}

function _menuLiveReadCell_(rawRow, displayRow, index) {
  var rawValue = _menuLiveReadRawCell_(rawRow, index);
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return _menuLiveReadDisplayCell_(displayRow, index);
  }
  return rawValue;
}

function _menuLiveToTrimmedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function _menuLiveParseNonNegativeNumber(rawValue, displayValue) {
  if (typeof rawValue === 'number') {
    if (!isFinite(rawValue) || rawValue < 0) return null;
    return rawValue;
  }

  var fromRaw = _menuLiveParseNumericString_(_menuLiveToTrimmedString(rawValue));
  if (fromRaw !== null) return fromRaw;

  return _menuLiveParseNumericString_(_menuLiveToTrimmedString(displayValue));
}

function _menuLiveParseNumericString_(text) {
  if (!text) return null;
  var sanitized = text.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');
  if (!sanitized) return null;

  var normalized;
  var hasComma = sanitized.indexOf(',') !== -1;
  var hasDot = sanitized.indexOf('.') !== -1;

  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(',') > sanitized.lastIndexOf('.')) {
      normalized = sanitized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = sanitized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = sanitized.replace(',', '.');
  } else {
    normalized = sanitized;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  var parsed = Number(normalized);
  if (!isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function _menuLiveParseBooleanLike(value) {
  if (typeof value === 'boolean') return value;

  var raw = _menuLiveToTrimmedString(value).toLowerCase();
  if (!raw) return null;
  if (raw === 'true' || raw === '1' || raw === 'si' || raw === 'sí') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return null;
}

function _menuLiveParseOrder(value) {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 999;
  }

  var parsed = _menuLiveParseNumericString_(_menuLiveToTrimmedString(value));
  if (parsed === null) return 999;
  return parsed;
}
