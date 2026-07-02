var BOG_NORMALIZED_READ_PEDIDOS_REQUIRED_HEADERS = ['pedido_id', 'folio', 'canal', 'cliente_nombre', 'cliente_telefono', 'metodo_pago', 'total', 'estado', 'fecha_creacion', 'fecha_actualizacion', 'origen_app', 'estado_pago', 'estado_produccion', 'estado_entrega'];

function getNormalizedAppOrders(filters) {
  var parsedFilters = bogNormalizeReadFilters_(filters);
  var warnings = [];
  var composed = bogReadAndComposeNormalizedOrders_(warnings);

  var filtered = composed.orders.filter(function (order) {
    if (!parsedFilters.includeArchived && ['Cancelado', 'Completado', 'Archivado'].indexOf(order.estado) !== -1) {
      return false;
    }

    if (parsedFilters.estado && bogNormalizeHeaderKey_(order.estado) !== bogNormalizeHeaderKey_(parsedFilters.estado)) {
      return false;
    }

    var createdAt = new Date(order.fecha_creacion);
    if (parsedFilters.fechaDesde && (!createdAt || isNaN(createdAt.getTime()) || createdAt < parsedFilters.fechaDesde)) {
      return false;
    }

    if (parsedFilters.fechaHasta && (!createdAt || isNaN(createdAt.getTime()) || createdAt > parsedFilters.fechaHasta)) {
      return false;
    }

    return true;
  });

  filtered.sort(function (a, b) {
    return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
  });

  return {
    ok: true,
    filtersApplied: {
      estado: parsedFilters.estado,
      fechaDesde: parsedFilters.fechaDesde ? parsedFilters.fechaDesde.toISOString() : '',
      fechaHasta: parsedFilters.fechaHasta ? parsedFilters.fechaHasta.toISOString() : '',
      includeArchived: parsedFilters.includeArchived,
      limit: parsedFilters.limit
    },
    total: filtered.length,
    orders: filtered.slice(0, parsedFilters.limit),
    warnings: warnings,
    timestamp: bogNowIso_()
  };
}

function getNormalizedOrderDetail(pedidoId) {
  var targetId = bogTrim_(pedidoId);
  if (!targetId) {
    return { ok: false, error: { code: 'INVALID_PEDIDO_ID', message: 'pedidoId es requerido.' } };
  }

  var warnings = [];
  var composed = bogReadAndComposeNormalizedOrders_(warnings);
  var order = null;
  for (var i = 0; i < composed.orders.length; i += 1) {
    if (bogTrim_(composed.orders[i].pedido_id) === targetId) {
      order = composed.orders[i];
      break;
    }
  }

  if (!order) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado.' } };
  }

  var events = composed.eventosByPedido[targetId] || [];
  return {
    ok: true,
    pedido: order,
    eventos: events,
    warnings: warnings,
    timestamp: bogNowIso_()
  };
}

function previewNormalizedOrdersRead() {
  var warnings = [];
  var composed = bogReadAndComposeNormalizedOrders_(warnings);
  return {
    ok: true,
    pedidosCount: composed.pedidos.length,
    itemsCount: composed.items.length,
    burgersCount: composed.burgers.length,
    guarnicionesCount: composed.guarniciones.length,
    eventosCount: composed.eventos.length,
    samplePedidoId: composed.orders.length ? composed.orders[0].pedido_id : '',
    warnings: warnings,
    timestamp: bogNowIso_()
  };
}

function bogNormalizeReadFilters_(filters) {
  var parsed = filters && typeof filters === 'object' ? filters : {};
  var limit = Number(parsed.limit);
  if (isNaN(limit) || limit <= 0) {
    limit = 100;
  }

  var fechaDesde = bogParseFilterDate_(parsed.fechaDesde, false);
  var fechaHasta = bogParseFilterDate_(parsed.fechaHasta, true);

  return {
    estado: bogTrim_(parsed.estado),
    fechaDesde: fechaDesde,
    fechaHasta: fechaHasta,
    includeArchived: Boolean(parsed.includeArchived),
    limit: Math.min(Math.floor(limit), 500)
  };
}

