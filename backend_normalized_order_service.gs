var BOG_NORMALIZED_SHEETS = {
  PEDIDOS: 'PEDIDOS',
  PEDIDO_ITEMS: 'PEDIDO_ITEMS',
  PEDIDO_BURGERS: 'PEDIDO_BURGERS',
  GUARNICIONES: 'GUARNICIONES',
  EVENTOS_PEDIDO: 'EVENTOS_PEDIDO'
};

var BOG_NORMALIZED_HEADERS = {
  PEDIDOS: ['pedido_id', 'folio', 'canal', 'cliente_nombre', 'cliente_telefono', 'metodo_pago', 'total', 'estado', 'fecha_creacion', 'fecha_actualizacion', 'origen_app', 'estado_pago', 'nota_interna', 'nota_cliente', 'ticket_enviado', 'ticket_enviado_en'],
  PEDIDO_ITEMS: ['pedido_item_id', 'pedido_id', 'producto_id', 'tipo', 'nombre', 'cantidad', 'precio_unitario', 'subtotal', 'notas'],
  PEDIDO_BURGERS: ['pedido_burger_id', 'pedido_id', 'pedido_item_id', 'burger_base_id', 'extras_json', 'sin_ingredientes_json', 'comentarios', 'estado_burger', 'responsable', 'actualizado_en'],
  GUARNICIONES: ['guarnicion_id', 'pedido_id', 'pedido_item_id', 'producto_id', 'cantidad', 'estado_guarnicion', 'responsable', 'actualizado_en'],
  EVENTOS_PEDIDO: ['evento_id', 'pedido_id', 'tipo_evento', 'estado_anterior', 'estado_nuevo', 'detalle', 'usuario', 'timestamp', 'origen_app']
};
var BOG_PEDIDO_BURGERS_BASE_HEADERS = ['pedido_burger_id', 'pedido_id', 'pedido_item_id', 'burger_base_id', 'extras_json', 'sin_ingredientes_json', 'comentarios'];

var BOG_PUBLIC_SKU_FALLBACK_METADATA = {
  OG: { producto_id: 'OG', tipo: 'Burger', nombre: 'Burger OG', precio_publico: 85, activo: true },
  BBQ: { producto_id: 'BBQ', tipo: 'Burger', nombre: 'Burger BBQ', precio_publico: 85, activo: true },
  PAPAS_OG: { producto_id: 'PAPAS_OG', tipo: 'Guarnicion', nombre: 'Guarnicion Papas a la francesa OG', precio_publico: 20, activo: true },
  PAPAS_ESPECIALES: { producto_id: 'PAPAS_ESPECIALES', tipo: 'Guarnicion', nombre: 'Guarnicion Papas a la francesa Especiales', precio_publico: 25, activo: true },
  PAPAS_LEMON_PEPPER: { producto_id: 'PAPAS_LEMON_PEPPER', tipo: 'Guarnicion', nombre: 'Guarnicion Papas a la francesa Lemon&Pepper', precio_publico: 25, activo: true },
  AROS_CEBOLLA: { producto_id: 'AROS_CEBOLLA', tipo: 'Guarnicion', nombre: 'Guarnicion Aros de Cebolla', precio_publico: 30, activo: true },
  EXTRA_PEPINILLOS: { producto_id: 'EXTRA_PEPINILLOS', tipo: 'Extra', nombre: 'Extra Pepinillos', precio_publico: 5, activo: true },
  EXTRA_QUESO_AMERICANO: { producto_id: 'EXTRA_QUESO_AMERICANO', tipo: 'Extra', nombre: 'Extra Queso americano', precio_publico: 5, activo: true },
  EXTRA_QUESO_MANCHEGO: { producto_id: 'EXTRA_QUESO_MANCHEGO', tipo: 'Extra', nombre: 'Extra Queso manchego', precio_publico: 5, activo: true },
  EXTRA_TOCINO: { producto_id: 'EXTRA_TOCINO', tipo: 'Extra', nombre: 'Extra Tocino', precio_publico: 5, activo: true },
  EXTRA_CATSUP: { producto_id: 'EXTRA_CATSUP', tipo: 'Extra', nombre: 'Extra Catsup', precio_publico: 5, activo: true },
  EXTRA_MOSTAZA: { producto_id: 'EXTRA_MOSTAZA', tipo: 'Extra', nombre: 'Extra Mostaza', precio_publico: 5, activo: true },
  EXTRA_TOMATE: { producto_id: 'EXTRA_TOMATE', tipo: 'Extra', nombre: 'Extra Tomate', precio_publico: 5, activo: true }
};

