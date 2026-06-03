(function () {
  // ---------------------------------------------------------------------------
  // Constants and static catalog
  // ---------------------------------------------------------------------------
  var STORAGE_KEY = 'bog_public_order_draft_v3';
  var LEGACY_KEY = 'bog_public_order_draft_v2';
  var STEPS = ['MENU', 'BURGERS', 'CUSTOM', 'EXTRAS', 'GUARNICIONES', 'DATOS', 'RESUMEN'];

  var FALLBACK_MENU = {
    burgers: [
      { sku: 'OG', name: 'OG', price: 85, description: 'Carne "Especial" 250g aprox, tocino, queso americano, queso manchego, jitomate, lechuga, pepinillos, catsup, mostaza y mayonesa.' },
      { sku: 'BBQ', name: 'BBQ', price: 85, description: 'Carne "Especial" 250g aprox, tocino, queso americano, queso manchego, aros de cebolla, pepinillos y salsa BBQ.' }
    ],
    sides: [
      { sku: 'PAPAS_OG', name: 'Papas a la francesa OG', price: 20, description: 'papas clásicas, sal y crunch.' },
      { sku: 'PAPAS_ESPECIALES', name: 'Papas a la francesa Especiales', price: 25, description: 'papas con sazón especial de la casa.' },
      { sku: 'PAPAS_LEMON_PEPPER', name: 'Papas a la francesa Lemon&Pepper', price: 25, description: 'papas con toque cítrico y pimienta.' },
      { sku: 'AROS_CEBOLLA', name: 'Aros de Cebolla', price: 30, description: 'aros crujientes estilo burger joint.' }
    ],
    extras: [
      { sku: 'EXTRA_PEPINILLOS', name: 'Pepinillos', price: 5, description: 'toque ácido/crunch.' },
      { sku: 'EXTRA_QUESO_AMERICANO', name: 'Queso americano', price: 5, description: 'extra cremoso clásico.' },
      { sku: 'EXTRA_QUESO_MANCHEGO', name: 'Queso manchego', price: 5, description: 'extra fundido intenso.' },
      { sku: 'EXTRA_TOCINO', name: 'Tocino', price: 5, description: 'crunch ahumado.' },
      { sku: 'EXTRA_CATSUP', name: 'Catsup', price: 5, description: 'dulce clásica.' },
      { sku: 'EXTRA_MOSTAZA', name: 'Mostaza', price: 5, description: 'punch ácido.' },
      { sku: 'EXTRA_TOMATE', name: 'Tomate', price: 5, description: 'frescura extra.' }
    ]
  };



  var MENU = { burgers: [], sides: [], extras: [] };
  var menuSource = 'd1';
  var menuWarnings = [];
  var menuLoadStatus = 'loading';
  var menuLoadError = '';
  var campaignConfig = null;
  var campaignLoadStatus = 'idle';
  var WITHOUT = {
    OG: ['Sin Tocino', 'Sin Queso americano', 'Sin Queso manchego', 'Sin Jitomate', 'Sin Lechuga', 'Sin Pepinillos', 'Sin Catsup', 'Sin Mostaza', 'Sin Mayonesa'],
    BBQ: ['Sin Tocino', 'Sin Queso americano', 'Sin Queso manchego', 'Sin Aros de cebolla', 'Sin Pepinillos', 'Sin Salsa bbq']
  };

  var SKU_ICONS = {
    OG: './assets/icon-burger-og.png', BBQ: './assets/icon-burger-bbq.png', PAPAS_OG: './assets/icon-fries-og.png',
    PAPAS_ESPECIALES: './assets/icon-fries-special.png', PAPAS_LEMON_PEPPER: './assets/icon-fries-lemon-pepper.png',
    AROS_CEBOLLA: './assets/icon-onion-rings.png', EXTRA_PEPINILLOS: './assets/icon-extra-pickles.png',
    EXTRA_QUESO_AMERICANO: './assets/icon-extra-american-cheese.png', EXTRA_QUESO_MANCHEGO: './assets/icon-extra-manchego.png',
    EXTRA_TOCINO: './assets/icon-extra-bacon.png', EXTRA_CATSUP: './assets/icon-extra-ketchup.png',
    EXTRA_MOSTAZA: './assets/icon-extra-mustard.png', EXTRA_TOMATE: './assets/icon-extra-tomato.png'
  };

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------
  function createInitialState() {
    return {
      step: 0,
      burgerUnits: [],
      sidesQty: {},
      customer: { customerName: '', phone: '', location: '', paymentMethod: 'Pago mismo dia', note: '', referralCode: '' },
      ts: Date.now()
    };
  }

  var state = createInitialState();
  var dataStepErrors = {};
  var clearConfirmUntil = 0;
  var isSubmitting = false;

  var DEFAULT_ORDER_GATE_CONFIG = {
    closed: false,
    title: 'PEDIDOS CERRADOS POR AHORA',
    message: 'Por el momento no estamos recibiendo pedidos. Únete al grupo de WhatsApp para enterarte cuando abramos pedidos otra vez.',
    whatsappUrl: 'https://chat.whatsapp.com/GycE5zALOypGPvJVaMfbPp'
  };

  var orderGateConfig = {
    closed: DEFAULT_ORDER_GATE_CONFIG.closed,
    title: DEFAULT_ORDER_GATE_CONFIG.title,
    message: DEFAULT_ORDER_GATE_CONFIG.message,
    whatsappUrl: DEFAULT_ORDER_GATE_CONFIG.whatsappUrl
  };

  function getCurrentStepName() { return STEPS[state.step]; }
  function countBurgers() { return state.burgerUnits.length; }

  function getBurgerCounts() {
    var counts = {};
    MENU.burgers.forEach(function (b) { counts[b.sku] = 0; });
    state.burgerUnits.forEach(function (u) {
      if (counts[u.sku] != null) counts[u.sku] += 1;
    });
    return counts;
  }

  function syncUnits(counts) {
    var units = [];
    var activeSkus = MENU.burgers.map(function (b) { return b.sku; });
    activeSkus.forEach(function (sku) {
      for (var i = 1; i <= (counts[sku] || 0); i += 1) {
        var id = sku + '-' + i;
        var old = state.burgerUnits.find(function (u) { return u.id === id; });
        units.push(normalizeBurgerUnit(old || { id: id, sku: sku, label: sku + ' #' + i, without: [], extras: {} }));
      }
    });
    state.burgerUnits = units;
  }

  // ---------------------------------------------------------------------------
  // Generic helpers
  // ---------------------------------------------------------------------------

  function normalizeReferralCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  }

  function readReferralCodeFromUrl() {
    try {
      return normalizeReferralCode(new URLSearchParams(window.location.search).get('ref'));
    } catch (_error) {
      return '';
    }
  }

  function ensureCustomerReferralField() {
    state.customer = state.customer || {};
    state.customer.referralCode = normalizeReferralCode(state.customer.referralCode || '');
  }

  function applyUrlReferralCode() {
    var referralCode = readReferralCodeFromUrl();
    if (!referralCode) return;
    state.customer = state.customer || {};
    state.customer.referralCode = referralCode;
  }

  function normalizeExtrasQty(raw) {
    var out = {};
    if (Array.isArray(raw)) {
      raw.forEach(function (entry) {
        var item = MENU.extras.find(function (x) { return x.name === entry || x.sku === entry; });
        var sku = item ? item.sku : String(entry || '').trim();
        if (sku) out[sku] = (out[sku] || 0) + 1;
      });
      return out;
    }
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(function (sku) {
        var qty = Math.max(0, Math.floor(Number(raw[sku] || 0)));
        if (sku && qty > 0) out[sku] = qty;
      });
    }
    return out;
  }

  function normalizeBurgerUnit(unit) {
    var next = unit || {};
    return {
      id: String(next.id || next.sku || 'burger'),
      sku: String(next.sku || ''),
      label: String(next.label || next.sku || 'Burger'),
      without: Array.isArray(next.without) ? next.without.slice() : [],
      extras: normalizeExtrasQty(next.extras)
    };
  }

  function toPrice(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeApiMenuResponse(data) {
    if (!data || data.ok !== true) return null;
    var source = data.data || data;

    function normalizeItem(item) {
      if (!item || !(item.menu_item_id || item.sku || item.producto_id) || !(item.name || item.nombre)) return null;
      var priceCents = Number(item.price_cents != null ? item.price_cents : Math.round(toPrice(item.price != null ? item.price : item.precio_publico, 0) * 100));
      var sku = String(item.menu_item_id || item.sku || item.producto_id);
      return {
        menu_item_id: sku,
        sku: sku,
        item_type: String(item.item_type || item.tipo || ''),
        name: String(item.name || item.nombre),
        price_cents: Number.isFinite(priceCents) ? priceCents : 0,
        price: (Number.isFinite(priceCents) ? priceCents : 0) / 100,
        description: String(item.description || item.descripcion || ''),
        image_url: item.image_url ? String(item.image_url) : '',
        image_key: item.image_key ? String(item.image_key) : ''
      };
    }

    var burgers = (Array.isArray(source.burgers) ? source.burgers : []).map(normalizeItem).filter(Boolean);
    var sidesSource = Array.isArray(source.sides) ? source.sides : source.guarniciones;
    var sides = (Array.isArray(sidesSource) ? sidesSource : []).map(normalizeItem).filter(Boolean);
    var extras = (Array.isArray(source.extras) ? source.extras : []).map(normalizeItem).filter(Boolean);

    return { burgers: burgers, sides: sides, extras: extras };
  }

  function fetchPublicMenu() {
    var timeoutMs = 3000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = window.setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);

    return (async function () {
      try {
        var response = await fetch('/api/menu', controller ? { signal: controller.signal } : undefined);
        if (!response.ok) throw new Error('menu status ' + response.status);
        var payload = await response.json();
        var normalized = normalizeApiMenuResponse(payload);
        if (!normalized || !normalized.burgers.length) throw new Error('invalid menu payload');

        MENU = normalized;
        menuSource = String((payload && payload.source) || 'unknown');
        menuWarnings = Array.isArray(payload && payload.warnings) ? payload.warnings.slice() : [];
      } catch (error) {
        MENU = { burgers: [], sides: [], extras: [] };
        menuSource = 'd1-error';
        menuLoadStatus = 'error';
        menuLoadError = String((error && error.message) || 'No se pudo cargar el menú.');
        menuWarnings = [menuLoadError];
      } finally {
        if (MENU.burgers.length || MENU.sides.length || MENU.extras.length) {
          menuLoadStatus = 'ready';
          menuLoadError = '';
        } else if (menuLoadStatus !== 'error') {
          menuLoadStatus = 'empty';
          menuLoadError = 'El menú está vacío en D1.';
        }
        window.clearTimeout(timeoutId);
      }
      return MENU;
    })();
  }


  function normalizeCampaignConfig(payload) {
    var source = payload && payload.data ? payload.data : payload;
    if (!source || source.enabled !== true || source.ticketsPageEnabled !== true) return null;
    return {
      enabled: true,
      name: String(source.name || 'Sorteo activo').trim() || 'Sorteo activo',
      ticketsPageEnabled: true,
      ticketsPageUrl: String(source.ticketsPageUrl || '/tickets').trim() || '/tickets',
      menuCtaLabel: String(source.menuCtaLabel || '🎟️ Consulta tus tickets').trim() || '🎟️ Consulta tus tickets'
    };
  }

  function fetchCampaignConfig() {
    campaignLoadStatus = 'loading';
    return (async function () {
      try {
        var response = await fetch('/api/campaign-config');
        if (!response.ok) throw new Error('campaign status ' + response.status);
        var payload = await response.json();
        if (!payload || payload.ok !== true) throw new Error('invalid campaign payload');
        campaignConfig = normalizeCampaignConfig(payload);
        campaignLoadStatus = 'ready';
      } catch (_error) {
        campaignConfig = null;
        campaignLoadStatus = 'error';
      }
      return campaignConfig;
    })();
  }

  function renderCampaignMenuCard() {
    if (campaignLoadStatus !== 'ready' || !campaignConfig || campaignConfig.enabled !== true || campaignConfig.ticketsPageEnabled !== true) return '';
    var url = campaignConfig.ticketsPageUrl || '/tickets';
    return '<section class="campaign-menu-card" aria-labelledby="campaignMenuTitle">' +
      '<p class="campaign-menu-eyebrow">' + escapeHtml(campaignConfig.menuCtaLabel || '🎟️ Consulta tus tickets') + '</p>' +
      '<h3 id="campaignMenuTitle">🎟️ Sorteo activo</h3>' +
      '<p>Consulta tus tickets, copia tu código de referido y compártelo para sumar más oportunidades.</p>' +
      '<a class="campaign-menu-cta" href="' + escapeHtml(url) + '">Consultar mis tickets</a>' +
    '</section>';
  }

  function extraBySkuOrName(value) { return MENU.extras.find(function (x) { return x.sku === value || x.name === value; }); }
  function extraPriceByName(name) {
    var found = extraBySkuOrName(name);
    return found ? toPrice(found.price, 0) : 0;
  }
  function priceCents(item) { return Number(item && item.price_cents != null ? item.price_cents : Math.round(toPrice(item && item.price, 0) * 100)); }
  function getExtraQty(unit, sku) { return Number((unit.extras || {})[sku] || 0); }
  function extrasQtyLabel(unit) {
    var labels = [];
    MENU.extras.forEach(function (x) {
      var qty = getExtraQty(unit, x.sku);
      if (qty > 0) labels.push(qty + ' ' + x.name);
    });
    return labels.join(', ') || 'Sin extras';
  }
  function extrasLineTotal(unit) {
    return MENU.extras.reduce(function (sum, x) { return sum + getExtraQty(unit, x.sku) * x.price; }, 0);
  }

  function bySku(list, sku) { return list.find(function (x) { return x.sku === sku; }); }
  function money(v) { return '$' + Number(v || 0).toFixed(2); }
  function burgerPrice(sku) { var item = bySku(MENU.burgers, sku); return item ? toPrice(item.price, 0) : 0; }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function getScrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
  }

  function pulseClass(node, className, durationMs) {
    if (!node) return;
    node.classList.remove(className);
    window.requestAnimationFrame(function () {
      node.classList.add(className);
      window.setTimeout(function () {
        node.classList.remove(className);
      }, durationMs);
    });
  }

  function setStatus(message) {
    var statusNode = document.getElementById('status');
    statusNode.textContent = message || '';
  }

  function hideSuccessPanel() {
    var panel = document.getElementById('successPanel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }

  function showSuccessPanel(data) {
    var panel = document.getElementById('successPanel');
    if (!panel) return;
    var total = Number((data && data.data && data.data.total) || calcTotal());
    var itemCount = Number((data && data.data && data.data.upstream && data.data.upstream.itemCount) || calcOrderItemCount());

    panel.innerHTML =
      '<h2>PEDIDO RECIBIDO ✅</h2>' +
      '<p>Tu pedido ya entró al sistema.</p>' +
      '<div class="success-metrics" aria-label="Resumen de confirmación">' +
      '<p><strong>Total:</strong> ' + money(total) + '</p>' +
      '<p><strong>Items:</strong> ' + itemCount + '</p>' +
      '</div>' +
      '<p class="muted">Te contactaremos para confirmar detalles si hace falta.</p>' +
      '<button id="backToMenuBtn" class="success-secondary-cta" type="button">Volver al menú</button>';
    panel.classList.remove('hidden');
    panel.setAttribute('tabindex', '-1');
    panel.focus({ preventScroll: true });
  }

  function goBackToMenuAfterSuccess() {
    hideSuccessPanel();
    isSubmitting = false;
    setSubmitLoading(false);
    state.step = 0;
    redraw();
    setStatus('Listo. Volviste al menú.');
    scrollToCurrentStep();
    focusStepContext(getCurrentStepName());
  }

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------
  function saveDraft() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null');
    } catch (_e) {
      return null;
    }
  }

  // Keep backward compatibility for legacy structures.
  function restoreDraft(draft) {
    if (!draft) return;

    if (draft.burgerUnits && draft.customer) {
      state = draft;
      state.burgerUnits = (state.burgerUnits || []).map(normalizeBurgerUnit);
      state.sidesQty = state.sidesQty || {};
      ensureCustomerReferralField();
      return;
    }

    if (draft.payload) {
      var counts = {};
      MENU.burgers.forEach(function (b) { counts[b.sku] = 0; });
      (draft.payload.items || []).forEach(function (it) {
        if (counts[it.sku] != null) counts[it.sku] = it.qty;
      });
      syncUnits(counts);
      state.customer = {
        customerName: draft.payload.customerName || '',
        phone: draft.payload.phone || '',
        location: draft.payload.location || '',
        paymentMethod: draft.payload.paymentMethod || 'Pago mismo dia',
        note: draft.payload.note || '',
        referralCode: normalizeReferralCode(draft.payload.referral && draft.payload.referral.code)
      };
      state.step = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Payload + validation helpers
  // ---------------------------------------------------------------------------
  function calcTotal() {
    var total = 0;
    state.burgerUnits.forEach(function (u) {
      total += burgerPrice(u.sku) + extrasLineTotal(u);
    });
    MENU.sides.forEach(function (s) { total += (state.sidesQty[s.sku] || 0) * s.price; });
    return total;
  }

  function calcOrderItemCount() {
    var extraItems = 0;
    var sideItems = 0;
    state.burgerUnits.forEach(function (u) { Object.keys(u.extras || {}).forEach(function (sku) { extraItems += Number(u.extras[sku] || 0); }); });
    MENU.sides.forEach(function (s) { sideItems += Number(state.sidesQty[s.sku] || 0); });
    return countBurgers() + extraItems + sideItems;
  }

  function hasDraftContent() {
    return calcOrderItemCount() > 0 || Boolean(state.customer.customerName.trim() || state.customer.phone.trim() || state.customer.location || state.customer.note.trim() || state.customer.referralCode);
  }

  function buildPayload() {
    var lineMap = {};

    function addLine(item, quantity) {
      var qty = Math.max(0, Math.floor(Number(quantity || 0)));
      if (!item || !item.sku || qty <= 0) return;
      if (!lineMap[item.sku]) {
        lineMap[item.sku] = {
          menu_item_id: item.sku,
          item_type: item.item_type || '',
          quantity: 0,
          unit_price_cents: priceCents(item)
        };
      }
      lineMap[item.sku].quantity += qty;
    }

    state.burgerUnits.forEach(function (u) {
      addLine(bySku(MENU.burgers, u.sku), 1);
      MENU.extras.forEach(function (x) { addLine(x, getExtraQty(u, x.sku)); });
    });

    MENU.sides.forEach(function (s) { addLine(s, state.sidesQty[s.sku] || 0); });

    var orderItems = Object.keys(lineMap).map(function (sku) { return lineMap[sku]; });

    return {
      customerName: state.customer.customerName.trim(),
      phone: state.customer.phone.trim(),
      location: state.customer.location,
      paymentMethod: state.customer.paymentMethod,
      note: state.customer.note.trim(),
      order_items: orderItems,
      items: orderItems.map(function (line) { return { sku: line.menu_item_id, qty: line.quantity }; }),
      referral: {
        code: state.customer.referralCode || '',
        source: 'url'
      },
      personalizations: {
        burgers: state.burgerUnits.map(function (u, i) {
          return {
            sku: u.sku,
            burgerIndex: Number(u.id.split('-')[1] || (i + 1)),
            without: (u.without || []).slice(),
            extras: MENU.extras.reduce(function (acc, x) {
              var qty = getExtraQty(u, x.sku);
              for (var n = 0; n < qty; n += 1) acc.push(x.name);
              return acc;
            }, []),
            extras_qty: Object.assign({}, u.extras)
          };
        })
      },
      timestamp: new Date().toISOString()
    };
  }

  function phoneDigits(value) {
    return String(value || '').replace(/\D/g, '').length;
  }

  function getDataStepErrors() {
    var errors = {};
    if (!state.customer.customerName.trim()) errors.name = 'Nombre requerido.';
    if (!state.customer.phone.trim()) {
      errors.phone = 'Teléfono requerido.';
    } else if (phoneDigits(state.customer.phone) < 10) {
      errors.phone = 'Teléfono debe tener al menos 10 dígitos.';
    }
    if (!state.customer.location) errors.location = 'Selecciona ubicación.';
    if (!state.customer.paymentMethod) errors.pay = 'Selecciona forma de pago.';
    return errors;
  }

  function validate(stepOnly) {
    if (!countBurgers() && state.step >= 1 && stepOnly !== 'submit') return 'Agrega al menos 1 burger.';
    if (state.step === 5 || stepOnly === 'submit') {
      var dataErrors = getDataStepErrors();
      if (Object.keys(dataErrors).length) return 'Completa datos requeridos.';
    }
    if (stepOnly === 'submit' && !buildPayload().items.length) return 'Pedido vacío.';
    return '';
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function renderStepper() {
    var currentStepName = STEPS[state.step];
    var progressText = 'Paso ' + (state.step + 1) + ' de ' + STEPS.length;
    var progressPercent = Math.round(((state.step + 1) / STEPS.length) * 100);
    var chips = STEPS.map(function (stepName, i) {
      var classes = 'step ' + (i === state.step ? 'active' : i < state.step ? 'done' : '');
      var disabled = i > state.step ? 'disabled' : '';
      var ariaCurrent = i === state.step ? 'aria-current="step"' : '';
      var stateLabel = i === state.step ? 'actual' : (i < state.step ? 'completado' : 'pendiente');
      var actionLabel = i > state.step ? 'No disponible aún' : 'Ir al paso';
      var ariaLabel = 'aria-label="' + actionLabel + ' ' + (i + 1) + ': ' + stepName + '. Estado: ' + stateLabel + '."';
      return '<button type="button" class="' + classes + '" data-step-index="' + i + '" ' + disabled + ' ' + ariaCurrent + ' ' + ariaLabel + '>' + stepName + '</button>';
    }).join('');
    document.getElementById('stepper').innerHTML =
      '<div class="stepper-status" aria-live="polite">' +
        '<strong class="stepper-current">' + currentStepName + '</strong>' +
        '<span class="step-progress">' + progressText + '</span>' +
      '</div>' +
      '<div class="stepper-track" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + (state.step + 1) + '" aria-label="' + progressText + '">' +
        '<span class="stepper-track-fill" style="width:' + progressPercent + '%;"></span>' +
      '</div>' +
      '<div class="stepper-chips">' + chips + '</div>';
  }

  function renderMenuCards(items, qtyObj) {
    return items.map(function (x) {
      var qty = qtyObj ? Number(qtyObj[x.sku] || 0) : 0;
      var selectedClass = qty > 0 ? ' is-selected' : '';
      var imageSrc = x.image_url ? escapeHtml(x.image_url) : (SKU_ICONS[x.sku] || '');
      var icon = imageSrc ? '<img class="menu-icon" src="' + imageSrc + '" alt="Icono de ' + escapeHtml(x.name) + '" loading="lazy">' : '';
      var qtyBadge = qtyObj && qty > 0 ? '<span class="menu-badge" aria-hidden="true">x' + qty + '</span>' : '';
      var qtyControls = '';

      if (qtyObj) {
        qtyControls = '<div class="qty">' +
          '<button class="qty-btn qty-btn-minus" data-op="minus" data-sku="' + x.sku + '" aria-label="Quitar ' + escapeHtml(x.name) + '" ' + (qty === 0 ? 'disabled' : '') + '>-</button>' +
          '<span class="qty-count" aria-live="polite">' + qty + '</span>' +
          '<button class="qty-btn qty-btn-plus" data-op="plus" data-sku="' + x.sku + '" aria-label="Agregar ' + escapeHtml(x.name) + '">+</button>' +
        '</div>' ;
      }

      return '<article class="menu-item' + selectedClass + '" data-sku-card="' + x.sku + '" data-selected="' + (qty > 0 ? 'true' : 'false') + '">' +
        '<div class="menu-item-head">' + icon + qtyBadge + '</div>' +
        '<h3>' + escapeHtml(x.name) + '</h3>' +
        '<p class="menu-price">' + money(x.price) + '</p>' +
        '<small class="menu-description">' + escapeHtml(x.description) + '</small>' +
        qtyControls +
        '</article>';
    }).join('');
  }

  function renderMenuStep() {
    if (menuLoadStatus === 'loading') return '<h2>MENÚ</h2><div class="menu-state menu-state-loading" role="status" aria-live="polite"><strong>Cargando menú desde D1...</strong><p>Preparando burgers, guarniciones y extras.</p></div>';
    if (menuLoadStatus === 'error') return '<h2>MENÚ</h2><div class="menu-state menu-state-error" role="alert"><strong>No se pudo cargar el menú.</strong><p>' + escapeHtml(menuLoadError || 'D1 no respondió.') + '</p><button type="button" class="secondary" id="retryMenuBtn">Reintentar</button></div>';
    if (!MENU.burgers.length && !MENU.sides.length && !MENU.extras.length) return '<h2>MENÚ</h2><div class="menu-state menu-state-empty"><strong>Menú vacío.</strong><p>Aplica el seed de MENU_LIVE en D1 para publicar productos.</p></div>';
    var d1Hint = '<p class="muted">Menú cargado desde D1' + (menuSource ? ' · ' + escapeHtml(menuSource) : '') + '</p>';
    return '<h2>MENÚ</h2>' + d1Hint + renderCampaignMenuCard() + '<h3>Burgers</h3><div class="menu-grid">' + renderMenuCards(MENU.burgers) + '</div>' +
      '<h3>Guarniciones</h3><div class="menu-grid">' + renderMenuCards(MENU.sides) + '</div>' +
      '<h3>Extras</h3><div class="menu-grid">' + renderMenuCards(MENU.extras) + '</div>' +
      '<button id="startBtn" class="primary"' + (!MENU.burgers.length ? ' disabled' : '') + '>INICIAR PEDIDO</button>';
  }

  function renderBurgersStep() {
    return '<h2>BURGERS</h2><div class="menu-grid">' + renderMenuCards(MENU.burgers, getBurgerCounts()) + '</div>';
  }

  function renderCustomStep() {
    if (!state.burgerUnits.length) return '<h2>CUSTOM</h2><p class="muted">No hay burgers.</p>';
    return '<h2>CUSTOM</h2>' + state.burgerUnits.map(function (u, i) {
      var removedSummary = (u.without || []).map(function (opt) { return opt.replace(/^Sin\s+/i, ''); }).join(', ') || 'Sin cambios';
      return '<div class="custom-card custom-card-edit" data-unit-card="' + escapeHtml(u.id) + '">' +
        '<p class="custom-context">Personalizando: ' + escapeHtml(u.label) + '</p>' +
        '<h4>Quitar ingredientes</h4>' +
        '<p class="custom-help">Activa lo que NO quieres en tu burger.</p>' +
        '<p class="custom-summary">Quitaste: ' + escapeHtml(removedSummary) + '</p>' +
        '<div class="choice-list">' + ((WITHOUT[u.sku] || []).map(function (opt) {
          var isChecked = u.without.indexOf(opt) >= 0;
          return '<label class="choice-row choice-row-without" data-choice-row="without">' +
            '<input class="choice-input" type="checkbox" data-kind="without" data-i="' + i + '" value="' + opt + '" ' + (isChecked ? 'checked' : '') + '>' +
            '<span class="choice-main">' +
              '<span class="choice-text">' + escapeHtml(opt) + '</span>' +
              '<span class="choice-state">' + (isChecked ? 'Quitado' : 'Disponible') + '</span>' +
            '</span>' +
          '</label>';
        }).join('')) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderExtrasStep() {
    if (!state.burgerUnits.length) return '<h2>EXTRAS</h2><p class="muted">No hay burgers.</p>';
    if (!MENU.extras.length) return '<h2>EXTRAS</h2><p class="muted">No hay extras activos en D1.</p>';
    return '<h2>EXTRAS</h2>' + state.burgerUnits.map(function (u, i) {
      return '<div class="custom-card custom-card-edit" data-unit-card="' + escapeHtml(u.id) + '">' +
        '<p class="custom-context">Extras para: ' + escapeHtml(u.label) + '</p>' +
        '<h4>Agrega cantidades independientes</h4>' +
        '<p class="custom-help">Puedes agregar más de una porción del mismo extra.</p>' +
        '<p class="custom-summary">Extras: ' + escapeHtml(extrasQtyLabel(u)) + '</p>' +
        '<div class="menu-grid compact-grid">' + MENU.extras.map(function (x) {
          var qty = getExtraQty(u, x.sku);
          return '<article class="menu-item' + (qty > 0 ? ' is-selected' : '') + '" data-sku-card="extra-' + i + '-' + x.sku + '">' +
            '<h3>' + escapeHtml(x.name) + '</h3>' +
            '<p class="menu-price">+' + money(x.price) + '</p>' +
            '<small class="menu-description">' + escapeHtml(x.description) + '</small>' +
            '<div class="qty">' +
              '<button class="qty-btn qty-btn-minus" data-op="minus" data-extra-sku="' + x.sku + '" data-unit-index="' + i + '" aria-label="Quitar ' + escapeHtml(x.name) + '" ' + (qty === 0 ? 'disabled' : '') + '>-</button>' +
              '<span class="qty-count" aria-live="polite">' + qty + '</span>' +
              '<button class="qty-btn qty-btn-plus" data-op="plus" data-extra-sku="' + x.sku + '" data-unit-index="' + i + '" aria-label="Agregar ' + escapeHtml(x.name) + '">+</button>' +
            '</div>' +
          '</article>';
        }).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  function renderSidesStep() {
    if (!MENU.sides.length) return '<h2>GUARNICIONES</h2><p class="muted">No hay guarniciones activas en D1.</p>';
    return '<h2>GUARNICIONES</h2><p class="muted">Agrega varias guarniciones con cantidades independientes.</p><div class="menu-grid">' + renderMenuCards(MENU.sides, state.sidesQty) + '</div>';
  }

  function renderDataStep() {
    var nameError = dataStepErrors.name ? '<p class="field-error" id="name-error">' + dataStepErrors.name + '</p>' : '';
    var phoneError = dataStepErrors.phone ? '<p class="field-error" id="phone-error">' + dataStepErrors.phone + '</p>' : '';
    var locationError = dataStepErrors.location ? '<p class="field-error" id="location-error">' + dataStepErrors.location + '</p>' : '';
    var payError = dataStepErrors.pay ? '<p class="field-error" id="pay-error">' + dataStepErrors.pay + '</p>' : '';
    var paySameDaySelected = state.customer.paymentMethod === 'Pago mismo dia';
    var payBeforeSelected = state.customer.paymentMethod === 'Pagar Antes';

    var referralNotice = state.customer.referralCode ? '<p class="referral-notice">Código de referido detectado: <strong>' + escapeHtml(state.customer.referralCode) + '</strong></p>' : '';

    return '<h2>DATOS</h2>' +
      '<p class="data-step-title">Datos para confirmar tu pedido</p>' +
      referralNotice +
      '<p class="data-step-help">No necesitas iniciar sesión. Solo usamos estos datos para entregar y confirmar.</p>' +
      '<label class="field data-field ' + (dataStepErrors.name ? 'has-error' : '') + '" for="name"><span class="field-title">Nombre</span><span class="field-required-badge">Obligatorio</span><input id="name" autocomplete="name" placeholder="Ej. Jack R." aria-describedby="name-help' + (dataStepErrors.name ? ' name-error' : '') + '" aria-invalid="' + (dataStepErrors.name ? 'true' : 'false') + '" value="' + escapeHtml(state.customer.customerName) + '"><span class="field-help" id="name-help">Como aparece en recepción o con quien entregamos.</span></label>' +
      nameError +
      '<label class="field data-field ' + (dataStepErrors.phone ? 'has-error' : '') + '" for="phone"><span class="field-title">Teléfono</span><span class="field-required-badge">Obligatorio</span><input id="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10 dígitos" aria-describedby="phone-help' + (dataStepErrors.phone ? ' phone-error' : '') + '" aria-invalid="' + (dataStepErrors.phone ? 'true' : 'false') + '" value="' + escapeHtml(state.customer.phone) + '"><span class="field-help" id="phone-help">Usamos este número para confirmar y coordinar la entrega.</span></label>' +
      phoneError +
      '<label class="field data-field ' + (dataStepErrors.location ? 'has-error' : '') + '" for="location"><span class="field-title">Ubicación</span><span class="field-required-badge">Obligatorio</span><select id="location" aria-describedby="location-help' + (dataStepErrors.location ? ' location-error' : '') + '" aria-invalid="' + (dataStepErrors.location ? 'true' : 'false') + '"><option value="">Selecciona</option><option ' + (state.customer.location === 'Torre GGA' ? 'selected' : '') + '>Torre GGA</option><option ' + (state.customer.location === 'Torre Valcob' ? 'selected' : '') + '>Torre Valcob</option></select><span class="field-help" id="location-help">Selecciona dónde entregamos tu pedido.</span></label>' +
      locationError +
      '<fieldset id="paymentMethodGroup" class="pay-group ' + (dataStepErrors.pay ? 'has-error' : '') + '" aria-describedby="pay-help' + (dataStepErrors.pay ? ' pay-error' : '') + '" aria-invalid="' + (dataStepErrors.pay ? 'true' : 'false') + '">' +
      '<legend><span class="field-title">Forma de pago</span><span class="field-required-badge">Obligatorio</span></legend>' +
      '<p class="field-help" id="pay-help">Elige cómo quieres liquidar tu pedido.</p>' +
      '<div class="pay-options">' +
      '<label class="pay-option-card ' + (paySameDaySelected ? 'is-selected' : '') + '">' +
      '<input class="pay-option-input" type="radio" name="pay" value="Pago mismo dia" ' + (paySameDaySelected ? 'checked' : '') + '>' +
      '<span class="pay-option-main"><span class="pay-option-title">Pago mismo día</span><span class="pay-option-desc">Efectivo o transferencia el día de entrega.</span></span>' +
      '<span class="pay-option-state">' + (paySameDaySelected ? 'Seleccionado' : 'No seleccionado') + '</span>' +
      '</label>' +
      '<label class="pay-option-card ' + (payBeforeSelected ? 'is-selected' : '') + '">' +
      '<input class="pay-option-input" type="radio" name="pay" value="Pagar Antes" ' + (payBeforeSelected ? 'checked' : '') + '>' +
      '<span class="pay-option-main"><span class="pay-option-title">Pagar antes</span><span class="pay-option-desc">Te mostramos los datos bancarios en el resumen.</span></span>' +
      '<span class="pay-option-state">' + (payBeforeSelected ? 'Seleccionado' : 'No seleccionado') + '</span>' +
      '</label>' +
      '</div></fieldset>' +
      payError +
      '<label class="field data-field" for="note"><span class="field-title">Notas para entrega o preparación</span><span class="field-optional-badge">Opcional</span><textarea id="note" aria-describedby="note-help" placeholder="Ej. Estoy en lobby / sin cambios extra / entregar en recepción">' + escapeHtml(state.customer.note) + '</textarea><span class="field-help" id="note-help">Puedes dejar indicaciones de acceso o referencia.</span></label>';
  }

  function renderSummaryStep() {
    var lines = state.burgerUnits.map(function (u) {
      var ex = MENU.extras.map(function (x) { var qty = getExtraQty(u, x.sku); return qty ? escapeHtml(x.name) + ' x' + qty + ' +' + money(qty * x.price) : ''; }).filter(Boolean).join(', ') || 'Sin extras';
      return '<div class="ticket-line"><strong>' + escapeHtml(u.label) + ' — ' + money(burgerPrice(u.sku)) + '</strong><p>Quitar: ' + escapeHtml((u.without || []).join(', ') || 'Sin cambios') + '</p><p>Extras: ' + ex + '</p><p>Subtotal burger: ' + money(burgerPrice(u.sku) + extrasLineTotal(u)) + '</p></div>';
    }).join('');

    var sides = MENU.sides.map(function (s) {
      var qty = state.sidesQty[s.sku] || 0;
      return qty ? '<div class="summary-row"><span>' + escapeHtml(s.name) + ' x' + qty + '</span><strong>' + money(qty * s.price) + '</strong></div>' : '';
    }).join('') || '<p class="muted">Sin guarniciones</p>';

    return '<h2>RESUMEN</h2>' +
      '<p class="summary-intro">Revisa tu pedido antes de enviarlo.</p>' +
      '<p class="summary-intro muted">Puedes regresar para editar cualquier paso.</p>' +
      '<section class="summary-section"><div class="summary-head"><h3>Burgers, custom y extras</h3><button type="button" class="summary-edit-btn" data-edit-step="1" aria-label="Editar burgers, personalizaciones y extras">Editar</button></div>' + (lines || '<p class="muted">Sin burgers.</p>') + '</section>' +
      '<section class="summary-section"><div class="summary-head"><h3>Guarniciones</h3><button type="button" class="summary-edit-btn" data-edit-step="4" aria-label="Editar guarniciones">Editar</button></div>' + sides + '</section>' +
      '<section class="summary-section"><div class="summary-head"><h3>Datos del cliente</h3><button type="button" class="summary-edit-btn" data-edit-step="5" aria-label="Editar datos del cliente">Editar</button></div>' +
      '<p>Nombre: ' + escapeHtml(state.customer.customerName || '(pendiente)') + '</p>' +
      '<p>Teléfono: ' + escapeHtml(state.customer.phone || '(pendiente)') + '</p>' +
      '<p>Ubicación: ' + escapeHtml(state.customer.location || '(pendiente)') + '</p>' +
      '<p>Nota: ' + escapeHtml(state.customer.note || '(sin nota)') + '</p>' +
      (state.customer.referralCode ? '<p class="referral-notice">Código de referido detectado: <strong>' + escapeHtml(state.customer.referralCode) + '</strong></p>' : '') + '</section>' +
      '<section class="summary-section"><h3>Pago</h3><p>Forma de pago: ' + escapeHtml(state.customer.paymentMethod) + '</p><div id="paymentInfo"></div></section>' +
      '<section class="summary-section summary-total"><h3>Total del pedido</h3><p>' + money(calcTotal()) + '</p></section>' +
      (isSubmitting
        ? '<button id="submitBtn" class="primary" disabled aria-busy="true"><span class="submit-spinner" aria-hidden="true"></span><span>Loading order...</span></button>'
        : '<button id="submitBtn" class="primary">Enviar pedido</button>');
  }

  function setSubmitLoading(isLoading) {
    var button = document.getElementById('submitBtn');
    if (!button) return;
    button.disabled = Boolean(isLoading);
    button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    button.innerHTML = isLoading
      ? '<span class="submit-spinner" aria-hidden="true"></span><span>Loading order...</span>'
      : '<span>Enviar pedido</span>';
  }

  function setSubmitSuccess() {
    var button = document.getElementById('submitBtn');
    if (!button) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'false');
    button.classList.add('submit-success');
    button.innerHTML = '<span>PEDIDO RECIBIDO ✅</span>';
  }

  function renderMiniSummary() {
    var node = document.getElementById('miniSummary');
    if (!node) return;
    var items = calcOrderItemCount();
    node.classList.remove('mini-summary-updated');
    if (!items) {
      node.textContent = 'Pedido vacío';
      return;
    }
    var firstBurger = state.burgerUnits[0];
    if (firstBurger) {
      var firstBurgerCount = state.burgerUnits.filter(function (u) { return u.sku === firstBurger.sku; }).length;
      node.textContent = firstBurger.sku + ' x' + firstBurgerCount + ' · ' + items + ' items · ' + money(calcTotal());
    } else {
      node.textContent = items + ' items · ' + money(calcTotal());
    }
    window.requestAnimationFrame(function () {
      node.classList.add('mini-summary-updated');
    });
  }

  function renderCurrentStep() {
    var container = document.getElementById('stepContent');
    var stepName = getCurrentStepName();
    var renderByStep = {
      MENU: renderMenuStep,
      BURGERS: renderBurgersStep,
      CUSTOM: renderCustomStep,
      EXTRAS: renderExtrasStep,
      GUARNICIONES: renderSidesStep,
      DATOS: renderDataStep,
      RESUMEN: renderSummaryStep
    };
    var renderFn = renderByStep[stepName];

    container.classList.remove('step-enter');
    container.innerHTML = renderFn ? renderFn() : '';

    if (stepName === 'RESUMEN') renderPaymentInfo();

    toggleNav();
    window.requestAnimationFrame(function () {
      container.classList.add('step-enter');
    });
  }

  function focusStepContext(stepName) {
    var panel = document.getElementById('successPanel');
    if (panel && !panel.classList.contains('hidden')) return;
    if (stepName === 'DATOS' && Object.keys(dataStepErrors).length) return;

    var stepRoot = document.getElementById('stepContent');
    if (!stepRoot) return;
    var heading = stepRoot.querySelector('h2');
    var target = heading || stepRoot;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function toggleNav() {
    document.getElementById('backBtn').disabled = state.step === 0;
    document.getElementById('nextBtn').style.display = state.step >= STEPS.length - 1 ? 'none' : 'inline-flex';
  }

  async function renderPaymentInfo() {
    var node = document.getElementById('paymentInfo');
    if (!node) return;

    if (state.customer.paymentMethod === 'Pago mismo dia') {
      node.innerHTML = '<div class="payment-card"><p class="payment-note">Pagas el día de entrega: efectivo o transferencia.</p></div>';
      return;
    }

    node.textContent = 'Cargando /api/bank-config...';
    try {
      var response = await fetch('/api/bank-config');
      var data = await response.json();
      if (data.ok && data.data && data.data.enabled) {
        var paymentDetails = [
          { key: 'bank', label: 'Banco', value: data.data.bankName || '', ariaLabel: 'Copiar banco' },
          { key: 'holder', label: 'Titular', value: data.data.accountHolder || '', ariaLabel: 'Copiar titular' },
          { key: 'account', label: 'Cuenta / CLABE', value: data.data.accountNumber || '', ariaLabel: 'Copiar cuenta' }
        ];
        node.innerHTML = '<div class="payment-card">' + paymentDetails.map(function (detail) {
          return '<div class="payment-detail">' +
            '<p class="payment-label">' + escapeHtml(detail.label) + '</p>' +
            '<p class="payment-value">' + escapeHtml(detail.value || 'Pendiente') + '</p>' +
            '<button type="button" class="copy-btn" data-copy-value="' + escapeHtml(detail.value) + '" data-copy-key="' + escapeHtml(detail.key) + '" aria-label="' + escapeHtml(detail.ariaLabel) + '"' + (detail.value ? '' : ' disabled') + '>Copiar</button>' +
          '</div>';
        }).join('') + '</div>';
        return;
      }
      node.textContent = 'Datos bancarios pendientes de conectar';
    } catch (_e) {
      node.textContent = 'Datos bancarios pendientes de conectar';
    }
  }


  function normalizeOrderGateConfig(raw) {
    var source = raw || {};
    var closed = source.closed === true;
    var title = String(source.title || '').trim() || DEFAULT_ORDER_GATE_CONFIG.title;
    var message = String(source.message || '').trim() || DEFAULT_ORDER_GATE_CONFIG.message;
    var whatsappUrl = String(source.whatsappUrl || '').trim() || DEFAULT_ORDER_GATE_CONFIG.whatsappUrl;
    return {
      closed: closed,
      title: title,
      message: message,
      whatsappUrl: whatsappUrl
    };
  }

  function isOrderingClosed() {
    return Boolean(orderGateConfig && orderGateConfig.closed);
  }

  function renderOrderingGate() {
    var appRoot = document.querySelector('.app');
    if (!appRoot) return;

    var existing = document.getElementById('orderingGate');
    if (existing) existing.remove();

    if (!isOrderingClosed()) {
      appRoot.setAttribute('aria-hidden', 'false');
      return;
    }

    appRoot.setAttribute('aria-hidden', 'true');

    var overlay = document.createElement('div');
    overlay.id = 'orderingGate';
    overlay.className = 'ordering-gate-overlay';
    overlay.innerHTML =
      '<section class="ordering-gate-modal" role="dialog" aria-modal="true" aria-labelledby="orderingGateTitle" aria-describedby="orderingGateMessage">' +
      '<h2 id="orderingGateTitle">' + escapeHtml(orderGateConfig.title) + '</h2>' +
      '<p id="orderingGateMessage">' + escapeHtml(orderGateConfig.message) + '</p>' +
      '<a class="ordering-gate-link" href="' + escapeHtml(orderGateConfig.whatsappUrl) + '" target="_blank" rel="noopener noreferrer">Unirme al grupo de WhatsApp</a>' +
      '</section>';
    document.body.appendChild(overlay);

    var link = overlay.querySelector('.ordering-gate-link');
    if (link) link.focus({ preventScroll: true });
  }

  function fetchOrderGateConfig(onLateResolve) {
    var timeoutMs = 3000;
    var timeoutHit = false;

    return new Promise(function (resolve) {
      var timeoutId = window.setTimeout(function () {
        timeoutHit = true;
        resolve(normalizeOrderGateConfig(DEFAULT_ORDER_GATE_CONFIG));
      }, timeoutMs);

      (async function () {
        try {
          var response = await fetch('/api/order-gate');
          if (!response.ok) return normalizeOrderGateConfig(DEFAULT_ORDER_GATE_CONFIG);
          var data = await response.json();
          if (!data || data.ok !== true) return normalizeOrderGateConfig(DEFAULT_ORDER_GATE_CONFIG);
          return normalizeOrderGateConfig(data);
        } catch (_error) {
          return normalizeOrderGateConfig(DEFAULT_ORDER_GATE_CONFIG);
        }
      })().then(function (config) {
        if (!timeoutHit) {
          window.clearTimeout(timeoutId);
          resolve(config);
          return;
        }
        if (typeof onLateResolve === 'function') onLateResolve(config);
      });
    });
  }

  function fallbackCopyText(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.select();
    helper.setSelectionRange(0, helper.value.length);
    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (_e) {
      copied = false;
    }
    document.body.removeChild(helper);
    return copied;
  }

  async function copyPaymentDetail(button) {
    if (!button) return;
    var value = button.getAttribute('data-copy-value') || '';
    if (!value) return;

    var copied = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch (_e) {
        copied = fallbackCopyText(value);
      }
    } else {
      copied = fallbackCopyText(value);
    }

    var originalLabel = button.getAttribute('data-copy-original') || button.textContent;
    button.setAttribute('data-copy-original', originalLabel);
    button.textContent = copied ? 'Copiado' : 'Copiar';

    if (copied) setStatus('Dato copiado.');

    window.setTimeout(function () {
      button.textContent = originalLabel;
    }, 1400);
  }

  function redraw() {
    renderStepper();
    renderCurrentStep();
    renderMiniSummary();
    saveDraft();
  }

  function redrawAndFocusCurrentStep() {
    redraw();
    scrollToCurrentStep();
    focusStepContext(getCurrentStepName());
  }

  function moveStep(targetStep) {
    var nextStep = Math.max(0, Math.min(STEPS.length - 1, targetStep));
    if (nextStep > state.step) return;
    state.step = nextStep;
    redrawAndFocusCurrentStep();
  }

  function scrollToCurrentStep() {
    var scrollTarget = document.getElementById('stepContent');
    if (!scrollTarget) return;
    scrollTarget.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function onStepContentClick(e) {
    var button = e.target.closest('button');
    if (!button) return;

    if (button.classList.contains('copy-btn')) {
      copyPaymentDetail(button);
      return;
    }

    if (button.id === 'retryMenuBtn') {
      menuLoadStatus = 'loading';
      redraw();
      fetchPublicMenu().then(redraw).catch(redraw);
      return;
    }

    if (button.id === 'startBtn') {
      state.step = 1;
      redrawAndFocusCurrentStep();
      return;
    }

    if (button.id === 'submitBtn') {
      if (isSubmitting) return;
      submit();
      return;
    }
    if (button.classList.contains('summary-edit-btn')) {
      moveStep(Number(button.getAttribute('data-edit-step')));
      setStatus('Editando paso anterior.');
      return;
    }

    var op = button.getAttribute('data-op');
    var extraSku = button.getAttribute('data-extra-sku');
    if (extraSku) {
      var unitIndex = Number(button.getAttribute('data-unit-index'));
      var unit = state.burgerUnits[unitIndex];
      if (!unit) return;
      unit.extras = unit.extras || {};
      unit.extras[extraSku] = Math.max(0, Number(unit.extras[extraSku] || 0) + (op === 'plus' ? 1 : -1));
      if (unit.extras[extraSku] <= 0) delete unit.extras[extraSku];
      redraw();
      var extraCard = document.querySelector('[data-sku-card="extra-' + unitIndex + '-' + extraSku + '"]');
      if (extraCard) pulseClass(extraCard, 'menu-item-pulse', 160);
      return;
    }

    var sku = button.getAttribute('data-sku');
    if (!sku) return;

    if ((op === 'minus' || op === 'plus') && button.disabled) return;
    var stepName = getCurrentStepName();
    var changedSku = sku;

    if (stepName === 'BURGERS') {
      var counts = getBurgerCounts();
      counts[sku] = Math.max(0, (counts[sku] || 0) + (op === 'plus' ? 1 : -1));
      syncUnits(counts);
    } else if (stepName === 'GUARNICIONES') {
      state.sidesQty[sku] = Math.max(0, Number(state.sidesQty[sku] || 0) + (op === 'plus' ? 1 : -1));
    }

    redraw();

    var card = document.querySelector('[data-sku-card="' + changedSku + '"]');
    if (card) {
      pulseClass(card, 'menu-item-pulse', 160);
    }
  }

  function onStepContentChange(e) {
    var target = e.target;
    var index = Number(target.getAttribute('data-i'));
    var optionChanged = false;

    if (target.getAttribute('data-kind') === 'without') {
      var without = state.burgerUnits[index].without;
      var withoutPos = without.indexOf(target.value);
      if (target.checked && withoutPos < 0) without.push(target.value);
      if (!target.checked && withoutPos >= 0) without.splice(withoutPos, 1);
      optionChanged = true;
    }

    if (target.getAttribute('data-kind') === 'extra') {
      var extras = state.burgerUnits[index].extras || {};
      var extraItem = extraBySkuOrName(target.value);
      var extraSku = extraItem ? extraItem.sku : target.value;
      if (target.checked) extras[extraSku] = Math.max(1, Number(extras[extraSku] || 0));
      if (!target.checked) delete extras[extraSku];
      state.burgerUnits[index].extras = extras;
      optionChanged = true;
    }

    if (target.name === 'pay') {
      state.customer.paymentMethod = target.value;
      syncPayCardStates();
    }
    if (target.id === 'location') state.customer.location = target.value;

    if (optionChanged) {
      var choiceRow = target.closest('.choice-row');
      var choiceState = choiceRow ? choiceRow.querySelector('.choice-state') : null;
      var customCard = target.closest('.custom-card-edit');
      var summaryNode = customCard ? customCard.querySelector('.custom-summary') : null;
      var unit = state.burgerUnits[index] || { without: [], extras: [] };
      var isWithout = target.getAttribute('data-kind') === 'without';
      var withoutSummary = (unit.without || []).map(function (opt) { return opt.replace(/^Sin\s+/i, ''); }).join(', ') || 'Sin cambios';
      var extrasSummary = extrasQtyLabel(unit);

      if (choiceState) {
        if (isWithout) {
          choiceState.textContent = target.checked ? 'Quitado' : 'Disponible';
        } else {
          choiceState.textContent = target.checked ? 'Agregado' : 'No agregado';
        }
      }

      if (summaryNode) {
        summaryNode.textContent = isWithout ? ('Quitaste: ' + withoutSummary) : ('Extras: ' + extrasSummary);
      }
    }

    renderMiniSummary();
    if (state.step === 5) refreshDataErrorsIfNeeded();
    saveDraft();

    if (optionChanged) {
      var choiceRow = target.closest('.choice-row');
      var customCard = target.closest('.custom-card-edit');
      [choiceRow, customCard].forEach(function (node) {
        if (!node) return;
        pulseClass(node, 'option-pulse', 160);
      });
    }
  }

  function syncPayCardStates() {
    var cards = document.querySelectorAll('.pay-option-card');
    cards.forEach(function (card) {
      var input = card.querySelector('input[type="radio"][name="pay"]');
      var stateNode = card.querySelector('.pay-option-state');
      var isChecked = Boolean(input && input.checked);
      card.classList.toggle('is-selected', isChecked);
      if (stateNode) stateNode.textContent = isChecked ? 'Seleccionado' : 'No seleccionado';
    });
  }



  function sameErrorMap(a, b) {
    var aKeys = Object.keys(a || {});
    var bKeys = Object.keys(b || {});
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(function (key) { return a[key] === b[key]; });
  }

  function updateDataErrorField(fieldId, errorMessage) {
    var field = document.getElementById(fieldId);
    var errorId = fieldId + '-error';
    var errorNode = document.getElementById(errorId);
    var label = field ? field.closest('label') : null;

    if (label) label.classList.toggle('has-error', Boolean(errorMessage));
    if (field) {
      field.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');
      var describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      describedBy = describedBy.filter(function (id) { return id !== errorId; });
      if (errorMessage) describedBy.push(errorId);
      if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
      else field.removeAttribute('aria-describedby');
    }

    if (errorMessage) {
      if (!errorNode && label && label.parentNode) {
        errorNode = document.createElement('p');
        errorNode.className = 'field-error';
        errorNode.id = errorId;
        label.parentNode.insertBefore(errorNode, label.nextSibling);
      }
      if (errorNode) errorNode.textContent = errorMessage;
    } else if (errorNode) {
      errorNode.remove();
    }
  }

  function updatePayError(errorMessage) {
    var group = document.querySelector('.pay-group');
    if (!group) return;

    group.classList.toggle('has-error', Boolean(errorMessage));
    var errorNode = document.getElementById('pay-error');

    if (errorMessage) {
      if (!errorNode && group.parentNode) {
        errorNode = document.createElement('p');
        errorNode.className = 'field-error';
        errorNode.id = 'pay-error';
        group.parentNode.insertBefore(errorNode, group.nextSibling);
      }
      if (errorNode) errorNode.textContent = errorMessage;
    } else if (errorNode) {
      errorNode.remove();
    }
    group.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');
  }

  function updateDataErrorsUI() {
    updateDataErrorField('name', dataStepErrors.name);
    updateDataErrorField('phone', dataStepErrors.phone);
    updateDataErrorField('location', dataStepErrors.location);
    updatePayError(dataStepErrors.pay);
  }

  function focusFirstDataError() {
    var order = [
      { key: 'name', selector: '#name' },
      { key: 'phone', selector: '#phone' },
      { key: 'location', selector: '#location' },
      { key: 'pay', selector: 'input[name="pay"]' }
    ];
    var first = order.find(function (item) { return dataStepErrors[item.key]; });
    if (!first) return;
    var node = document.querySelector(first.selector);
    if (!node) return;
    node.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' });
    node.focus({ preventScroll: true });
  }

  function refreshDataErrorsIfNeeded() {
    if (!Object.keys(dataStepErrors).length) return;
    var nextErrors = getDataStepErrors();
    if (sameErrorMap(dataStepErrors, nextErrors)) return;
    dataStepErrors = nextErrors;
    updateDataErrorsUI();
  }

  function onStepContentInput(e) {
    var target = e.target;
    if (target.id === 'name') state.customer.customerName = target.value;
    if (target.id === 'phone') state.customer.phone = target.value;
    if (target.id === 'note') state.customer.note = target.value;
    if (state.step === 5) refreshDataErrorsIfNeeded();
    saveDraft();
  }

  function onNextClick() {
    if (state.step === 5) {
      dataStepErrors = getDataStepErrors();
      if (Object.keys(dataStepErrors).length) {
        redraw();
        setStatus('Completa datos requeridos.');
        focusFirstDataError();
        return;
      }
    }

    var err = validate();
    if (err) return setStatus(err);
    state.step = Math.min(STEPS.length - 1, state.step + 1);
    redrawAndFocusCurrentStep();
  }

  function onBackClick() {
    state.step = Math.max(0, state.step - 1);
    redrawAndFocusCurrentStep();
  }

  function onStepperClick(e) {
    var button = e.target.closest('[data-step-index]');
    if (!button) return;
    moveStep(Number(button.getAttribute('data-step-index')));
  }

  function onClearClick() {
    if (hasDraftContent() && Date.now() > clearConfirmUntil) {
      clearConfirmUntil = Date.now() + 5000;
      setStatus('Toca otra vez "Reiniciar pedido" para confirmar. Este pedido se guarda solo en este dispositivo.');
      return;
    }
    clearConfirmUntil = 0;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    isSubmitting = false;
    setSubmitLoading(false);
    state = createInitialState();
    redraw();
    setStatus('Pedido reiniciado.');
  }

  function onLoadLastClick() {
    isSubmitting = false;
    setSubmitLoading(false);
    restoreDraft(loadDraft());
    redraw();
    setStatus('Pedido anterior cargado.');
  }

  function onSuccessPanelClick(e) {
    var button = e.target.closest('#backToMenuBtn');
    if (!button) return;
    goBackToMenuAfterSuccess();
  }

  async function submit() {
    if (isSubmitting) return;
    if (isOrderingClosed()) return setStatus('Pedidos cerrados temporalmente.');
    hideSuccessPanel();
    var err = validate('submit');
    if (err) return setStatus('Validación fallida: ' + err);

    var payload = buildPayload();
    isSubmitting = true;
    setSubmitLoading(true);
    setStatus('Loading order...');
    console.debug('POST /api/order payload', payload);

    try {
      var response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: payload })
      });
      var data = await response.json();
      console.debug('POST /api/order response', data);
      var upstream = data && data.data && data.data.upstream ? data.data.upstream : null;
      var isDryRun = Boolean(data && data.data && data.data.mode === 'dry-run');
      var isWriteAccepted = Boolean(upstream && upstream.mode === 'write' && upstream.accepted === true);
      if (response.ok && data && data.ok && !isDryRun && isWriteAccepted) {
        setStatus('Pedido recibido correctamente.');
        setSubmitSuccess();
        showSuccessPanel(data);
        return;
      }
      console.warn('Respuesta no confirma escritura real del pedido', { status: response.status, data: data });
      isSubmitting = false;
      setSubmitLoading(false);
      setStatus('No se pudo enviar el pedido. Intenta de nuevo.');
    } catch (requestError) {
      console.error('Error enviando /api/order', requestError);
      isSubmitting = false;
      setSubmitLoading(false);
      setStatus('No se pudo enviar el pedido. Intenta de nuevo.');
    }
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  var stepContent = document.getElementById('stepContent');
  stepContent.classList.add('step-content');
  stepContent.setAttribute('aria-busy', 'false');
  stepContent.addEventListener('click', onStepContentClick);
  stepContent.addEventListener('change', onStepContentChange);
  stepContent.addEventListener('input', onStepContentInput);

  document.getElementById('nextBtn').addEventListener('click', onNextClick);
  document.getElementById('backBtn').addEventListener('click', onBackClick);
  document.getElementById('stepper').addEventListener('click', onStepperClick);
  document.getElementById('clearBtn').addEventListener('click', onClearClick);
  document.getElementById('loadLastBtn').addEventListener('click', onLoadLastClick);
  document.getElementById('successPanel').addEventListener('click', onSuccessPanelClick);
  var loadLastBtn = document.getElementById('loadLastBtn');
  var clearBtn = document.getElementById('clearBtn');
  loadLastBtn.textContent = 'Cargar';
  loadLastBtn.title = 'Cargar pedido guardado en este dispositivo';
  loadLastBtn.setAttribute('aria-label', 'Cargar pedido guardado en este dispositivo');
  clearBtn.textContent = 'Reiniciar';
  clearBtn.title = 'Reiniciar pedido y borrar guardado local';
  clearBtn.setAttribute('aria-label', 'Reiniciar pedido y borrar guardado local');
  var navPanel = document.querySelector('.nav-panel');
  if (navPanel) {
    var mini = document.createElement('p');
    mini.id = 'miniSummary';
    mini.className = 'mini-summary';
    navPanel.insertBefore(mini, navPanel.firstChild);
    var hint = document.createElement('p');
    hint.className = 'mini-storage-hint';
    hint.textContent = 'Se guarda en este dispositivo sin iniciar sesión.';
    navPanel.insertBefore(hint, navPanel.children[1]);
  }

  restoreDraft(loadDraft());
  ensureCustomerReferralField();
  applyUrlReferralCode();
  redraw();

  fetchPublicMenu().then(function () {
    state.burgerUnits = (state.burgerUnits || []).map(normalizeBurgerUnit);
    redraw();
  }).catch(function () {
    redraw();
  });

  fetchCampaignConfig().then(function () {
    redraw();
  }).catch(function () {
    campaignConfig = null;
    campaignLoadStatus = 'error';
    redraw();
  });

  fetchOrderGateConfig(function (lateConfig) {
    orderGateConfig = normalizeOrderGateConfig(lateConfig);
    renderOrderingGate();
  }).then(function (nextConfig) {
    orderGateConfig = normalizeOrderGateConfig(nextConfig);
    renderOrderingGate();
  }).catch(function () {
    orderGateConfig = normalizeOrderGateConfig(DEFAULT_ORDER_GATE_CONFIG);
    renderOrderingGate();
  });
})();