function bogParseFilterDate_(value, endOfDay) {
  var raw = bogTrim_(value);
  if (!raw) return null;

  var date = new Date(raw);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function bogReadAndComposeNormalizedOrders_(warnings) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = bogGetNormalizedReadSheetsWithHeaders_(ss);

  var pedidos = bogReadSheetAsObjects_(sheets.pedidos.sheet, BOG_NORMALIZED_READ_PEDIDOS_REQUIRED_HEADERS).rows.map(function (row) { return row.data; });
  var items = bogReadSheetAsObjects_(sheets.items.sheet, BOG_NORMALIZED_HEADERS.PEDIDO_ITEMS).rows.map(function (row) { return row.data; });
  var burgers = bogReadSheetAsObjects_(sheets.burgers.sheet, ['pedido_burger_id', 'pedido_id', 'pedido_item_id', 'burger_base_id', 'extras_json', 'sin_ingredientes_json', 'comentarios']).rows.map(function (row) { return row.data; });
  var guarniciones = bogReadSheetAsObjects_(sheets.guarniciones.sheet, BOG_NORMALIZED_HEADERS.GUARNICIONES).rows.map(function (row) { return row.data; });
  var eventos = bogReadSheetAsObjects_(sheets.eventos.sheet, BOG_NORMALIZED_HEADERS.EVENTOS_PEDIDO).rows.map(function (row) { return row.data; });

  var itemsByPedido = bogGroupByPedidoId_(items);
  var burgersByPedido = bogGroupByPedidoId_(burgers);
  var guarnicionesByPedido = bogGroupByPedidoId_(guarniciones);
  var eventosByPedido = bogGroupByPedidoId_(eventos);

  var orders = pedidos.map(function (pedido) {
    var pedidoId = bogTrim_(pedido.pedido_id);
    var mappedItems = (itemsByPedido[pedidoId] || []).map(bogMapPedidoItem_);
    var mappedBurgers = (burgersByPedido[pedidoId] || []).map(function (row) {
      return bogMapPedidoBurger_(row, warnings);
    });
    var mappedGuarniciones = (guarnicionesByPedido[pedidoId] || []).map(bogMapGuarnicion_);

    return bogComposeNormalizedOrder_(pedido, mappedItems, mappedBurgers, mappedGuarniciones);
  });

  return {
    pedidos: pedidos,
    items: items,
    burgers: burgers,
    guarniciones: guarniciones,
    eventos: eventos,
    orders: orders,
    eventosByPedido: eventosByPedido
  };
}


function bogGetNormalizedReadSheetsWithHeaders_(ss) {
  return {
    pedidos: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.PEDIDOS, BOG_NORMALIZED_READ_PEDIDOS_REQUIRED_HEADERS),
    items: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.PEDIDO_ITEMS, BOG_NORMALIZED_HEADERS.PEDIDO_ITEMS),
    burgers: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.PEDIDO_BURGERS, BOG_PEDIDO_BURGERS_BASE_HEADERS),
    guarniciones: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.GUARNICIONES, BOG_NORMALIZED_HEADERS.GUARNICIONES),
    eventos: bogGetSheetWithHeaderContract_(ss, BOG_NORMALIZED_SHEETS.EVENTOS_PEDIDO, BOG_NORMALIZED_HEADERS.EVENTOS_PEDIDO)
  };
}
function bogComputeProduction_(pedido, burgers, guarniciones) {
  var bt = burgers.length, bp = 0, bpr = 0, bl = 0;
  burgers.forEach(function (b) { var s = bogTrim_(b.estado_burger) || 'Pendiente'; if (s === 'Lista') bl += 1; else if (s === 'Preparando') bpr += 1; else bp += 1; });
  var gt = guarniciones.length, gp = 0, gpr = 0, gh = 0;
  guarniciones.forEach(function (g) { var s = bogTrim_(g.estado_guarnicion) || 'Pendiente'; if (s === 'Hecha') gh += 1; else if (s === 'Preparando') gpr += 1; else gp += 1; });
  var burgersReady = bt > 0 && bl === bt;
  var guaReady = gt === 0 || gh === gt;
  var blockers = []; if (!burgersReady) blockers.push('Burgers pendientes'); if (!guaReady) blockers.push('Guarniciones pendientes');
  var estadoProduccion = bogTrim_(pedido.estado_produccion);
  if (!estadoProduccion) estadoProduccion = bogTrim_(pedido.estado) === 'Listo' ? 'Preparada' : 'Pendiente';
  return { estado_produccion: estadoProduccion, burgers_total: bt, burgers_pendientes: bp, burgers_preparando: bpr, burgers_listas: bl, burgers_ready: burgersReady, guarniciones_total: gt, guarniciones_pendientes: gp, guarniciones_preparando: gpr, guarniciones_hechas: gh, guarniciones_ready: guaReady, production_ready: burgersReady && guaReady, order_ready: burgersReady && guaReady, blockers: blockers };
}

