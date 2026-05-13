(function () {
  var STORAGE_KEY = 'bog_public_order_draft_v1';

  function getFormState() {
    var paymentInput = document.querySelector('input[name="payment"]:checked');
    return {
      customerName: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      location: document.getElementById('location').value,
      paymentMethod: paymentInput ? paymentInput.value : 'Pago mismo dia',
      items: [
        { sku: 'OG', qty: 1 },
        { sku: 'PAPAS_OG', qty: 1 }
      ],
      note: 'Fase 1 simulación'
    };
  }

  function setFormState(state) {
    if (!state) return;
    document.getElementById('name').value = state.customerName || '';
    document.getElementById('phone').value = state.phone || '';
    document.getElementById('location').value = state.location || '';
    var payment = state.paymentMethod || 'Pago mismo dia';
    var radio = document.querySelector('input[name="payment"][value="' + payment + '"]');
    if (radio) radio.checked = true;
  }

  function setStatus(message, data) {
    var el = document.getElementById('status');
    el.textContent = message + (data ? '\n\n' + JSON.stringify(data, null, 2) : '');
  }

  function saveDraft(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), state: state }));
  }

  function loadDraft() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  async function simulateOrder() {
    var payload = getFormState();
    saveDraft(payload);
    setStatus('Enviando simulación...', payload);

    try {
      var response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: payload })
      });
      var data = await response.json();
      setStatus('Respuesta /api/order', data);
    } catch (err) {
      setStatus('Error de red en simulación', { message: err.message });
    }
  }

  document.getElementById('simulateBtn').addEventListener('click', simulateOrder);
  document.getElementById('loadLastBtn').addEventListener('click', function () {
    var saved = loadDraft();
    if (!saved || !saved.state) {
      setStatus('No existe draft previo');
      return;
    }
    setFormState(saved.state);
    setStatus('Draft cargado', saved);
  });

  var previous = loadDraft();
  if (previous && previous.state) {
    setStatus('Draft detectado. Usa LOAD LAST ORDER para restaurar.', { ts: previous.ts });
  }
})();