// NOTE: createPublicOrder is invoked via bogPublicWrite_() in Code.gs, which already
// applies script-level write locking. Do not add a nested LockService lock here.
function bogCreateNormalizedPublicOrderFromCloudflare_(requestBody) {
  var payload = requestBody.payload || {};
  bogValidatePublicOrderPayload_(payload);

  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new Error('Items inválidos: agrega al menos un producto.');
  }

  var providedTotal = Number(payload.total);
  if (isNaN(providedTotal) || providedTotal < 0) {
    throw new Error('Total inválido.');
  }

  var normalizedItems = bogBuildNormalizedItemsMap_(payload.items);
  var itemKeys = Object.keys(normalizedItems);
  if (!itemKeys.length) {
    throw new Error('Items inválidos: no hay productos válidos para procesar.');
  }

  var now = new Date();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = bogGetNormalizedSheetsWithHeaders_(ss);

    var pedidoId = bogBuildPedidoId_(now);
    var folio = bogBuildNextFolio_(sheets.pedidos);
    var menuLookupResult = bogBuildMenuLookup_();
    var menuLookup = menuLookupResult.lookup;
    var warnings = [];
    Array.prototype.push.apply(warnings, menuLookupResult.warnings);

    var itemRows = [];
    var burgerRows = [];
    var guarnicionRows = [];
    var burgersBySku = { OG: null, BBQ: null };
    var itemSubtotalSum = 0;
    var itemSeq = 0;
    var burgerSeq = 0;
    var sideSeq = 0;

    itemKeys.forEach(function (sku) {
      itemSeq += 1;
      var qty = Number(normalizedItems[sku]);
      var menuItem = menuLookup[sku] || null;
      var fallbackItem = BOG_PUBLIC_SKU_FALLBACK_METADATA[sku] || null;
      var unitPrice = 0;
      var notas = '';

      var menuPrice = menuItem ? bogParseMenuPrice_(menuItem.precio_publico) : null;
      var fallbackPrice = fallbackItem ? bogParseMenuPrice_(fallbackItem.precio_publico) : null;
      var effectiveItem = menuItem;
      if (menuPrice !== null && menuPrice >= 0) {
        unitPrice = menuPrice;
      } else if (fallbackItem && fallbackPrice !== null && fallbackPrice >= 0) {
        effectiveItem = fallbackItem;
        unitPrice = fallbackPrice;
        warnings.push('SKU usando fallback metadata: ' + sku);
        notas = 'fallback_metadata';
      } else {
        warnings.push('SKU sin metadata usable: ' + sku + '. precio_unitario=0.');
        notas = 'sin_metadata_usable';
      }

      var subtotal = unitPrice * qty;
      itemSubtotalSum += subtotal;

      var itemId = pedidoId + '-ITEM-' + bogPad3_(itemSeq);
      var tipo = (effectiveItem && bogTrim_(effectiveItem.tipo)) || bogInferItemTipoBySku_(sku);
      var nombre = (effectiveItem && bogTrim_(effectiveItem.nombre)) || sku;
      var itemRow = {
        pedido_item_id: itemId,
        pedido_id: pedidoId,
        producto_id: sku,
        tipo: tipo,
        nombre: nombre,
        cantidad: qty,
        precio_unitario: unitPrice,
        subtotal: subtotal,
        notas: notas
      };
      itemRows.push(itemRow);

      if (sku === 'OG' || sku === 'BBQ') {
        burgersBySku[sku] = {
          pedido_item_id: itemId,
          qty: qty
        };
      }

      if (tipo === 'Guarnicion' && qty > 0) {
        sideSeq += 1;
        guarnicionRows.push({
          guarnicion_id: pedidoId + '-SIDE-' + bogPad3_(sideSeq),
          pedido_id: pedidoId,
          pedido_item_id: itemId,
          producto_id: sku,
          cantidad: qty,
          estado_guarnicion: 'Pendiente',
          responsable: '',
          actualizado_en: now
        });
      }
    });

    var burgersFromPersonalization = bogExtractBurgersFromPersonalizations_(payload.personalizations, burgersBySku, warnings);
    ['OG', 'BBQ'].forEach(function (burgerSku) {
      var burgerMeta = burgersBySku[burgerSku];
      if (!burgerMeta || !burgerMeta.qty) return;
      for (var i = 1; i <= burgerMeta.qty; i += 1) {
        var detail = burgersFromPersonalization[burgerSku + '#' + i] || { extras: [], without: [], comments: '' };
        burgerSeq += 1;
        burgerRows.push({
          pedido_burger_id: pedidoId + '-BURGER-' + bogPad3_(burgerSeq),
          pedido_id: pedidoId,
          pedido_item_id: burgerMeta.pedido_item_id,
          burger_base_id: burgerSku,
          extras_json: JSON.stringify(detail.extras || []),
          sin_ingredientes_json: JSON.stringify(detail.without || []),
          comentarios: detail.comments || '',
          estado_burger: 'Pendiente',
          responsable: '',
          actualizado_en: now
        });
      }
    });

    bogAppendRecordByHeaders_(sheets.pedidos.sheet, sheets.pedidos.headers, sheets.pedidos.headerMap, {
      pedido_id: pedidoId,
      folio: folio,
      canal: 'Burgers.exe',
      cliente_nombre: bogTrim_(payload.customerName),
      cliente_telefono: bogTrim_(payload.phone),
      metodo_pago: bogTrim_(payload.paymentMethod),
      total: providedTotal,
      estado: 'Nuevo',
      fecha_creacion: now,
      fecha_actualizacion: now,
      origen_app: 'public-order-cloudflare',
      estado_pago: 'Pendiente',
      nota_interna: '',
      nota_cliente: '',
      ticket_enviado: false,
      ticket_enviado_en: ''
    });

    bogAppendRecordsByHeaders_(sheets.items.sheet, sheets.items.headers, sheets.items.headerMap, itemRows);
    bogAppendRecordsByHeaders_(sheets.burgers.sheet, sheets.burgers.headers, sheets.burgers.headerMap, burgerRows);
    bogAppendRecordsByHeaders_(sheets.guarniciones.sheet, sheets.guarniciones.headers, sheets.guarniciones.headerMap, guarnicionRows);

    var eventRows = [
      {
        evento_id: pedidoId + '-EVT-001',
        pedido_id: pedidoId,
        tipo_evento: 'PEDIDO_CREADO',
        estado_anterior: '',
        estado_nuevo: 'Nuevo',
        detalle: 'source=public-order-cloudflare,total=' + providedTotal + ',items=' + payload.items.length + (warnings.length ? ',warnings=' + warnings.join(' | ') : ''),
        usuario: 'public-order-cloudflare',
        timestamp: now,
        origen_app: 'public-order-cloudflare'
      }
    ];

    if (Math.abs(itemSubtotalSum - providedTotal) > 0.009) {
      eventRows.push({
        evento_id: pedidoId + '-EVT-002',
        pedido_id: pedidoId,
        tipo_evento: 'TOTAL_METADATA_MISMATCH',
        estado_anterior: '',
        estado_nuevo: 'Nuevo',
        detalle: 'payload_total=' + providedTotal + ',metadata_subtotal=' + itemSubtotalSum,
        usuario: 'public-order-cloudflare',
        timestamp: now,
        origen_app: 'public-order-cloudflare'
      });
    }

    bogAppendRecordsByHeaders_(sheets.eventos.sheet, sheets.eventos.headers, sheets.eventos.headerMap, eventRows);

  return {
    accepted: true,
    mode: 'write',
    pedido_id: pedidoId,
    folio: folio,
    total: providedTotal,
    itemCount: payload.items.length,
    normalizedWrite: true
  };
}

