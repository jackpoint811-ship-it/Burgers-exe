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

  return bogCreateNormalizedPublicOrderFromCloudflare_(requestBody);
}

function bogValidatePublicOrderPayload_(payload) {
  var required = ['customerName', 'phone', 'location', 'paymentMethod'];
  required.forEach(function (field) {
    if (!bogTrim_(payload[field])) {
      throw new Error('Campo requerido faltante: ' + field);
    }
  });

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
    var qty = Number(item && item.qty);
    if (isNaN(qty) || qty <= 0 || Math.floor(qty) !== qty) {
      throw new Error('Cantidad inválida para SKU: ' + sku);
    }
    map[sku] = (map[sku] || 0) + qty;
  });
  return map;
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
    'Sin Pepinillos': true,
    'Sin Salsa bbq': true
  }
};

var BOG_PUBLIC_ORDER_EXTRAS_ALLOWED = {
  'Pepinillos': 'EXTRA_PEPINILLOS',
  'Queso americano': 'EXTRA_QUESO_AMERICANO',
  'Queso manchego': 'EXTRA_QUESO_MANCHEGO',
  'Tocino': 'EXTRA_TOCINO',
  'Catsup': 'EXTRA_CATSUP',
  'Mostaza': 'EXTRA_MOSTAZA',
  'Tomate': 'EXTRA_TOMATE'
};

function bogBuildPublicOrderPersonalizationsSummary_(rawPersonalizations, normalizedItems) {
  var burgers = rawPersonalizations && Array.isArray(rawPersonalizations.burgers) ? rawPersonalizations.burgers : [];
  var skuLimits = {
    OG: Number(normalizedItems.OG || 0),
    BBQ: Number(normalizedItems.BBQ || 0)
  };

  var lines = { OG: [], BBQ: [] };
  var extrasBySkuFromPersonalizations = {};

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
    if (entry && Object.prototype.hasOwnProperty.call(entry, 'extras') && !Array.isArray(entry.extras)) {
      throw new Error('Personalización inválida: extras debe ser array.');
    }
    var extras = Array.isArray(entry && entry.extras) ? entry.extras : [];
    var cleanedExtras = extras.map(function (label) { return bogTrim_(label); }).filter(Boolean);
    cleanedExtras.forEach(function (label) {
      if (BurgerOGConstants.SPECIAL_FLAGS_REGEX.test(label)) {
        throw new Error('Personalización inválida: contiene texto restringido.');
      }
      if (!Object.prototype.hasOwnProperty.call(BOG_PUBLIC_ORDER_EXTRAS_ALLOWED, label)) {
        throw new Error('Extra inválido para ' + sku + ': ' + label);
      }
      var extraSku = BOG_PUBLIC_ORDER_EXTRAS_ALLOWED[label];
      extrasBySkuFromPersonalizations[extraSku] = (extrasBySkuFromPersonalizations[extraSku] || 0) + 1;
    });

    var withoutText = cleanedWithout.length ? ('Quitar: ' + cleanedWithout.join(', ')) : 'Con todo';
    var extrasText = cleanedExtras.length ? cleanedExtras.map(function (label) { return label + ' +$5'; }).join(', ') : 'Sin extras';
    lines[sku].push({
      idx: burgerIndex,
      text: sku + ' #' + burgerIndex + ': ' + withoutText + ' | Extras: ' + extrasText
    });
  });

  Object.keys(BOG_PUBLIC_ORDER_EXTRAS_ALLOWED).forEach(function (extraName) {
    var extraSku = BOG_PUBLIC_ORDER_EXTRAS_ALLOWED[extraName];
    var fromPersonalizations = Number(extrasBySkuFromPersonalizations[extraSku] || 0);
    var fromItems = Number(normalizedItems[extraSku] || 0);
    if (fromPersonalizations !== fromItems) {
      throw new Error('Extras por burger no coinciden con items globales.');
    }
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
