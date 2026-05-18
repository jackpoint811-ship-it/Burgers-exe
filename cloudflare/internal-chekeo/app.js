(() => {
  const ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Listo'];
  const PAYMENT_STATUSES = ['Pendiente', 'Pagado'];
  const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Mixto', 'No definido'];

  const state = {
    loadingPanel: false,
    panelError: '',
    activeTab: 'inicio',
    orders: [],
    ordersSource: 'normalized',
    summary: null,
    health: null,
    bank: null,
    closePreview: null,
    historyPreview: null,
    productionValidation: null,
    migrationPreview: null,
    historyOrders: [],
    filter: 'Todos',
    loadingWrite: false,
  };

  let hasBootedInternalApp = false;
  const pinScreen = document.querySelector('#pin-screen');
  const internalApp = document.querySelector('#internal-app');
  const pinForm = document.querySelector('#pin-form');
  const pinInput = document.querySelector('#pin-input');
  const pinSubmit = document.querySelector('#pin-submit');
  const authStatus = document.querySelector('#auth-status');
  const modal = document.querySelector('#modal');
  const modalContent = document.querySelector('#modal-content');
  const confirmModal = document.querySelector('#confirm-modal');
  const confirmMessage = document.querySelector('#confirm-message');
  const confirmCancel = document.querySelector('#confirm-cancel');
  const confirmAccept = document.querySelector('#confirm-accept');

  const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const showAuthStatus = (m) => { if (authStatus) authStatus.textContent = m; };
  const setPinVisibility = (v) => pinScreen?.classList.toggle('is-hidden', !v);
  const setAppVisibility = (v) => internalApp?.classList.toggle('is-hidden', !v);

  function showToast(message, isError = false) {
    const t = document.querySelector('.status-toast');
    if (!t) return;
    t.textContent = message;
    t.classList.remove('is-hidden', 'is-error');
    if (isError) t.classList.add('is-error');
    window.setTimeout(() => t.classList.add('is-hidden'), 2200);
  }

  function setButtonsDisabled(disabled) {
    document.querySelectorAll('[data-write-action]').forEach((btn) => {
      btn.disabled = disabled;
      btn.classList.toggle('is-loading', disabled);
    });
  }

  function beginWrite(label) {
    state.loadingWrite = true;
    setButtonsDisabled(true);
    showToast(`Procesando: ${label}...`);
  }

  function endWrite() {
    state.loadingWrite = false;
    setButtonsDisabled(false);
  }

  async function confirmAction(message, action) {
    if (!confirmModal || !confirmAccept || !confirmCancel || !confirmMessage) {
      showToast('Error interno: modal de confirmación no disponible.', true);
      throw new Error('Confirm modal no disponible.');
    }

    confirmMessage.textContent = message;
    confirmModal.classList.remove('is-hidden');

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        confirmModal.classList.add('is-hidden');
        confirmAccept.onclick = null;
        confirmCancel.onclick = null;
        confirmAccept.disabled = false;
      };

      confirmAccept.onclick = async () => {
        if (settled) return;
        settled = true;
        confirmAccept.disabled = true;
        try {
          const result = await action();
          cleanup();
          resolve(result);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      confirmCancel.onclick = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      };
    });
  }

  async function rpcCall(method, args = []) {
    const r = await fetch('/api/rpc', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) });
    const d = await r.json().catch(() => null);
    if (r.status === 401) {
      setAppVisibility(false); setPinVisibility(true); showAuthStatus('Sesión expirada. Ingresa PIN nuevamente.');
      throw new Error('Sesión requerida.');
    }
    if (!r.ok || !d || d.ok !== true) throw new Error(d?.error?.message || 'Error de API.');
    return d;
  }

  async function checkSession() { const r = await fetch('/api/session', { method: 'GET', credentials: 'same-origin' }); const p = await r.json(); return Boolean(p?.ok && p?.data?.authenticated); }
  async function authenticateWithPin(pin) { const r = await fetch('/api/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); const p = await r.json(); return Boolean(r.ok && p?.ok && p?.data?.authenticated); }
  async function logoutSession() { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); }

  async function loadOperationalPanel() {
    state.loadingPanel = true;
    state.panelError = '';
    render();

    try {
      const [health, summary, bank, closePreview, historyPreview, productionValidation, migrationPreview] = await Promise.all([
        rpcCall('healthCheck'),
        rpcCall('getDailySummary'),
        rpcCall('getBankConfig'),
        rpcCall('getCloseDayPreview'),
        rpcCall('getHistoryPreview'),
        rpcCall('validateProductionReadiness'),
        rpcCall('getProductionMigrationPreview'),
      ]);

      let orders = [];
      let ordersSource = 'normalized';
      try {
        const normalizedOrders = await rpcCall('getNormalizedAppOrders', [{}]);
        orders = Array.isArray(normalizedOrders?.orders)
          ? normalizedOrders.orders
          : (Array.isArray(normalizedOrders?.data) ? normalizedOrders.data : []);
      } catch (normalizedError) {
        const legacyOrders = await rpcCall('getAppOrders');
        orders = Array.isArray(legacyOrders?.data) ? legacyOrders.data : [];
        ordersSource = 'legacy-fallback';
      }

      state.health = health?.data || null;
      state.orders = orders;
      state.ordersSource = ordersSource;
      state.summary = summary?.data || null;
      state.bank = bank?.data || null;
      state.closePreview = closePreview?.data || null;
      state.historyPreview = historyPreview?.data || null;
      state.productionValidation = productionValidation?.data || null;
      state.migrationPreview = migrationPreview?.data || null;
      state.panelError = '';
    } catch (error) {
      state.panelError = error?.message || 'No se pudo cargar el panel operativo.';
      renderPanelError();
      throw error;
    } finally {
      state.loadingPanel = false;
      render();
    }
  }

  async function runWrite(label, rpcMethod, args = [], confirmMessage) {
    if (state.loadingWrite) {
      showToast('Ya hay una acción en curso. Espera a que finalice.', true);
      return null;
    }

    return confirmAction(confirmMessage || `¿Confirmar acción: ${label}?`, async () => {
      beginWrite(label);
      try {
        const result = await rpcCall(rpcMethod, args);
        await loadOperationalPanel();
        showToast(`OK: ${label}`);
        return result;
      } catch (e) {
        showToast(e?.message || 'Error en operación', true);
        throw e;
      } finally {
        endWrite();
      }
    });
  }

  const refreshOrders = () => loadOperationalPanel();
  const changeOrderStatus = (orderId, nextStatus) => runWrite(`Cambiar estado a ${nextStatus}`, 'updateOrderStatus', [orderId, nextStatus]);
  const saveOrderOperationalData = (orderId, payload) => runWrite('Guardar cambios operativos', 'updateOrderOperationalData', [orderId, payload]);
  const updatePayment = (orderId, paymentStatus, paymentMethod) => runWrite('Actualizar pago', 'updateOrderPayment', [orderId, paymentStatus, paymentMethod]);
  const markPaid = (orderId) => runWrite('Marcar pagado', 'markOrderPaid', [orderId]);
  const markSideReady = (orderId) => runWrite('Marcar guarnición lista', 'markOrderSideReady', [orderId]);
  const saveNotes = (orderId, noteInternal, noteClient) => runWrite('Guardar notas', 'updateOrderNotes', [orderId, noteInternal, noteClient]);
  const markTicketSent = (orderId) => runWrite('Marcar ticket enviado', 'markTicketSent', [orderId]);
  const writeDailySummaryAction = () => runWrite('Guardar resumen diario operativo', 'writeDailySummary', [], '¿Guardar el resumen diario operativo? Esta acción escribirá el resumen en la hoja correspondiente.');
  const archiveCompletedOrdersAction = () => runWrite('Archivar pedidos completados', 'archiveCompletedOrders', [], '¿Archivar pedidos completados? Solo deben archivarse pedidos listos y pagados.');
  const closeDayAction = () => runWrite('Cerrar el día', 'closeDay', [], '¿Cerrar el día? Esta acción puede guardar resumen y archivar pedidos según la lógica existente. Revisa el preview antes de continuar.');

  async function openWhatsAppForOrder(orderId) {
    if (state.ordersSource === 'normalized') {
      showToast('WhatsApp pendiente migración para modo normalizado.', true);
      return;
    }
    const d = await rpcCall('getClientTicketData', [orderId]);
    const phone = String(d?.data?.phone || d?.data?.telefono || '').replace(/\D/g, '');
    const text = encodeURIComponent(d?.data?.message || d?.data?.mensaje || `Pedido ${orderId}`);
    if (!phone) return showToast('No hay teléfono para el pedido.', true);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener');
  }


  async function loadHistoryOrders(limit = 20) {
    const response = await rpcCall('getHistoryOrders', [limit]);
    state.historyOrders = Array.isArray(response?.data) ? response.data : [];
    renderOthers();
  }


  function renderPanelError() {
    const message = escape(state.panelError || 'No se pudo cargar el panel operativo.');
    const html = `<h2>Error de carga</h2><p class='empty-state'>${message}</p>`;
    ['pedidos-content', 'cocina-content', 'otros-content'].forEach((id) => {
      const node = document.querySelector(`#${id}`);
      if (node) node.innerHTML = html;
    });
  }

  function renderOrders() {
    const list = state.orders.map((o) => {
      const normalized = state.ordersSource === 'normalized';
      const id = escape(normalized ? (o.pedido_id || o.id || '') : (o['ID Pedido'] || o.id || ''));
      const folio = escape(normalized ? (o.folio || '-') : (o['ID Pedido'] || o.id || '-'));
      const customer = escape(normalized ? (o.cliente_nombre || 'Sin nombre') : (o['Nombre'] || 'Sin nombre'));
      const phone = escape(normalized ? (o.cliente_telefono || 'Sin teléfono') : (o['Telefono'] || o['Teléfono'] || 'Sin teléfono'));
      const total = escape(normalized ? (o.total || '0') : (o['Total'] || '0'));
      const status = escape(normalized ? (o.estado || '-') : (o['Estado Pedido'] || '-'));
      const paymentStatus = escape(normalized ? (o.payment?.estado_pago || 'Pendiente') : (o['Estado Pago'] || '-'));
      const burgerSummary = escape(normalized ? (o.kitchen?.burger_summary || 'Sin burgers') : '-');
      const guarnicionSummary = escape(normalized ? (o.kitchen?.guarnicion_summary || 'Sin guarniciones') : '-');
      const normalizedWriteState = normalized ? 'disabled title="Pendiente migración"' : '';
      const normalizedWriteLabel = normalized ? 'Pendiente migración' : 'Marcar pagado';
      const normalizedStatusLabel = normalized ? 'Pendiente migración' : 'Listo';
      const normalizedSideLabel = normalized ? 'Pendiente migración' : 'Guarnición lista';
      const whatsappLabel = normalized ? 'WhatsApp pendiente migración' : 'WhatsApp';
      return `<li class='order-item'><div><small>${folio}</small><p><strong>${customer}</strong></p><p>${phone}</p><p>Total: ${total}</p><small><span class='badge-status'>${status}</span> <span class='badge-payment'>${paymentStatus}</span></small><p>${burgerSummary}</p><p>${guarnicionSummary}</p></div>
      <div class='order-actions'>
      <button class='ghost' data-detail='${id}'>Detalle</button>
      <button class='ghost write-btn' data-write-action data-mark-paid='${id}' ${normalizedWriteState}>${normalizedWriteLabel}</button>
      <button class='ghost write-btn' data-write-action data-ready='${id}' ${normalizedWriteState}>${normalizedStatusLabel}</button>
      <button class='ghost write-btn' data-write-action data-side-ready='${id}' ${normalizedWriteState}>${normalizedSideLabel}</button>
      <button class='ghost' data-wa='${id}' ${normalized ? 'disabled title="Pendiente migración"' : ''}>${whatsappLabel}</button>
      </div></li>`;
    }).join('');
    const banner = state.ordersSource === 'legacy-fallback'
      ? `<p class='scope-banner'>Modo fallback legacy</p>`
      : `<p class='scope-banner'>Leyendo pedidos normalizados</p>`;
    const refreshLabel = state.ordersSource === 'normalized' ? 'Actualizar' : 'Sincronizar';
    document.querySelector('#pedidos-content').innerHTML = `<h2>Pedidos</h2>${banner}<button class='write-btn' id='sync-orders-btn'>${refreshLabel}</button><ul class='readonly-list'>${list}</ul>`;
  }

  function renderKitchen() {
    const normalized = state.ordersSource === 'normalized';
    const pending = state.orders.filter((o) => !String(normalized ? (o.estado || '') : (o['Estado Pedido'] || '')).toLowerCase().includes('listo'));
    document.querySelector('#cocina-content').innerHTML = `<h2>Cocina</h2><ul class='readonly-list'>${pending.map((o) => {
      const id = escape(normalized ? (o.pedido_id || '') : (o['ID Pedido'] || ''));
      if (!normalized) return `<li>${id} <button class='write-btn' data-write-action data-ready='${id}'>Marcar pedido Listo</button> <button class='write-btn' data-write-action data-side-ready='${id}'>Marcar guarnición lista</button></li>`;
      const burgers = Array.isArray(o.burgers) ? o.burgers : [];
      const burgerTickets = burgers.map((b) => `<li><strong>${escape(b.burger_base_id || 'burger')}</strong><p>Extras: ${escape((b.extras || []).join(', ') || 'Extras No')}</p><p>Sin: ${escape((b.sin_ingredientes || []).join(', ') || 'Sin cambios')}</p>${b.comentarios ? `<p>Comentario: ${escape(b.comentarios)}</p>` : ''}</li>`).join('');
      const pendingGuarniciones = Array.isArray(o.guarniciones)
        ? o.guarniciones.filter((g) => String(g?.estado_guarnicion || '').trim() !== 'Hecha').length
        : 0;
      return `<li><small>${escape(o.folio || '-')}</small><p><strong>${escape(o.cliente_nombre || 'Sin nombre')}</strong></p><p>${escape(o.kitchen?.burger_summary || 'Sin burgers')}</p><ul>${burgerTickets || '<li>Sin burgers</li>'}</ul><p>${escape(o.kitchen?.guarnicion_summary || 'Sin guarniciones')}</p><p>Pendientes guarniciones: ${escape(pendingGuarniciones)}</p><button class='write-btn' disabled title='Pendiente migración'>Marcar pedido Listo</button> <button class='write-btn' disabled title='Pendiente migración'>Marcar guarnición lista</button></li>`;
    }).join('')}</ul>`;
  }

  function renderOthers() {
    const closePreview = state.closePreview || {};
    const summary = state.summary || {};
    const historyPreview = state.historyPreview || {};
    const archivables = closePreview.archivables || closePreview.archiveableOrders || [];
    const noArchivables = closePreview.noArchivables || closePreview.nonArchiveableOrders || [];
    const totals = {
      total: closePreview.totalOrders ?? closePreview.total ?? 0,
      archivables: closePreview.archiveableCount ?? archivables.length ?? 0,
      noArchivables: closePreview.nonArchiveableCount ?? noArchivables.length ?? 0,
      alertas: closePreview.alertCount ?? closePreview.alertas ?? 0,
      readyPendingPay: closePreview.readyPendingPayment ?? closePreview.listosPendientePago ?? 0,
      paidNotReady: closePreview.paidNotReady ?? closePreview.pagadosNoListos ?? 0,
    };

    const historyOrdersList = state.historyOrders.length
      ? `<ul class='readonly-list history-loaded-list'>${state.historyOrders.map((o) => `<li><strong>${escape(o['ID Pedido'] || o.id || '-')}</strong><p>${escape(o['Nombre'] || o.name || '')}</p></li>`).join('')}</ul>`
      : `<p class='empty-state'>No hay histórico cargado aún.</p>`;

    document.querySelector('#otros-content').innerHTML = `
      <h2>Otros</h2>
      <section class='card close-section'>
        <h3>Cierre y resumen</h3>
        <div class='card-grid close-totals'>
          <article class='card'><h4>Total pedidos</h4><p>${escape(totals.total)}</p></article>
          <article class='card'><h4>Archivables</h4><p>${escape(totals.archivables)}</p></article>
          <article class='card'><h4>No archivables</h4><p>${escape(totals.noArchivables)}</p></article>
          <article class='card warning-card'><h4>Alertas</h4><p>${escape(totals.alertas)}</p></article>
          <article class='card'><h4>Listos pendiente pago</h4><p>${escape(totals.readyPendingPay)}</p></article>
          <article class='card'><h4>Pagados no listos</h4><p>${escape(totals.paidNotReady)}</p></article>
        </div>
        <div class='row'>
          <button class='write-btn critical-btn' data-write-action id='write-summary-btn'>Guardar resumen</button>
          <button class='write-btn critical-btn' data-write-action id='archive-completed-btn'>Archivar completados</button>
          <button class='write-btn critical-btn' data-write-action id='close-day-btn'>Cerrar día</button>
        </div>
      </section>

      <section class='card'>
        <h3>Archivables</h3>
        ${archivables.length ? `<ul class='readonly-list'>${archivables.map((o) => `<li>${escape(o['ID Pedido'] || o.id || '-')}</li>`).join('')}</ul>` : `<p class='empty-state'>No hay pedidos archivables por ahora.</p>`}
      </section>

      <section class='card'>
        <h3>No archivables</h3>
        ${noArchivables.length ? `<ul class='readonly-list'>${noArchivables.map((o) => `<li><strong>${escape(o['ID Pedido'] || o.id || '-')}</strong><p>${escape(o.reason || o.motivo || 'Sin motivo detallado')}</p></li>`).join('')}</ul>` : `<p class='empty-state'>No hay pedidos bloqueados para archivado.</p>`}
      </section>

      <section class='card'>
        <h3>Resumen diario operativo</h3>
        <pre>${escape(JSON.stringify(summary, null, 2))}</pre>
      </section>

      <section class='card'>
        <h3>Histórico</h3>
        <pre>${escape(JSON.stringify(historyPreview, null, 2))}</pre>
        <button class='ghost' id='load-history-orders-btn'>Cargar últimos 20 del histórico</button>
        ${historyOrdersList}
      </section>

      <section class='card diagnostic-section'>
        <h3>Diagnóstico avanzado</h3>
        <p class='scope-banner'>Preparación de estructura/producción queda para Fase 7.</p>
        <pre>${escape(JSON.stringify({ health: state.health, productionValidation: state.productionValidation, migrationPreview: state.migrationPreview }, null, 2))}</pre>
      </section>
    `;
  }

  function renderHome() {
    const loading = state.loadingPanel
      ? `<p class="scope-banner">Cargando panel operativo...</p>`
      : '';
    const err = state.panelError ? `<p class='empty-state'>${escape(state.panelError)}</p>` : '';
    document.querySelector('#inicio-content').innerHTML = `<h2>Inicio</h2>${loading}${err}<p>Fase 7 activa: hardening y QA final.</p>`;
  }
  function renderTabs() { document.querySelectorAll('[data-tab-target]').forEach((b) => b.classList.toggle('is-active', b.dataset.tabTarget === state.activeTab)); document.querySelectorAll('[data-tab-panel]').forEach((p) => p.classList.toggle('is-hidden', p.dataset.tabPanel !== state.activeTab)); }
  function render() { renderTabs(); renderHome(); renderOrders(); renderKitchen(); renderOthers(); }

  async function openOrderDetail(orderId) {
    if (state.ordersSource === 'normalized') {
      const d = await rpcCall('getNormalizedOrderDetail', [orderId]);
      const o = d?.pedido || {};
      const items = Array.isArray(o.items) ? o.items : [];
      const burgers = Array.isArray(o.burgers) ? o.burgers : [];
      const guarniciones = Array.isArray(o.guarniciones) ? o.guarniciones : [];
      const eventos = Array.isArray(d?.eventos) ? d.eventos : [];
      modalContent.innerHTML = `<h3>Detalle normalizado (solo lectura)</h3><p><strong>Pedido:</strong> ${escape(o.pedido_id || '-')} / ${escape(o.folio || '-')}</p><p><strong>Cliente:</strong> ${escape(o.cliente_nombre || '-')}</p><p><strong>Teléfono:</strong> ${escape(o.cliente_telefono || '-')}</p><p><strong>Total:</strong> ${escape(o.total || '0')}</p><p><strong>Estado:</strong> ${escape(o.estado || '-')}</p><p><strong>Método pago:</strong> ${escape(o.payment?.metodo_pago || o.metodo_pago || '-')}</p><h4>Items</h4><pre>${escape(JSON.stringify(items, null, 2))}</pre><h4>Burgers</h4><pre>${escape(JSON.stringify(burgers, null, 2))}</pre><h4>Guarniciones</h4><pre>${escape(JSON.stringify(guarniciones, null, 2))}</pre><h4>Eventos</h4><pre>${escape(JSON.stringify(eventos, null, 2))}</pre><div class='row'><button class='ghost' disabled title='Pendiente migración'>WhatsApp pendiente migración</button></div>`;
      modal.classList.remove('is-hidden');
      return;
    }
    const d = await rpcCall('getOrderDetail', [orderId]);
    const o = d?.data || {};
    modalContent.innerHTML = `<h3>Detalle operativo</h3><div class='form-grid'><label>Estado Pedido<select id='op-status'>${ORDER_STATUSES.map((s) => `<option ${s === o['Estado Pedido'] ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Estado Pago<select id='op-pay-status'>${PAYMENT_STATUSES.map((s) => `<option ${s === o['Estado Pago'] ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Método Pago<select id='op-pay-method'>${PAYMENT_METHODS.map((s) => `<option ${s === o['Método Pago'] ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Nota interna<textarea id='op-note-internal'>${escape(o['Nota Interna'] || '')}</textarea></label><label>Nota cliente<textarea id='op-note-client'>${escape(o['Nota Cliente'] || '')}</textarea></label></div><div class='row'><button class='write-btn' data-write-action id='save-op'>Guardar cambios operativos</button><button class='write-btn' data-write-action id='mark-paid-modal'>Marcar pagado</button><button class='ghost' id='wa-modal'>Abrir WhatsApp</button><button class='write-btn' data-write-action id='mark-ticket-modal'>Marcar ticket enviado</button></div>`;
    modal.classList.remove('is-hidden');
    document.querySelector('#save-op').onclick = async () => {
      const payload = {
        status: document.querySelector('#op-status').value,
        paymentStatus: document.querySelector('#op-pay-status').value,
        paymentMethod: document.querySelector('#op-pay-method').value,
        noteInternal: document.querySelector('#op-note-internal').value,
        noteClient: document.querySelector('#op-note-client').value,
      };
      await saveOrderOperationalData(orderId, payload);
    };
    document.querySelector('#mark-paid-modal').onclick = () => markPaid(orderId);
    document.querySelector('#wa-modal').onclick = () => openWhatsAppForOrder(orderId);
    document.querySelector('#mark-ticket-modal').onclick = () => markTicketSent(orderId);
  }

  function initScaffold() {
    document.querySelectorAll('[data-tab-target]').forEach((b) => b.addEventListener('click', () => { state.activeTab = b.dataset.tabTarget; render(); }));
    document.body.addEventListener('click', async (e) => {
      const sync = e.target.closest('#sync-orders-btn'); if (sync) return refreshOrders();
      const detail = e.target.closest('[data-detail]'); if (detail) return openOrderDetail(detail.dataset.detail);
      const markPaidBtn = e.target.closest('[data-mark-paid]'); if (markPaidBtn) return markPaid(markPaidBtn.dataset.markPaid);
      const ready = e.target.closest('[data-ready]'); if (ready) return changeOrderStatus(ready.dataset.ready, 'Listo');
      const sideReady = e.target.closest('[data-side-ready]'); if (sideReady) return markSideReady(sideReady.dataset.sideReady);
      const wa = e.target.closest('[data-wa]'); if (wa) return openWhatsAppForOrder(wa.dataset.wa);
      const writeSummary = e.target.closest('#write-summary-btn'); if (writeSummary) return writeDailySummaryAction();
      const archiveCompleted = e.target.closest('#archive-completed-btn'); if (archiveCompleted) return archiveCompletedOrdersAction();
      const closeDayBtn = e.target.closest('#close-day-btn'); if (closeDayBtn) return closeDayAction();
      const loadHistoryBtn = e.target.closest('#load-history-orders-btn'); if (loadHistoryBtn) return loadHistoryOrders(20);
    });
    document.querySelector('#modal-close')?.addEventListener('click', () => modal.classList.add('is-hidden'));
    document.querySelector('#logout-button')?.addEventListener('click', async () => { await logoutSession(); setAppVisibility(false); setPinVisibility(true); showAuthStatus('Sesión cerrada.'); });
  }

  function bootInternalAppOnce() {
    if (hasBootedInternalApp) return;
    initScaffold();
    hasBootedInternalApp = true;
    loadOperationalPanel().catch(() => {});
  }

  pinForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pin = pinInput?.value?.trim() || '';
    pinSubmit.disabled = true;
    showAuthStatus('Validando...');
    try {
      const ok = await authenticateWithPin(pin);
      if (!ok) return showAuthStatus('PIN inválido.');
      pinInput.value = '';
      setPinVisibility(false); setAppVisibility(true); bootInternalAppOnce();
    } finally { pinSubmit.disabled = false; }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const authenticated = await checkSession().catch(() => false);
    if (authenticated) { setPinVisibility(false); setAppVisibility(true); bootInternalAppOnce(); }
    else { setAppVisibility(false); setPinVisibility(true); }
  });
})();