function bogGetNormalizedSheetsWithHeaders_(ss) {
  return {
    pedidos: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.PEDIDOS, BOG_NORMALIZED_HEADERS.PEDIDOS),
    items: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.PEDIDO_ITEMS, BOG_NORMALIZED_HEADERS.PEDIDO_ITEMS),
    burgers: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.PEDIDO_BURGERS, BOG_NORMALIZED_HEADERS.PEDIDO_BURGERS),
    guarniciones: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.GUARNICIONES, BOG_NORMALIZED_HEADERS.GUARNICIONES),
    eventos: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.EVENTOS_PEDIDO, BOG_NORMALIZED_HEADERS.EVENTOS_PEDIDO)
  };
}

function bogGetSheetWithHeaderContract_(ss, sheetName, requiredHeaders) {
  var sheet = bogGetRequiredSheet_(ss, sheetName);
  var data = bogReadSheetAsObjects_(sheet, requiredHeaders);
  return { sheet: sheet, headers: data.headers, headerMap: data.headerMap };
}

function bogBuildPedidoId_(now) {
  var timezone = Session.getScriptTimeZone() || 'Etc/UTC';
  var ymd = Utilities.formatDate(now, timezone, 'yyyyMMdd');
  var hms = Utilities.formatDate(now, timezone, 'HHmmss');
  var suffix = Math.floor(Math.random() * 10000);
  return 'BOG-' + ymd + '-' + hms + '-' + ('000' + suffix).slice(-4);
}