function bogGroupByPedidoId_(rows) {
  var grouped = {};
  rows.forEach(function (row) {
    var pedidoId = bogTrim_(row.pedido_id);
    if (!pedidoId) return;
    if (!grouped[pedidoId]) grouped[pedidoId] = [];
    grouped[pedidoId].push(row);
  });
  return grouped;
}

function bogMapPedidoItem_(row) {
  return {
    pedido_item_id: bogTrim_(row.pedido_item_id),
    pedido_id: bogTrim_(row.pedido_id),
    producto_id: bogTrim_(row.producto_id),
    tipo: bogTrim_(row.tipo),
    nombre: bogTrim_(row.nombre),
    cantidad: Number(row.cantidad) || 0,
    precio_unitario: Number(row.precio_unitario) || 0,
    subtotal: Number(row.subtotal) || 0,
    notas: bogTrim_(row.notas)
  };
}

function bogMapPedidoBurger_(row, warnings) {
  return {
    pedido_burger_id: bogTrim_(row.pedido_burger_id),
    pedido_id: bogTrim_(row.pedido_id),
    pedido_item_id: bogTrim_(row.pedido_item_id),
    burger_base_id: bogTrim_(row.burger_base_id),
    extras: bogSafeParseJsonArray_(row.extras_json, 'extras_json', row.pedido_burger_id, warnings),
    sin_ingredientes: bogSafeParseJsonArray_(row.sin_ingredientes_json, 'sin_ingredientes_json', row.pedido_burger_id, warnings),
    comentarios: bogTrim_(row.comentarios),
    estado_burger: bogTrim_(row.estado_burger) || 'Pendiente',
    responsable: bogTrim_(row.responsable) || '',
    actualizado_en: row.actualizado_en || ''
  };
}

function bogMapGuarnicion_(row) {
  return {
    guarnicion_id: bogTrim_(row.guarnicion_id),
    pedido_id: bogTrim_(row.pedido_id),
    pedido_item_id: bogTrim_(row.pedido_item_id),
    producto_id: bogTrim_(row.producto_id),
    cantidad: Number(row.cantidad) || 0,
    estado_guarnicion: bogTrim_(row.estado_guarnicion),
    responsable: bogTrim_(row.responsable),
    actualizado_en: row.actualizado_en
  };
}

function bogSafeParseJsonArray_(value, fieldName, burgerId, warnings) {
  var raw = bogTrim_(value);
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    warnings.push('JSON inválido en ' + fieldName + ' (' + burgerId + ').');
    return [];
  }
}

