(function () {
  // ---------------------------------------------------------------------------
  // Constants and static catalog
  // ---------------------------------------------------------------------------
  var STORAGE_KEY = 'bog_public_order_draft_v3';
  var LEGACY_KEY = 'bog_public_order_draft_v2';
  var STEPS = ['MENU', 'BURGERS', 'CUSTOM', 'EXTRAS', 'GUARNICIONES', 'DATOS', 'RESUMEN'];

  var MENU = {
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
      customer: { customerName: '', phone: '', location: '', paymentMethod: 'Pago mismo dia', note: '' },
      ts: Date.now()
    };
  }

  var state = createInitialState();
  var dataStepErrors = {};
  var clearConfirmUntil = 0;

  function getCurrentStepName() { return STEPS[state.step]; }
  function countBurgers() { return state.burgerUnits.length; }

  function getBurgerCounts() {
    return {
      OG: state.burgerUnits.filter(function (u) { return u.sku === 'OG'; }).length,
      BBQ: state.burgerUnits.filter(function (u) { return u.sku === 'BBQ'; }).length
    };
  }

  function syncUnits(counts) {
    var units = [];
    ['OG', 'BBQ'].forEach(function (sku) {
      for (var i = 1; i <= (counts[sku] || 0); i += 1) {
        var id = sku + '-' + i;
        var old = state.burgerUnits.find(function (u) { return u.id === id; });
        units.push(old || { id: id, sku: sku, label: sku + ' #' + i, without: [], extras: [] });
      }
    });
    state.burgerUnits = units;
  }

  // ---------------------------------------------------------------------------
  // Generic helpers
  // ---------------------------------------------------------------------------
  function bySku(list, sku) { return list.find(function (x) { return x.sku === sku; }); }
  function money(v) { return '$' + Number(v || 0).toFixed(2); }
  function burgerPrice(sku) { return bySku(MENU.burgers, sku).price; }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function setStatus(message, details) {
    var statusNode = document.getElementById('status');
    statusNode.textContent = message + (details ? '\n\n' + JSON.stringify(details, null, 2) : '');
    statusNode.setAttribute('tabindex', '-1');
    statusNode.focus({ preventScroll: true });
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
      return;
    }

    if (draft.payload) {
      var counts = { OG: 0, BBQ: 0 };
      (draft.payload.items || []).forEach(function (it) {
        if (it.sku === 'OG' || it.sku === 'BBQ') counts[it.sku] = it.qty;
      });
      syncUnits(counts);
      state.customer = {
        customerName: draft.payload.customerName || '',
        phone: draft.payload.phone || '',
        location: draft.payload.location || '',
        paymentMethod: draft.payload.paymentMethod || 'Pago mismo dia',
        note: draft.payload.note || ''
      };
      state.step = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Payload + validation helpers
  // ---------------------------------------------------------------------------
  function calcTotal() {
    var total = 0;
    state.burgerUnits.forEach(function (u) { total += burgerPrice(u.sku) + (u.extras || []).length * 5; });
    MENU.sides.forEach(function (s) { total += (state.sidesQty[s.sku] || 0) * s.price; });
    return total;
  }

  function calcOrderItemCount() {
    var sideItems = 0;
    MENU.sides.forEach(function (s) { sideItems += Number(state.sidesQty[s.sku] || 0); });
    return countBurgers() + sideItems;
  }

  function hasDraftContent() {
    return calcOrderItemCount() > 0 || Boolean(state.customer.customerName.trim() || state.customer.phone.trim() || state.customer.location || state.customer.note.trim());
  }

  function buildPayload() {
    var items = {};

    state.burgerUnits.forEach(function (u) {
      items[u.sku] = (items[u.sku] || 0) + 1;
      (u.extras || []).forEach(function (ex) {
        var sku = 'EXTRA_' + ex.toUpperCase().replace(/ /g, '_').replace('Ñ', 'N');
        items[sku] = (items[sku] || 0) + 1;
      });
    });

    Object.keys(state.sidesQty).forEach(function (sku) {
      if (state.sidesQty[sku] > 0) items[sku] = (items[sku] || 0) + state.sidesQty[sku];
    });

    return {
      customerName: state.customer.customerName.trim(),
      phone: state.customer.phone.trim(),
      location: state.customer.location,
      paymentMethod: state.customer.paymentMethod,
      note: state.customer.note.trim(),
      items: Object.keys(items).map(function (sku) { return { sku: sku, qty: items[sku] }; }),
      personalizations: {
        burgers: state.burgerUnits.map(function (u, i) {
          return {
            sku: u.sku,
            burgerIndex: Number(u.id.split('-')[1] || (i + 1)),
            without: (u.without || []).slice(),
            extras: (u.extras || []).slice()
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
    if (stepOnly === 'submit' && !buildPayload().items.length) return 'Carrito vacío.';
    return '';
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function renderStepper() {
    var progress = '<span class="step-progress">Paso ' + (state.step + 1) + ' de ' + STEPS.length + '</span>';
    document.getElementById('stepper').innerHTML = STEPS.map(function (stepName, i) {
      var classes = 'step ' + (i === state.step ? 'active' : i < state.step ? 'done' : '');
      var disabled = i > state.step ? 'disabled' : '';
      var ariaCurrent = i === state.step ? 'aria-current="step"' : '';
      var ariaLabel = 'aria-label="Ir al paso ' + (i + 1) + ': ' + stepName + '"';
      return '<button type="button" class="' + classes + '" data-step-index="' + i + '" ' + disabled + ' ' + ariaCurrent + ' ' + ariaLabel + '>' + stepName + '</button>';
    }).join('') + progress;
  }

  function renderMenuCards(items, qtyObj) {
    return items.map(function (x) {
      var qty = qtyObj ? Number(qtyObj[x.sku] || 0) : 0;
      var icon = SKU_ICONS[x.sku] ? '<img class="menu-icon" src="' + SKU_ICONS[x.sku] + '" alt="Icono de ' + escapeHtml(x.name) + '" loading="lazy">' : '';
      return '<article class="menu-item">' +
        icon +
        '<h3>' + escapeHtml(x.name) + '</h3>' +
        '<p>' + money(x.price) + '</p>' +
        '<small>' + escapeHtml(x.description) + '</small>' +
        (qtyObj
          ? '<div class="qty"><button data-op="minus" data-sku="' + x.sku + '">-</button><span>' + qty + '</span><button data-op="plus" data-sku="' + x.sku + '">+</button></div>'
          : '') +
        '</article>';
    }).join('');
  }

  function renderMenuStep() {
    return '<h2>MENÚ</h2><h3>Burgers</h3><div class="menu-grid">' + renderMenuCards(MENU.burgers) + '</div>' +
      '<h3>Extras</h3><div class="menu-grid">' + renderMenuCards(MENU.extras) + '</div>' +
      '<h3>Guarniciones</h3><div class="menu-grid">' + renderMenuCards(MENU.sides) + '</div>' +
      '<button id="startBtn" class="primary">INICIAR PEDIDO</button>';
  }

  function renderBurgersStep() {
    return '<h2>BURGERS</h2><div class="menu-grid">' + renderMenuCards(MENU.burgers, getBurgerCounts()) + '</div>';
  }

  function renderCustomStep() {
    if (!state.burgerUnits.length) return '<h2>CUSTOM</h2><p class="muted">No hay burgers.</p>';
    return '<h2>CUSTOM</h2>' + state.burgerUnits.map(function (u, i) {
      return '<div class="custom-card"><h4>' + u.label + '</h4>' + WITHOUT[u.sku].map(function (opt) {
        return '<label><input type="checkbox" data-kind="without" data-i="' + i + '" value="' + opt + '" ' + (u.without.indexOf(opt) >= 0 ? 'checked' : '') + '>' + opt + '</label>';
      }).join('') + '</div>';
    }).join('');
  }

  function renderExtrasStep() {
    if (!state.burgerUnits.length) return '<h2>EXTRAS</h2><p class="muted">No hay burgers.</p>';
    return '<h2>EXTRAS</h2>' + state.burgerUnits.map(function (u, i) {
      return '<div class="custom-card"><h4>Extras para esta burger: ' + u.label + '</h4>' + MENU.extras.map(function (x) {
        return '<label><input type="checkbox" data-kind="extra" data-i="' + i + '" value="' + x.name + '" ' + (u.extras.indexOf(x.name) >= 0 ? 'checked' : '') + '>' + x.name + ' (+$5)</label>';
      }).join('') + '</div>';
    }).join('');
  }

  function renderSidesStep() {
    return '<h2>GUARNICIONES</h2><div class="menu-grid">' + renderMenuCards(MENU.sides, state.sidesQty) + '</div>';
  }

  function renderDataStep() {
    var nameError = dataStepErrors.name ? '<p class="field-error" id="name-error">' + dataStepErrors.name + '</p>' : '';
    var phoneError = dataStepErrors.phone ? '<p class="field-error" id="phone-error">' + dataStepErrors.phone + '</p>' : '';
    var locationError = dataStepErrors.location ? '<p class="field-error" id="location-error">' + dataStepErrors.location + '</p>' : '';
    var payError = dataStepErrors.pay ? '<p class="field-error" id="pay-error">' + dataStepErrors.pay + '</p>' : '';

    return '<h2>DATOS</h2>' +
      '<label class="field ' + (dataStepErrors.name ? 'has-error' : '') + '">Nombre *<input id="name" placeholder="Ej. Jack" aria-describedby="name-error" aria-invalid="' + (dataStepErrors.name ? 'true' : 'false') + '" value="' + escapeHtml(state.customer.customerName) + '"></label>' +
      nameError +
      '<label class="field ' + (dataStepErrors.phone ? 'has-error' : '') + '">Teléfono *<input id="phone" type="tel" inputmode="numeric" placeholder="10 dígitos" aria-describedby="phone-error" aria-invalid="' + (dataStepErrors.phone ? 'true' : 'false') + '" value="' + escapeHtml(state.customer.phone) + '"></label>' +
      phoneError +
      '<label class="field ' + (dataStepErrors.location ? 'has-error' : '') + '">Ubicación *<select id="location" aria-describedby="location-error" aria-invalid="' + (dataStepErrors.location ? 'true' : 'false') + '"><option value="">Selecciona</option><option ' + (state.customer.location === 'Torre GGA' ? 'selected' : '') + '>Torre GGA</option><option ' + (state.customer.location === 'Torre Valcob' ? 'selected' : '') + '>Torre Valcob</option></select></label>' +
      locationError +
      '<fieldset class="pay-group ' + (dataStepErrors.pay ? 'has-error' : '') + '" aria-describedby="pay-error"><legend>Forma de pago *</legend><label class="pay-option"><input type="radio" name="pay" value="Pago mismo dia" ' + (state.customer.paymentMethod === 'Pago mismo dia' ? 'checked' : '') + '>Pago mismo dia</label><label class="pay-option"><input type="radio" name="pay" value="Pagar Antes" ' + (state.customer.paymentMethod === 'Pagar Antes' ? 'checked' : '') + '>Pagar Antes</label></fieldset>' +
      payError +
      '<label class="field">Nota (opcional)<textarea id="note" placeholder="Ej. Estoy en lobby / sin cambios extra">' + escapeHtml(state.customer.note) + '</textarea></label>';
  }

  function renderSummaryStep() {
    var lines = state.burgerUnits.map(function (u) {
      var ex = (u.extras || []).map(function (name) { return escapeHtml(name) + ' +$5'; }).join(', ') || 'Sin extras';
      return '<div class="ticket-line"><strong>' + escapeHtml(u.label) + ' — ' + money(burgerPrice(u.sku)) + '</strong><p>Quitar: ' + escapeHtml((u.without || []).join(', ') || 'Sin cambios') + '</p><p>Extras: ' + ex + '</p><p>Subtotal burger: ' + money(burgerPrice(u.sku) + (u.extras || []).length * 5) + '</p></div>';
    }).join('');

    var sides = MENU.sides.map(function (s) {
      var qty = state.sidesQty[s.sku] || 0;
      return qty ? '<div class="summary-row"><span>' + escapeHtml(s.name) + ' x' + qty + '</span><strong>' + money(qty * s.price) + '</strong></div>' : '';
    }).join('') || '<p class="muted">Sin guarniciones</p>';

    return '<h2>RESUMEN</h2>' +
      '<section class="summary-section"><h3>Burgers</h3>' + (lines || '<p class="muted">Sin burgers.</p>') + '</section>' +
      '<section class="summary-section"><h3>Guarniciones</h3>' + sides + '</section>' +
      '<section class="summary-section"><h3>Datos del cliente</h3>' +
      '<p>Nombre: ' + escapeHtml(state.customer.customerName || '(pendiente)') + '</p>' +
      '<p>Teléfono: ' + escapeHtml(state.customer.phone || '(pendiente)') + '</p>' +
      '<p>Ubicación: ' + escapeHtml(state.customer.location || '(pendiente)') + '</p>' +
      '<p>Nota: ' + escapeHtml(state.customer.note || '(sin nota)') + '</p></section>' +
      '<section class="summary-section"><h3>Pago</h3><p>Forma de pago: ' + escapeHtml(state.customer.paymentMethod) + '</p><div id="paymentInfo"></div></section>' +
      '<section class="summary-section summary-total"><h3>Total</h3><p>' + money(calcTotal()) + '</p></section>' +
      '<button id="submitBtn" class="primary">VALIDAR PEDIDO / COMPILAR ORDEN</button>';
  }

  function renderMiniSummary() {
    var node = document.getElementById('miniSummary');
    if (!node) return;
    var items = calcOrderItemCount();
    if (!items) {
      node.textContent = 'Pedido vacío';
      return;
    }
    node.textContent = 'Pedido: ' + items + ' items · ' + money(calcTotal());
  }

  function renderCurrentStep() {
    var container = document.getElementById('stepContent');
    var stepName = getCurrentStepName();

    if (stepName === 'MENU') container.innerHTML = renderMenuStep();
    if (stepName === 'BURGERS') container.innerHTML = renderBurgersStep();
    if (stepName === 'CUSTOM') container.innerHTML = renderCustomStep();
    if (stepName === 'EXTRAS') container.innerHTML = renderExtrasStep();
    if (stepName === 'GUARNICIONES') container.innerHTML = renderSidesStep();
    if (stepName === 'DATOS') container.innerHTML = renderDataStep();
    if (stepName === 'RESUMEN') {
      container.innerHTML = renderSummaryStep();
      renderPaymentInfo();
    }

    toggleNav();
  }

  function toggleNav() {
    document.getElementById('backBtn').disabled = state.step === 0;
    document.getElementById('nextBtn').style.display = state.step >= STEPS.length - 1 ? 'none' : 'inline-flex';
  }

  async function renderPaymentInfo() {
    var node = document.getElementById('paymentInfo');
    if (!node) return;

    if (state.customer.paymentMethod === 'Pago mismo dia') {
      node.textContent = 'Pagas el día de entrega: efectivo o transferencia.';
      return;
    }

    node.textContent = 'Cargando /api/bank-config...';
    try {
      var response = await fetch('/api/bank-config');
      var data = await response.json();
      node.textContent = data.ok && data.data && data.data.enabled
        ? ('Banco: ' + (data.data.bankName || '') + ' | Titular: ' + (data.data.accountHolder || '') + ' | Cuenta: ' + (data.data.accountNumber || ''))
        : 'Datos bancarios pendientes de conectar';
    } catch (_e) {
      node.textContent = 'Datos bancarios pendientes de conectar';
    }
  }

  function redraw() {
    renderStepper();
    renderCurrentStep();
    renderMiniSummary();
    saveDraft();
  }

  function moveStep(targetStep) {
    var nextStep = Math.max(0, Math.min(STEPS.length - 1, targetStep));
    if (nextStep > state.step) return;
    state.step = nextStep;
    redraw();
    scrollToCurrentStep();
  }

  function scrollToCurrentStep() {
    var scrollTarget = document.getElementById('stepContent');
    if (!scrollTarget) return;
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTarget.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function onStepContentClick(e) {
    var button = e.target.closest('button');
    if (!button) return;

    if (button.id === 'startBtn') {
      state.step = 1;
      redraw();
      return;
    }

    if (button.id === 'submitBtn') {
      submit();
      return;
    }

    var sku = button.getAttribute('data-sku');
    if (!sku) return;

    var op = button.getAttribute('data-op');
    var stepName = getCurrentStepName();

    if (stepName === 'BURGERS') {
      var counts = getBurgerCounts();
      counts[sku] = Math.max(0, (counts[sku] || 0) + (op === 'plus' ? 1 : -1));
      syncUnits(counts);
    } else if (stepName === 'GUARNICIONES') {
      state.sidesQty[sku] = Math.max(0, Number(state.sidesQty[sku] || 0) + (op === 'plus' ? 1 : -1));
    }

    redraw();
  }

  function onStepContentChange(e) {
    var target = e.target;
    var index = Number(target.getAttribute('data-i'));

    if (target.getAttribute('data-kind') === 'without') {
      var without = state.burgerUnits[index].without;
      var withoutPos = without.indexOf(target.value);
      if (target.checked && withoutPos < 0) without.push(target.value);
      if (!target.checked && withoutPos >= 0) without.splice(withoutPos, 1);
    }

    if (target.getAttribute('data-kind') === 'extra') {
      var extras = state.burgerUnits[index].extras;
      var extraPos = extras.indexOf(target.value);
      if (target.checked && extraPos < 0) extras.push(target.value);
      if (!target.checked && extraPos >= 0) extras.splice(extraPos, 1);
    }

    if (target.name === 'pay') state.customer.paymentMethod = target.value;
    if (target.id === 'location') state.customer.location = target.value;

    if (state.step === 5) refreshDataErrorsIfNeeded();
    saveDraft();
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
    if (field) field.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');

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
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
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
    redraw();
    scrollToCurrentStep();
  }

  function onBackClick() {
    state.step = Math.max(0, state.step - 1);
    redraw();
    scrollToCurrentStep();
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
    state = createInitialState();
    redraw();
    setStatus('Pedido reiniciado. Se borró el guardado local.');
  }

  function onLoadLastClick() {
    restoreDraft(loadDraft());
    redraw();
    setStatus('Pedido anterior cargado desde este dispositivo.');
  }

  async function submit() {
    var err = validate('submit');
    if (err) return setStatus('Validación fallida: ' + err);

    var payload = buildPayload();
    setStatus('Enviando /api/order...', payload);

    var response = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payload })
    });

    var data = await response.json();
    setStatus((data.ok ? 'ORDER COMPILED' : 'Error en /api/order'), data);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  document.getElementById('stepContent').addEventListener('click', onStepContentClick);
  document.getElementById('stepContent').addEventListener('change', onStepContentChange);
  document.getElementById('stepContent').addEventListener('input', onStepContentInput);

  document.getElementById('nextBtn').addEventListener('click', onNextClick);
  document.getElementById('backBtn').addEventListener('click', onBackClick);
  document.getElementById('stepper').addEventListener('click', onStepperClick);
  document.getElementById('clearBtn').addEventListener('click', onClearClick);
  document.getElementById('loadLastBtn').addEventListener('click', onLoadLastClick);
  document.getElementById('loadLastBtn').textContent = 'Cargar pedido guardado en este dispositivo';
  document.getElementById('clearBtn').textContent = 'Reiniciar pedido y borrar guardado local';
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
  redraw();
})();