function bogBuildNextFolio_(pedidosSheetMeta) {
  var sheet = pedidosSheetMeta.sheet;
  var headerMap = pedidosSheetMeta.headerMap;
  var folioIndex = headerMap[bogNormalizeHeaderKey_('folio')];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'BOG-001';

  var values = sheet.getRange(2, folioIndex + 1, lastRow - 1, 1).getDisplayValues();
  var maxNum = 0;
  values.forEach(function (row) {
    var raw = bogTrim_(row[0]);
    var m = /^BOG-(\d+)$/.exec(raw);
    if (!m) return;
    var n = Number(m[1]);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  return 'BOG-' + bogPad3_(maxNum + 1);
}

function bogPad3_(value) {
  return ('00' + String(value)).slice(-3);
}

function bogBuildMenuLookup_() {
  var warnings = [];
  var lookup = {};
  try {
    var menu = getMenuLive();
    if (!menu || menu.ok !== true) {
      warnings.push('MENU_LIVE respondió sin ok=true.');
    }
    var items = menu && menu.data && Array.isArray(menu.data.all) ? menu.data.all : [];
    if (!items.length) {
      warnings.push('MENU_LIVE sin data.all utilizable.');
    }
    items.forEach(function (item) {
      var key = bogTrim_(item && item.producto_id);
      if (key) lookup[key] = bogNormalizeMenuItem_(item);
    });
  } catch (err) {
    warnings.push('MENU_LIVE unavailable: ' + (err && err.message ? err.message : String(err)));
  }
  return { lookup: lookup, warnings: warnings };
}

function bogNormalizeMenuItem_(item) {
  return {
    producto_id: bogTrim_(item && item.producto_id),
    tipo: bogTrim_(item && item.tipo),
    nombre: bogTrim_(item && item.nombre),
    precio_publico: item ? item.precio_publico : null,
    activo: item ? item.activo : null
  };
}

function bogParseMenuPrice_(value) {
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  var normalized = bogTrim_(value).replace(/[^\d,.\-]/g, '');
  if (!normalized) return null;
  if (normalized.indexOf(',') >= 0 && normalized.indexOf('.') >= 0) {
    normalized = normalized.replace(/,/g, '');
  } else if (normalized.indexOf(',') >= 0) {
    normalized = normalized.replace(/,/g, '.');
  }
  var parsed = Number(normalized);
  return isNaN(parsed) ? null : parsed;
}

function previewNormalizedOrderMenuLookup() {
  var menuLookupResult = bogBuildMenuLookup_();
  var lookup = menuLookupResult.lookup || {};
  return {
    ok: true,
    menuLiveOk: menuLookupResult.warnings.length === 0,
    menuLiveCount: Object.keys(lookup).length,
    lookupKeys: Object.keys(lookup),
    fallbackKeys: Object.keys(BOG_PUBLIC_SKU_FALLBACK_METADATA),
    warnings: menuLookupResult.warnings,
    sample: { OG: lookup.OG || BOG_PUBLIC_SKU_FALLBACK_METADATA.OG || null },
    timestamp: new Date().toISOString()
  };
}

function bogInferItemTipoBySku_(sku) {
  if (/^EXTRA_/i.test(sku)) return 'Extra';
  if (/^(PAPAS_|AROS_)/i.test(sku)) return 'Guarnicion';
  if (sku === 'OG' || sku === 'BBQ') return 'Burger';
  return 'Producto';
}

function bogExtractBurgersFromPersonalizations_(rawPersonalizations, burgersBySku, warnings) {
  var map = {};
  if (!rawPersonalizations || typeof rawPersonalizations !== 'object') return map;
  var burgers = rawPersonalizations.burgers;
  if (burgers === undefined || burgers === null) return map;
  if (!Array.isArray(burgers)) {
    throw new Error('Personalización inválida: burgers debe ser array.');
  }

  burgers.forEach(function (entry) {
    var sku = bogTrim_(entry && entry.sku);
    if (sku !== 'OG' && sku !== 'BBQ') {
      throw new Error('Personalización con SKU inválido: ' + sku);
    }
    var max = burgersBySku[sku] ? Number(burgersBySku[sku].qty || 0) : 0;
    var burgerIndex = Number(entry && entry.burgerIndex);
    if (isNaN(burgerIndex) || Math.floor(burgerIndex) !== burgerIndex || burgerIndex <= 0 || burgerIndex > max) {
      throw new Error('Personalización fuera de rango para ' + sku + ': burgerIndex ' + burgerIndex + '.');
    }
    var without = Array.isArray(entry.without) ? entry.without : [];
    var extras = Array.isArray(entry.extras) ? entry.extras : [];
    var comments = bogTrim_(entry.comments || entry.comment || '');

    var cleanedWithout = without.map(function (v) { return bogTrim_(v); }).filter(Boolean);
    var cleanedExtras = extras.map(function (v) { return bogTrim_(v); }).filter(Boolean);
    map[sku + '#' + burgerIndex] = { extras: cleanedExtras, without: cleanedWithout, comments: comments };
  });

  Object.keys(burgersBySku).forEach(function (sku) {
    if (!burgersBySku[sku] || !burgersBySku[sku].qty) return;
    for (var i = 1; i <= burgersBySku[sku].qty; i += 1) {
      if (!map[sku + '#' + i]) {
        warnings.push('Falta personalización para ' + sku + '#' + i + '; se guarda default.');
      }
    }
  });

  return map;
}

function bogAppendRecordByHeaders_(sheet, headers, headerMap, record) {
  var row = bogBuildRowByHeaderMap_(headers, headerMap, record);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}

function bogAppendRecordsByHeaders_(sheet, headers, headerMap, records) {
  if (!records || !records.length) return;
  var rows = records.map(function (record) {
    return bogBuildRowByHeaderMap_(headers, headerMap, record);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}