function bogComposeNormalizedOrder_(pedido, items, burgers, guarniciones) {
  var itemNameByItemId = bogBuildItemNameByItemId_(items);
  var burgerSummaryMap = {};
  burgers.forEach(function (burger) {
    var key = burger.burger_base_id || 'Burger';
    burgerSummaryMap[key] = (burgerSummaryMap[key] || 0) + 1;
  });

  var burgerSummary = Object.keys(burgerSummaryMap).map(function (name) {
    return burgerSummaryMap[name] + 'x ' + name;
  }).join(', ');

  var guarnicionSummary = guarniciones.length
    ? guarniciones.map(function (g) {
      var preferredName = itemNameByItemId[g.pedido_item_id] || '';
      var displayName = preferredName || g.producto_id;
      return g.cantidad + 'x ' + displayName;
    }).join(', ')
    : 'Sin guarniciones';

  var production = bogComputeProduction_(pedido, burgers, guarniciones);

  var extrasTotal = burgers.reduce(function (acc, burger) {
    return acc + (Array.isArray(burger.extras) ? burger.extras.length : 0);
  }, 0);

  return {
    pedido_id: bogTrim_(pedido.pedido_id),
    folio: bogTrim_(pedido.folio),
    canal: bogTrim_(pedido.canal),
    cliente_nombre: bogTrim_(pedido.cliente_nombre),
    cliente_telefono: bogTrim_(pedido.cliente_telefono),
    metodo_pago: bogTrim_(pedido.metodo_pago),
    total: Number(pedido.total) || 0,
    estado: bogTrim_(pedido.estado),
    fecha_creacion: pedido.fecha_creacion,
    fecha_actualizacion: pedido.fecha_actualizacion,
    origen_app: bogTrim_(pedido.origen_app),
    estado_pago: bogTrim_(pedido.estado_pago) || 'Pendiente',
    nota_interna: bogTrim_(pedido.nota_interna),
    nota_cliente: bogTrim_(pedido.nota_cliente),
    ticket_enviado: bogNormalizeBoolean_(pedido.ticket_enviado),
    ticket_enviado_en: pedido.ticket_enviado_en || '',
    items: items,
    burgers: burgers,
    guarniciones: guarniciones,
    counts: {
      burgers_total: burgers.length,
      guarniciones_total: guarniciones.reduce(function (acc, g) { return acc + g.cantidad; }, 0),
      extras_total: extrasTotal,
      items_total: items.reduce(function (acc, item) { return acc + item.cantidad; }, 0)
    },
    kitchen: {
      status: bogMapKitchenStatus_(pedido.estado),
      burger_summary: burgerSummary || 'Sin burgers',
      guarnicion_summary: guarnicionSummary,
      has_guarniciones: guarniciones.length > 0,
      pending_guarniciones: production.guarniciones_pendientes,
      pending_burgers: production.burgers_pendientes,
      burgers_ready: production.burgers_ready,
      guarniciones_ready: production.guarniciones_ready,
      order_ready: production.order_ready
    },
    production: production,
    payment: { metodo_pago: bogTrim_(pedido.metodo_pago), estado_pago: bogTrim_(pedido.estado_pago) || 'Pendiente', payment_ready: (bogTrim_(pedido.estado_pago) || 'Pendiente') === 'Pagado' },
    delivery: { estado_entrega: bogTrim_(pedido.estado_entrega) || 'Pendiente', delivery_ready: (bogTrim_(pedido.estado_entrega) || 'Pendiente') === 'Entregada' },
    finalization: { finalized: production.production_ready && ((bogTrim_(pedido.estado_pago) || 'Pendiente') === 'Pagado') && ((bogTrim_(pedido.estado_entrega) || 'Pendiente') === 'Entregada'), blockers: [].concat(!production.production_ready ? ['Producción pendiente'] : [], (bogTrim_(pedido.estado_pago) || 'Pendiente') === 'Pagado' ? [] : ['Pago pendiente'], (bogTrim_(pedido.estado_entrega) || 'Pendiente') === 'Entregada' ? [] : ['Entrega pendiente']) }
  };
}

function bogNormalizeBoolean_(value) {
  if (value === true) return true;
  if (value === false) return false;
  var normalized = bogNormalizeHeaderKey_(value);
  return ['true', 'si', 'sí', 'yes', '1'].indexOf(normalized) !== -1;
}

function bogBuildItemNameByItemId_(items) {
  var out = {};
  items.forEach(function (item) {
    var itemId = bogTrim_(item.pedido_item_id);
    if (!itemId) return;
    var name = bogTrim_(item.nombre);
    out[itemId] = name || bogTrim_(item.producto_id);
  });
  return out;
}
function bogMapKitchenStatus_(estado) {
  var normalized = bogNormalizeHeaderKey_(estado);
  if (normalized === 'nuevo') return 'Nuevo';
  if (normalized === 'confirmado') return 'Confirmado';
  if (normalized === 'preparando') return 'Preparando';
  if (normalized === 'listo') return 'Listo';
  return bogTrim_(estado);
}
