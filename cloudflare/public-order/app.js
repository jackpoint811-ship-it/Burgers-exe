(function () {
  var STORAGE_KEY = 'bog_public_order_draft_v2';
  var MENU = [
    { sku: 'OG', name: 'OG', price: 85, category: 'burger' },
    { sku: 'BBQ', name: 'BBQ', price: 85, category: 'burger' },
    { sku: 'PAPAS_OG', name: 'Papas a la francesa OG', price: 20, category: 'side' },
    { sku: 'PAPAS_ESPECIALES', name: 'Papas a la francesa Especiales', price: 25, category: 'side' },
    { sku: 'PAPAS_LEMON_PEPPER', name: 'Papas a la francesa Lemon&Pepper', price: 25, category: 'side' },
    { sku: 'AROS_CEBOLLA', name: 'Aros de Cebolla', price: 30, category: 'side' },
    { sku: 'EXTRA_PEPINILLOS', name: 'Pepinillos', price: 5, category: 'extra' },
    { sku: 'EXTRA_QUESO_AMERICANO', name: 'Queso americano', price: 5, category: 'extra' },
    { sku: 'EXTRA_QUESO_MANCHEGO', name: 'Queso manchego', price: 5, category: 'extra' },
    { sku: 'EXTRA_TOCINO', name: 'Tocino', price: 5, category: 'extra' },
    { sku: 'EXTRA_CATSUP', name: 'Catsup', price: 5, category: 'extra' },
    { sku: 'EXTRA_MOSTAZA', name: 'Mostaza', price: 5, category: 'extra' },
    { sku: 'EXTRA_TOMATE', name: 'Tomate', price: 5, category: 'extra' }
  ];
  var CUSTOM_OPTIONS = {
    OG: ['Sin Tocino', 'Sin Queso americano', 'Sin Queso manchego', 'Sin Jitomate', 'Sin Lechuga', 'Sin Pepinillos', 'Sin Catsup', 'Sin Mostaza', 'Sin Mayonesa'],
    BBQ: ['Sin Tocino', 'Sin Queso americano', 'Sin Queso manchego', 'Sin Aros de cebolla', 'Sin Salsa bbq']
  };

  var state = { itemsQty: {}, customizations: { OG: [], BBQ: [] } };

  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function safeText(value) {
    return String(value == null ? '' : value);
  }

  function getPaymentMethod() {
    var checked = document.querySelector('input[name="payment"]:checked');
    return checked ? checked.value : 'Pago mismo dia';
  }

  function renderMenu() {
    var menuGrid = document.getElementById('menuGrid');
    menuGrid.innerHTML = MENU.map(function (item) {
      var qty = Number(state.itemsQty[item.sku] || 0);
      return '<article class="menu-item"><h3>' + item.name + '</h3><p>' + money(item.price) + '</p><div class="qty"><button data-sku="' + item.sku + '" data-op="minus">-</button><span id="qty_' + item.sku + '">' + qty + '</span><button data-sku="' + item.sku + '" data-op="plus">+</button></div></article>';
    }).join('');
  }

  function syncBurgerCustomizationLength() {
    ['OG', 'BBQ'].forEach(function (sku) {
      var qty = Number(state.itemsQty[sku] || 0);
      if (!Array.isArray(state.customizations[sku])) state.customizations[sku] = [];
      while (state.customizations[sku].length < qty) state.customizations[sku].push([]);
      if (state.customizations[sku].length > qty) state.customizations[sku] = state.customizations[sku].slice(0, qty);
    });
  }

  function renderCustomizations() {
    syncBurgerCustomizationLength();
    var wrap = document.getElementById('burgerCustomizations');
    var html = '';
    ['OG', 'BBQ'].forEach(function (sku) {
      var burgers = state.customizations[sku] || [];
      burgers.forEach(function (mods, idx) {
        html += '<div class="custom-card"><h4>' + sku + ' #' + (idx + 1) + '</h4>' + CUSTOM_OPTIONS[sku].map(function (opt) {
          var checked = mods.indexOf(opt) >= 0 ? 'checked' : '';
          return '<label><input type="checkbox" data-sku="' + sku + '" data-burger="' + idx + '" data-opt="' + opt + '" ' + checked + '/>' + opt + '</label>';
        }).join('') + '</div>';
      });
    });
    wrap.innerHTML = html || '<p class="muted">Agrega OG o BBQ para personalizar cada burger individualmente.</p>';
  }

  function buildItemsFromState() {
    return MENU.map(function (item) { return { sku: item.sku, qty: Number(state.itemsQty[item.sku] || 0) }; }).filter(function (it) { return it.qty > 0; });
  }

  function buildPayload() {
    var burgerPersonalizations = [];
    ['OG', 'BBQ'].forEach(function (sku) {
      (state.customizations[sku] || []).forEach(function (without, idx) {
        burgerPersonalizations.push({ sku: sku, burgerIndex: idx + 1, without: without.slice() });
      });
    });
    return {
      customerName: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      location: document.getElementById('location').value,
      paymentMethod: getPaymentMethod(),
      note: document.getElementById('note').value.trim(),
      items: buildItemsFromState(),
      personalizations: { burgers: burgerPersonalizations },
      timestamp: new Date().toISOString()
    };
  }

  function renderSummary() {
    var payload = buildPayload();
    var summary = document.getElementById('summary');
    if (!payload.items.length) { summary.innerHTML = '<p class="muted">Carrito vacío.</p>'; return; }
    var map = {};
    MENU.forEach(function (x) { map[x.sku] = x; });
    var total = 0;
    var lines = payload.items.map(function (it) {
      var m = map[it.sku];
      var sub = m.price * it.qty;
      total += sub;
      return '<tr><td>' + m.name + '</td><td>' + it.qty + '</td><td>' + money(m.price) + '</td><td>' + money(sub) + '</td></tr>';
    }).join('');
    summary.innerHTML = '<table><thead><tr><th>Producto</th><th>Cant</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>' + lines + '</tbody></table><p class="total">TOTAL: ' + money(total) + '</p>';

    var pay = document.getElementById('paymentInfo');
    if (payload.paymentMethod === 'Pagar Antes') {
      pay.innerHTML = '<p><strong>Datos para transferencia:</strong></p><p id="bankStatus">Cargando /api/bank-config...</p>';
      loadBankData();
    } else {
      pay.innerHTML = '<p>Pagas el día de entrega: efectivo o transferencia.</p>';
    }
  }

  async function loadBankData() {
    var status = document.getElementById('bankStatus');
    if (!status) return;
    try {
      var resp = await fetch('/api/bank-config');
      var data = await resp.json();
      if (data && data.ok && data.data && data.data.enabled === false) {
        status.textContent = 'Datos bancarios pendientes de conectar';
      } else if (data && data.ok && data.data && data.data.enabled === true) {
        var bankName = safeText(data.data.bankName || 'Banco pendiente');
        var holder = safeText(data.data.accountHolder || 'Titular pendiente');
        var account = safeText(data.data.accountNumber || 'Cuenta pendiente');
        status.textContent = 'Banco: ' + bankName + '\nTitular: ' + holder + '\nCuenta: ' + account;
      } else {
        status.textContent = 'Datos bancarios pendientes de conectar';
      }
    } catch (_err) {
      status.textContent = 'Datos bancarios pendientes de conectar';
    }
  }

  function saveDraft() {
    var payload = buildPayload();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), state: state, payload: payload }));
  }

  function loadDraft() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_err) { return null; }
  }

  function hydrateFromSaved(saved) {
    if (!saved || !saved.payload) return;
    var p = saved.payload;
    document.getElementById('name').value = p.customerName || '';
    document.getElementById('phone').value = p.phone || '';
    document.getElementById('location').value = p.location || '';
    document.getElementById('note').value = p.note || '';
    var radio = document.querySelector('input[name="payment"][value="' + (p.paymentMethod || 'Pago mismo dia') + '"]');
    if (radio) radio.checked = true;
    state.itemsQty = {};
    (p.items || []).forEach(function (it) { state.itemsQty[it.sku] = Number(it.qty || 0); });
    state.customizations = { OG: [], BBQ: [] };
    if (p.personalizations && Array.isArray(p.personalizations.burgers)) {
      p.personalizations.burgers.forEach(function (b) {
        var idx = Number(b.burgerIndex || 1) - 1;
        if (!state.customizations[b.sku]) state.customizations[b.sku] = [];
        state.customizations[b.sku][idx] = Array.isArray(b.without) ? b.without : [];
      });
    }
    syncBurgerCustomizationLength();
    redrawAll();
  }

  function setStatus(message, data) {
    document.getElementById('status').textContent = message + (data ? '\n\n' + JSON.stringify(data, null, 2) : '');
  }

  function validate(payload) {
    if (!payload.customerName || !payload.phone || !payload.location || !payload.paymentMethod) return 'Completa datos cliente y pago.';
    if (!payload.items.length) return 'Agrega al menos un producto.';
    return '';
  }

  async function submitOrder() {
    var payload = buildPayload();
    var err = validate(payload);
    if (err) return setStatus('Validación fallida', { message: err });
    saveDraft();
    setStatus('Enviando /api/order en modo seguro...', payload);
    try {
      var response = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: payload }) });
      var data = await response.json();
      if (!response.ok || !data.ok) return setStatus('Error en /api/order', data);
      renderSuccess(payload, data);
      setStatus('ORDER COMPILED', data);
    } catch (networkErr) {
      setStatus('Error de red', { message: networkErr.message });
    }
  }

  function renderSuccess(payload, apiResp) {
    var el = document.getElementById('successPanel');
    var total = (apiResp.data && apiResp.data.total) || 0;
    el.classList.remove('hidden');
    el.textContent = '';

    var title = document.createElement('h2');
    title.textContent = 'ORDER COMPILED';
    el.appendChild(title);

    var totalP = document.createElement('p');
    var totalStrong = document.createElement('strong');
    totalP.appendChild(document.createTextNode('Total: '));
    totalStrong.textContent = money(total);
    totalP.appendChild(totalStrong);
    el.appendChild(totalP);

    var paymentP = document.createElement('p');
    paymentP.textContent = 'Pago: ' + safeText(payload.paymentMethod);
    el.appendChild(paymentP);

    var locationP = document.createElement('p');
    locationP.textContent = 'Ubicación: ' + safeText(payload.location);
    el.appendChild(locationP);

    var noteP = document.createElement('p');
    noteP.textContent = 'Nota: ' + safeText(payload.note || '(sin nota)');
    el.appendChild(noteP);

    var details = document.createElement('details');
    var summary = document.createElement('summary');
    summary.textContent = 'Resumen desglosado';
    var pre = document.createElement('pre');
    pre.textContent = JSON.stringify(payload, null, 2);
    details.appendChild(summary);
    details.appendChild(pre);
    el.appendChild(details);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('location').value = '';
    document.getElementById('note').value = '';
    var radio = document.querySelector('input[name="payment"][value="Pago mismo dia"]'); if (radio) radio.checked = true;
    state = { itemsQty: {}, customizations: { OG: [], BBQ: [] } };
    redrawAll();
    document.getElementById('successPanel').classList.add('hidden');
    setStatus('Nueva orden iniciada. Draft eliminado.');
  }

  function redrawAll() { renderMenu(); renderCustomizations(); renderSummary(); }

  document.getElementById('menuGrid').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-sku]');
    if (!btn) return;
    var sku = btn.getAttribute('data-sku');
    var op = btn.getAttribute('data-op');
    var next = Number(state.itemsQty[sku] || 0) + (op === 'plus' ? 1 : -1);
    state.itemsQty[sku] = Math.max(0, next);
    redrawAll();
    saveDraft();
  });

  document.getElementById('burgerCustomizations').addEventListener('change', function (e) {
    var input = e.target;
    if (!input.matches('input[type="checkbox"]')) return;
    var sku = input.getAttribute('data-sku');
    var idx = Number(input.getAttribute('data-burger'));
    var opt = input.getAttribute('data-opt');
    var arr = state.customizations[sku][idx] || [];
    var pos = arr.indexOf(opt);
    if (input.checked && pos < 0) arr.push(opt);
    if (!input.checked && pos >= 0) arr.splice(pos, 1);
    state.customizations[sku][idx] = arr;
    saveDraft();
  });

  ['name', 'phone', 'location', 'note'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () { renderSummary(); saveDraft(); });
    document.getElementById(id).addEventListener('change', function () { renderSummary(); saveDraft(); });
  });
  document.querySelectorAll('input[name="payment"]').forEach(function (r) {
    r.addEventListener('change', function () { renderSummary(); saveDraft(); });
  });

  document.getElementById('loadLastBtn').addEventListener('click', function () {
    var saved = loadDraft();
    if (!saved) return setStatus('No existe orden previa guardada.');
    hydrateFromSaved(saved);
    setStatus('Orden previa cargada.', { ts: saved.ts });
  });
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('submitBtn').addEventListener('click', submitOrder);

  redrawAll();
  var previous = loadDraft();
  if (previous) setStatus('Orden previa detectada. Usa LOAD LAST ORDER para restaurar.', { ts: previous.ts });
})();
