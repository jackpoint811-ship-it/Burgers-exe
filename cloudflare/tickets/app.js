(function () {
  var form = document.getElementById('ticketForm');
  var phoneInput = document.getElementById('phoneInput');
  var phoneError = document.getElementById('phoneError');
  var statusLine = document.getElementById('statusLine');
  var submitButton = document.getElementById('submitButton');
  var resultCard = document.getElementById('resultCard');
  var ticketsCount = document.getElementById('ticketsCount');
  var ticketsCopy = document.getElementById('ticketsCopy');
  var customerName = document.getElementById('customerName');
  var phoneMasked = document.getElementById('phoneMasked');
  var referralCode = document.getElementById('referralCode');
  var shareMessage = document.getElementById('shareMessage');
  var whatsappLink = document.getElementById('whatsappLink');
  var currentResult = null;

  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function setStatus(message, kind) {
    statusLine.textContent = message || '';
    statusLine.classList.toggle('is-error', kind === 'error');
    statusLine.classList.toggle('is-success', kind === 'success');
  }
  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Consultando...' : 'Consultar tickets';
    phoneInput.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
  function validatePhone() {
    var phone = digits(phoneInput.value);
    if (phone.length < 8) {
      phoneError.textContent = 'Escribe al menos 8 dígitos.';
      phoneInput.setAttribute('aria-invalid', 'true');
      return '';
    }
    phoneError.textContent = '';
    phoneInput.setAttribute('aria-invalid', 'false');
    return phone;
  }
  function buildMessage(data) {
    return 'Ya estoy participando en el sorteo de Burgers.exe 🍔🎟️ Usa mi código ' + data.referralCode + ' cuando hagas tu pedido y me ayudas a sumar tickets. Pide aquí: ' + data.shareUrl;
  }
  function renderResult(data) {
    currentResult = data;
    var count = Number(data.ticketsCount || 0);
    ticketsCount.textContent = String(count);
    ticketsCopy.textContent = 'Tienes ' + count + ' tickets.';
    customerName.textContent = data.customerName || 'Cliente Burgers.exe';
    phoneMasked.textContent = data.phoneMasked || 'Teléfono confirmado';
    referralCode.textContent = data.referralCode || '—';
    shareMessage.value = buildMessage(data);
    whatsappLink.href = 'https://wa.me/?text=' + encodeURIComponent(shareMessage.value);
    resultCard.classList.remove('hidden');
    setStatus('Tickets encontrados. Ya puedes copiar o compartir tu código.', 'success');
  }
  function fallbackCopyText(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-1000px';
    document.body.appendChild(helper);
    helper.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (_error) { copied = false; }
    document.body.removeChild(helper);
    return copied;
  }
  async function copyText(text) {
    if (!text) return false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_error) {}
    }
    return fallbackCopyText(text);
  }
  async function handleCopy(button) {
    if (!currentResult) return;
    var type = button.getAttribute('data-copy');
    var value = type === 'code' ? currentResult.referralCode : (type === 'link' ? currentResult.shareUrl : shareMessage.value);
    var copied = await copyText(value);
    var original = button.textContent;
    button.textContent = copied ? 'Copiado' : 'No se pudo copiar';
    setStatus(copied ? 'Copiado al portapapeles.' : 'No se pudo copiar automáticamente. Selecciona el texto manualmente.', copied ? 'success' : 'error');
    window.setTimeout(function () { button.textContent = original; }, 1400);
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var phone = validatePhone();
    if (!phone) return;
    resultCard.classList.add('hidden');
    setLoading(true);
    setStatus('Consultando tus tickets...', '');
    try {
      var response = await fetch('/api/referral-tickets?phone=' + encodeURIComponent(phone));
      var payload = await response.json().catch(function () { return null; });
      if (response.status === 404 || (payload && payload.error && payload.error.code === 'NOT_FOUND')) {
        setStatus('No encontramos tickets con ese teléfono. Revisa el número o participa haciendo tu pedido.', 'error');
        return;
      }
      if (!response.ok || !payload || payload.ok !== true || !payload.data) throw new Error('lookup failed');
      renderResult(payload.data);
    } catch (_error) {
      setStatus('No pudimos consultar tus tickets ahora. Intenta más tarde.', 'error');
    } finally {
      setLoading(false);
    }
  });

  phoneInput.addEventListener('input', function () {
    phoneInput.value = digits(phoneInput.value).slice(0, 14);
    if (phoneError.textContent) validatePhone();
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy]');
    if (!button) return;
    handleCopy(button);
  });
})();
