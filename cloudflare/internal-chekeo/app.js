(() => {
  const state = { activeTab: 'inicio' };
  let hasBootedInternalApp = false;

  const pinScreen = document.querySelector('#pin-screen');
  const internalApp = document.querySelector('#internal-app');
  const pinForm = document.querySelector('#pin-form');
  const pinInput = document.querySelector('#pin-input');
  const pinSubmit = document.querySelector('#pin-submit');
  const authStatus = document.querySelector('#auth-status');
  const logoutButton = document.querySelector('#logout-button');

  function showAuthStatus(message) { if (authStatus) authStatus.textContent = message; }
  function setPinVisibility(visible) { pinScreen?.classList.toggle('is-hidden', !visible); }
  function setAppVisibility(visible) { internalApp?.classList.toggle('is-hidden', !visible); }

  async function checkSession() {
    const response = await fetch('/api/session', { method: 'GET', credentials: 'same-origin' });
    const payload = await response.json();
    return Boolean(payload?.ok && payload?.data?.authenticated);
  }

  async function authenticateWithPin(pin) {
    const response = await fetch('/api/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
    const payload = await response.json();
    return Boolean(response.ok && payload?.ok && payload?.data?.authenticated);
  }

  async function logoutSession() { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); }

  function showToast(message) {
    const toast = document.querySelector('.status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('is-hidden');
    window.setTimeout(() => toast.classList.add('is-hidden'), 1800);
  }

  async function rpcCall(method, args = []) {
    const response = await fetch('/api/rpc', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args })
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) {
      setAppVisibility(false); setPinVisibility(true); showAuthStatus('Sesión expirada. Ingresa PIN nuevamente.');
      throw new Error('Sesión requerida.');
    }
    if (!response.ok || !data || data.ok !== true) {
      const message = data && data.error && data.error.message ? data.error.message : 'Error de API.';
      throw new Error(message);
    }
    return data;
  }

  function renderTabs() {
    document.querySelectorAll('[data-tab-target]').forEach((button) => button.classList.toggle('is-active', button.dataset.tabTarget === state.activeTab));
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.tabPanel !== state.activeTab));
  }

  function setActiveTab(nextTab) { if (nextTab && nextTab !== state.activeTab) { state.activeTab = nextTab; renderTabs(); } }
  function setText(id, text) { const el = document.querySelector(id); if (el) el.textContent = text; }

  function renderReadOnlySnapshot(snapshot) {
    const health = snapshot.health?.data || {};
    const orders = Array.isArray(snapshot.orders?.data) ? snapshot.orders.data : [];
    const summary = snapshot.summary?.data || {};
    const bank = snapshot.bank?.data || {};

    setText('#health-readonly', `Backend OK · Entorno: ${health.activeEnvironment || 'N/D'} · Hoja: ${health.activeSheet || 'N/D'}`);
    setText('#summary-readonly', `Pedidos activos: ${orders.length} · Resumen diario cargado: ${Object.keys(summary).length > 0 ? 'Sí' : 'No'}`);
    setText('#bank-readonly', `Config bancaria disponible: ${Object.keys(bank).length > 0 ? 'Sí' : 'No'}`);

    const ordersNode = document.querySelector('#orders-readonly');
    if (ordersNode) {
      if (!orders.length) {
        ordersNode.innerHTML = '<li class="empty-state">No hay pedidos activos para mostrar.</li>';
      } else {
        ordersNode.innerHTML = orders.slice(0, 20).map((order) => {
          const id = order['ID Pedido'] || order.id || 'Sin ID';
          const status = order['Estado Pedido'] || order.status || 'Sin estado';
          return `<li><strong>${id}</strong><span>${status}</span></li>`;
        }).join('');
      }
    }

    const kitchenNode = document.querySelector('#kitchen-readonly');
    if (kitchenNode) {
      const pending = orders.filter((order) => {
        const status = String(order['Estado Pedido'] || order.status || '').toLowerCase();
        return status && !status.includes('listo');
      });
      kitchenNode.textContent = pending.length ? `Preview cocina: ${pending.length} pedidos pendientes de estado "listo".` : 'Preview cocina: sin pendientes visibles.';
    }
  }

  async function loadReadOnlySnapshot() {
    showToast('Cargando datos read-only…');
    try {
      const [health, orders, summary, bank] = await Promise.all([
        rpcCall('healthCheck'), rpcCall('getAppOrders'), rpcCall('getDailySummary'), rpcCall('getBankConfig'),
      ]);
      renderReadOnlySnapshot({ health, orders, summary, bank });
      showToast('Datos cargados.');
    } catch (err) {
      setText('#health-readonly', 'No se pudo cargar estado backend.');
      setText('#summary-readonly', 'Sin resumen disponible.');
      setText('#bank-readonly', 'Sin configuración bancaria disponible.');
      const ordersNode = document.querySelector('#orders-readonly');
      if (ordersNode) ordersNode.innerHTML = '<li class="empty-state">No hay datos disponibles.</li>';
      const kitchenNode = document.querySelector('#kitchen-readonly');
      if (kitchenNode) kitchenNode.textContent = 'Preview cocina no disponible.';
      showToast(err?.message || 'Error de API.');
    }
  }

  function initScaffold() {
    document.querySelectorAll('[data-tab-target]').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget)));
    logoutButton?.addEventListener('click', async () => { await logoutSession(); setAppVisibility(false); setPinVisibility(true); showAuthStatus('Sesión cerrada.'); });
    renderTabs();
  }

  function bootInternalAppOnce() {
    if (hasBootedInternalApp) return;
    initScaffold();
    hasBootedInternalApp = true;
    loadReadOnlySnapshot();
  }

  async function handlePinSubmit(event) {
    event.preventDefault();
    const pin = pinInput?.value?.trim() || '';
    pinSubmit.disabled = true;
    showAuthStatus('Validando…');
    try {
      const ok = await authenticateWithPin(pin);
      if (!ok) return showAuthStatus('PIN inválido. Intenta de nuevo.');
      if (pinInput) pinInput.value = '';
      showAuthStatus(''); setPinVisibility(false); setAppVisibility(true); bootInternalAppOnce();
    } catch { showAuthStatus('PIN inválido. Intenta de nuevo.'); }
    finally { pinSubmit.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    pinForm?.addEventListener('submit', handlePinSubmit);
    try {
      const authenticated = await checkSession();
      if (authenticated) { setPinVisibility(false); setAppVisibility(true); bootInternalAppOnce(); return; }
    } catch {}
    setAppVisibility(false); setPinVisibility(true);
  });
})();
