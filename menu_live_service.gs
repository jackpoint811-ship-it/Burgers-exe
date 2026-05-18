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

  var lastColumn = Math.max(sheet.getLastColumn(), MENU_LIVE_HEADERS.length);
  var headerRow = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] || [];
  var normalizedHeaders = headerRow.map(function(header) {
    return String(header || '').trim();
  }).filter(function(header) {
    return header !== '';
  });

  var present = {};
  normalizedHeaders.forEach(function(h) { present[h] = true; });

  var missingHeaders = MENU_LIVE_HEADERS.filter(function(expected) {
    return !present[expected];
  });

  var expectedLookup = {};
  MENU_LIVE_HEADERS.forEach(function(h) { expectedLookup[h] = true; });
  var extraHeaders = normalizedHeaders.filter(function(h) {
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
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      data: { burgers: [], guarniciones: [], extras: [], all: [] },
      warnings: warnings,
      timestamp: nowIso
    };
  }

  var headerCount = MENU_LIVE_HEADERS.length;
  var values = sheet.getRange(2, 1, lastRow - 1, headerCount).getDisplayValues();
  var indexByHeader = {};
  MENU_LIVE_HEADERS.forEach(function(h, i) { indexByHeader[h] = i; });

  var all = [];

  values.forEach(function(row, rowOffset) {
    var rowNum = rowOffset + 2;
    var item = _menuLiveBuildItem(row, indexByHeader, rowNum, warnings);
    if (item) {
      all.push(item);
    }
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
    data: {
      burgers: burgers,
      guarniciones: guarniciones,
      extras: extras,
      all: all
    },
    warnings: warnings,
    timestamp: nowIso
  };
}

function previewMenuLive() {
  var nowIso = new Date().toISOString();
  var validation = validateMenuLiveContract();
  var parsed = getMenuLive();
  var all = parsed.data && parsed.data.all ? parsed.data.all : [];

  var inactiveCount = all.filter(function(item) { return item.activo !== true; }).length;

  return {
    ok: validation.ok && parsed.ok,
    totalRowsParsed: all.length,
    activeBurgers: parsed.data.burgers.length,
    activeGuarniciones: parsed.data.guarniciones.length,
    activeExtras: parsed.data.extras.length,
    inactiveItems: inactiveCount,
    warnings: (validation.warnings || []).concat(parsed.warnings || []),
    timestamp: nowIso
  };
}

function _menuLiveBuildItem(row, indexByHeader, rowNum, warnings) {
  var productoId = _menuLiveToTrimmedString(row[indexByHeader.producto_id]);
  var tipo = _menuLiveToTrimmedString(row[indexByHeader.tipo]);
  var nombre = _menuLiveToTrimmedString(row[indexByHeader.nombre]);
  var descripcion = _menuLiveToTrimmedString(row[indexByHeader.descripcion]);
  var precioPublico = _menuLiveParseNonNegativeNumber(row[indexByHeader.precio_publico]);
  var activoParsed = _menuLiveParseBooleanLike(row[indexByHeader.activo]);
  var ordenVisual = _menuLiveParseOrder(row[indexByHeader.orden_visual]);
  var imagenRaw = _menuLiveToTrimmedString(row[indexByHeader.imagen]);
  var origenCostoRef = _menuLiveToTrimmedString(row[indexByHeader.origen_costo_ref]);
  var actualizadoEn = _menuLiveToTrimmedString(row[indexByHeader.actualizado_en]);
  var actualizadoPor = _menuLiveToTrimmedString(row[indexByHeader.actualizado_por]);

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

function _menuLiveToTrimmedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function _menuLiveParseNonNegativeNumber(value) {
  var raw = _menuLiveToTrimmedString(value);
  if (!raw) return null;
  var normalized = raw.replace(/,/g, '.');
  var parsed = Number(normalized);
  if (!isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function _menuLiveParseBooleanLike(value) {
  var raw = _menuLiveToTrimmedString(value).toLowerCase();
  if (!raw) return null;
  if (raw === 'true' || raw === '1' || raw === 'si' || raw === 'sí') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return null;
}

function _menuLiveParseOrder(value) {
  var raw = _menuLiveToTrimmedString(value);
  if (!raw) return 999;
  var parsed = Number(raw);
  if (!isFinite(parsed)) return 999;
  return parsed;
}
