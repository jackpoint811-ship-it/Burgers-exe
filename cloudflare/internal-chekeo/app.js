(() => {
  const ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Listo'];
  const NORMALIZED_ORDER_STATUSES = ['Nuevo', 'Confirmado', 'Preparando', 'Preparada', 'Cancelado', 'Completado'];
  const PAYMENT_STATUSES = ['Pendiente', 'Pagado'];
  const NORMALIZED_PAYMENT_STATUSES = ['Pendiente', 'Pagado', 'Parcial', 'Cancelado'];
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
    normalizedClosePreview: null,
    normalizedCloseArchiveResult: null,
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
      let normalizedClosePreview = null;
      try {
        const normalizedOrders = await rpcCall('getNormalizedAppOrders', [{}]);
        orders = Array.isArray(normalizedOrders?.orders)
          ? normalizedOrders.orders
          : (Array.isArray(normalizedOrders?.data) ? normalizedOrders.data : []);
        try {
          const normalizedCloseResult = await rpcCall('previewNormalizedCloseDay');
          normalizedClosePreview = normalizedCloseResult?.data || normalizedCloseResult || null;
        } catch (closePreviewError) {
          normalizedClosePreview = {
            warning: true,
            message: closePreviewError?.message || 'No se pudo cargar el preview de cierre normalizado.'
          };
        }
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
      state.normalizedClosePreview = ordersSource === 'normalized' ? normalizedClosePreview : null;
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
        const data = result?.data || result || {};
        if (data.blocked) {
          const blockers = Array.isArray(data.blockers) ? data.blockers.join(', ') : '';
          showToast(`Bloqueado: ${blockers || data.message || 'Operación bloqueada'}`, true);
        } else {
          showToast(data.unchanged ? `Sin cambios: ${label}` : `OK: ${label}`);
        }
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
  const isNormalizedMode = () => state.ordersSource === 'normalized';
  const changeNormalizedOrderStatus = (orderId, nextStatus) => runWrite(`Cambiar estado a ${nextStatus}`, 'updateNormalizedOrderStatus', [orderId, nextStatus, 'chekeo-2-ui']);
  const markNormalizedPaid = (orderId) => runWrite('Marcar pagado', 'markNormalizedOrderPaid', [orderId, 'chekeo-2-ui']);
  const markNormalizedSideDone = (orderIdOrGuarnicionId) => runWrite('Marcar guarnición hecha', 'updateNormalizedGuarnicionStatus', [orderIdOrGuarnicionId, 'Hecha', 'chekeo-2-ui']);
  const markNormalizedSidesPreparing = (orderId) => runWrite('Guarniciones preparando', 'updateNormalizedGuarnicionStatus', [orderId, 'Preparando', 'chekeo-2-ui']);
  const markNormalizedBurgersPreparing = (orderId) => runWrite('Burgers preparando', 'updateNormalizedBurgerStatus', [orderId, 'Preparando', 'chekeo-2-ui']);
  const markNormalizedBurgersReady = (orderId) => runWrite('Burgers listas', 'updateNormalizedBurgerStatus', [orderId, 'Lista', 'chekeo-2-ui']);
  const completeNormalizedReadyOrder = (orderId) => runWrite('Marcar como preparada', 'completeNormalizedOrderIfReady', [orderId, 'chekeo-2-ui']);
  const markNormalizedDelivered = (orderId) => runWrite('Marcar entregada', 'markNormalizedOrderDelivered', [orderId, 'chekeo-2-ui']);
  const saveNormalizedNotes = (orderId, notaInterna, notaCliente) => runWrite('Guardar notas', 'updateNormalizedOrderNotes', [orderId, notaInterna, notaCliente, 'chekeo-2-ui']);
  const markNormalizedTicketSentUi = (orderId) => runWrite('Marcar ticket enviado', 'markNormalizedTicketSent', [orderId, 'chekeo-2-ui']);
  const updateNormalizedPayment = (orderId, estadoPago, metodoPago) => runWrite('Actualizar pago', 'updateNormalizedPaymentStatus', [orderId, estadoPago, metodoPago, 'chekeo-2-ui']);
  const changeOrderStatus = (orderId, nextStatus) => isNormalizedMode() ? changeNormalizedOrderStatus(orderId, nextStatus) : runWrite(`Cambiar estado a ${nextStatus}`, 'updateOrderStatus', [orderId, nextStatus]);
  const saveOrderOperationalData = (orderId, payload) => runWrite('Guardar cambios operativos', 'updateOrderOperationalData', [orderId, payload]);
  const updatePayment = (orderId, paymentStatus, paymentMethod) => isNormalizedMode() ? updateNormalizedPayment(orderId, paymentStatus, paymentMethod) : runWrite('Actualizar pago', 'updateOrderPayment', [orderId, paymentStatus, paymentMethod]);
  const markPaid = (orderId) => isNormalizedMode() ? markNormalizedPaid(orderId) : runWrite('Marcar pagado', 'markOrderPaid', [orderId]);
  const markSideReady = (orderId) => isNormalizedMode() ? markNormalizedSideDone(orderId) : runWrite('Marcar guarnición lista', 'markOrderSideReady', [orderId]);
  const saveNotes = (orderId, noteInternal, noteClient) => isNormalizedMode() ? saveNormalizedNotes(orderId, noteInternal, noteClient) : runWrite('Guardar notas', 'updateOrderNotes', [orderId, noteInternal, noteClient]);
  const markTicketSent = (orderId) => isNormalizedMode() ? markNormalizedTicketSentUi(orderId) : runWrite('Marcar ticket enviado', 'markTicketSent', [orderId]);
  const showCloseHistoryPending = () => {
    showToast('Cierre/histórico pendiente migración en modo normalizado.', true);
    return null;
  };
  const archiveNormalizedCloseDayAction = () => runWrite('Archivar cierre en Drive', 'archiveNormalizedCloseDayToDrive', [], '¿Archivar cierre en Drive para pedidos finalizados nuevos?').then((result) => {
    state.normalizedCloseArchiveResult = result?.data || result || null;
    render();
    return result;
  });
  const writeDailySummaryAction = () => state.ordersSource === 'legacy-fallback' ? runWrite('Guardar resumen diario operativo', 'writeDailySummary', [], '¿Guardar el resumen diario operativo? Esta acción escribirá el resumen en la hoja correspondiente.') : showCloseHistoryPending();
  const archiveCompletedOrdersAction = () => state.ordersSource === 'legacy-fallback' ? runWrite('Archivar pedidos completados', 'archiveCompletedOrders', [], '¿Archivar pedidos completados? Solo deben archivarse pedidos listos y pagados.') : showCloseHistoryPending();
  const closeDayAction = () => state.ordersSource === 'legacy-fallback' ? runWrite('Cerrar el día', 'closeDay', [], '¿Cerrar el día? Esta acción puede guardar resumen y archivar pedidos según la lógica existente. Revisa el preview antes de continuar.') : showCloseHistoryPending();

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

  function getPendingGuarniciones(order) {
    if (Number.isFinite(Number(order?.pending_guarniciones))) return Number(order.pending_guarniciones);
    if (Number.isFinite(Number(order?.kitchen?.pending_guarniciones))) return Number(order.kitchen.pending_guarniciones);
    if (Array.isArray(order?.guarniciones)) return order.guarniciones.filter((g) => String(g?.estado_guarnicion || '').trim() !== 'Hecha').length;
    return 0;
  }

  function hasGuarniciones(order) {
    if (Array.isArray(order?.guarniciones)) return order.guarniciones.length > 0;
    return getPendingGuarniciones(order) > 0 || Boolean(order?.kitchen?.guarnicion_summary && order.kitchen.guarnicion_summary !== 'Sin guarniciones');
  }

  function renderNormalizedOrderActions(o, id, status, paymentStatus) {
    const statusActions = {
      Nuevo: ['Confirmar', 'Confirmado'],
      Confirmado: ['Preparando', 'Preparando'],
    };
    const statusAction = statusActions[status] || null;
    const statusButton = statusAction
      ? `<button class='ghost write-btn' data-write-action data-order-status='${id}' data-next-status='${escape(statusAction[1])}'>${escape(statusAction[0])}</button>`
      : `<button class='ghost write-btn' disabled>${escape(status || 'Estado')}</button>`;
    const paidButton = paymentStatus === 'Pagado'
      ? `<button class='ghost write-btn' disabled>Pagado</button>`
      : `<button class='ghost write-btn' data-write-action data-mark-paid='${id}'>Pagado</button>`;
    const productionState = o.production?.estado_produccion || o.estado_produccion || (o.estado === 'Listo' ? 'Preparada' : 'Pendiente');
    const ready = Boolean(o.production?.production_ready || o.production?.order_ready);
    const completeButton = productionState === 'Preparada'
      ? `<button class='ghost write-btn' disabled>Producción preparada</button>`
      : (ready ? `<button class='ghost write-btn' data-write-action data-complete-order='${id}'>Marcar como preparada</button>` : `<button class='ghost write-btn' disabled title='${escape((o.production?.blockers || []).join(', ') || 'Faltan pasos')}'>Faltan pasos</button>`);
    return `${paidButton}${statusButton}${completeButton}`;
  }

  function renderOrders() {
    const list = state.orders.map((o) => {
      const normalized = state.ordersSource === 'normalized';
      const id = escape(normalized ? (o.pedido_id || o.id || '') : (o['ID Pedido'] || o.id || ''));
      const folio = escape(normalized ? (o.folio || '-') : (o['ID Pedido'] || o.id || '-'));
      const customer = escape(normalized ? (o.cliente_nombre || 'Sin nombre') : (o['Nombre'] || 'Sin nombre'));
      const phone = escape(normalized ? (o.cliente_telefono || 'Sin teléfono') : (o['Telefono'] || o['Teléfono'] || 'Sin teléfono'));
      const total = escape(normalized ? (o.total || '0') : (o['Total'] || '0'));
      const rawStatus = normalized ? (o.estado || '-') : (o['Estado Pedido'] || '-');
      const rawPaymentStatus = normalized ? (o.payment?.estado_pago || o.estado_pago || 'Pendiente') : (o['Estado Pago'] || '-');
      const status = escape(rawStatus);
      const paymentStatus = escape(rawPaymentStatus);
      const burgerSummary = escape(normalized ? (o.kitchen?.burger_summary || 'Sin burgers') : '-');
      const guarnicionSummary = escape(normalized ? (o.kitchen?.guarnicion_summary || 'Sin guarniciones') : '-');
      const ticketEnviado = normalized && (String(o.ticket_enviado).toLowerCase() === 'true' || o.ticket_enviado === true);
      const ticketBadge = ticketEnviado ? ` <span class='badge-payment'>Ticket enviado</span>` : '';
      const productionState = normalized ? (o.production?.estado_produccion || o.estado_produccion || (o.estado === 'Listo' ? 'Preparada' : 'Pendiente')) : rawStatus;
      const paymentState = normalized ? (o.payment?.estado_pago || o.estado_pago || 'Pendiente') : rawPaymentStatus;
      const deliveryState = normalized ? (o.delivery?.estado_entrega || o.estado_entrega || 'Pendiente') : 'Pendiente';
      const finalized = normalized ? Boolean(o.finalization?.finalized) : false;
      const operationalActions = normalized
        ? renderNormalizedOrderActions(o, id, rawStatus, rawPaymentStatus)
        : `<button class='ghost write-btn' data-write-action data-mark-paid='${id}'>Marcar pagado</button><button class='ghost write-btn' data-write-action data-ready='${id}'>Listo</button><button class='ghost write-btn' data-write-action data-side-ready='${id}'>Guarnición lista</button>`;
      const whatsappLabel = normalized ? 'WhatsApp pendiente' : 'WhatsApp';
      const prod = o.production || {};
      const prodBadges = normalized ? `<p>Producción: ${escape(productionState)}</p><p>Pago: ${escape(paymentState)}</p><p>Entrega: ${escape(deliveryState)}</p><p>Finalización: ${finalized ? 'Finalizada' : 'Pendiente'}</p><p>Burgers: ${escape(`${prod.burgers_listas || 0}/${prod.burgers_total || 0} listas`)}</p><p>Guarniciones: ${prod.guarniciones_total ? escape(`${prod.guarniciones_hechas || 0}/${prod.guarniciones_total || 0} hechas`) : 'Sin guarniciones'}</p>` : '';
      let processActions = '';
      if (normalized) {
        if (finalized) processActions = `<button class='ghost write-btn' disabled>Finalizada</button>`;
        else if (productionState === 'Preparada' && paymentState === 'Pagado' && deliveryState !== 'Entregada') processActions = `<button class='ghost write-btn' data-write-action data-mark-delivered='${id}'>Marcar entregada</button>`;
        else if (productionState === 'Preparada' && paymentState !== 'Pagado') processActions = `<button class='ghost write-btn' disabled>Pendiente de pago</button>`;
        else if (paymentState === 'Pagado' && productionState !== 'Preparada') processActions = `<button class='ghost write-btn' disabled>Pendiente de cocina</button>`;
      }
      return `<li class='order-item'><div><small>${folio}</small><p><strong>${customer}</strong></p><p>${phone}</p><p>Total: ${total}</p><small><span class='badge-status'>${status}</span> <span class='badge-payment'>${paymentStatus}</span>${ticketBadge}</small><p>${burgerSummary}</p><p>${guarnicionSummary}</p>${prodBadges}</div>
      <div class='order-actions'>
      <button class='ghost' data-detail='${id}'>Detalle</button>
      ${operationalActions}
      ${processActions}
      <button class='ghost' data-wa='${id}' ${normalized ? 'disabled title="Pendiente migración"' : ''}>${whatsappLabel}</button>
      </div></li>`;
    }).join('');
    const banner = state.ordersSource === 'legacy-fallback'
      ? `<p class='scope-banner'>Modo fallback legacy</p>`
      : `<p class='scope-banner'>Modo normalizado activo</p>`;
    document.querySelector('#pedidos-content').innerHTML = `<h2>Pedidos</h2>${banner}<button class='write-btn' id='sync-orders-btn'>Actualizar</button><ul class='readonly-list'>${list}</ul>`;
  }

  function renderKitchen() {
    const normalized = state.ordersSource === 'normalized';
    const pending = state.orders.filter((o) => {
      if (!normalized) return !String(o['Estado Pedido'] || '').toLowerCase().includes('listo');
      const productionState = o.production?.estado_produccion || o.estado_produccion || (o.estado === 'Listo' ? 'Preparada' : 'Pendiente');
      return productionState !== 'Preparada';
    });
    if (!normalized) {
      document.querySelector('#cocina-content').innerHTML = `<h2>Cocina</h2><ul class='readonly-list'>${pending.map((o) => {
        const id = escape(o['ID Pedido'] || '');
        return `<li>${id} <button class='write-btn' data-write-action data-ready='${id}'>Marcar pedido Listo</button> <button class='write-btn' data-write-action data-side-ready='${id}'>Marcar guarnición lista</button></li>`;
      }).join('')}</ul>`;
      return;
    }
    const burgerOrders = pending.filter((o) => (Number(o?.production?.burgers_total) || 0) > 0);
    const burgerTickets = burgerOrders.map((o) => {
      const id = escape(o.pedido_id || '');
      const burgers = Array.isArray(o.burgers) ? o.burgers : [];
      const lines = burgers.map((b) => `<li><strong>${escape(b.burger_base_id || 'burger')}</strong> <span class='badge-status'>${escape(b.estado_burger || 'Pendiente')}</span><p>Extras: ${escape((b.extras || []).join(', ') || 'Extras No')}</p><p>Sin: ${escape((b.sin_ingredientes || []).join(', ') || 'Sin cambios')}</p>${b.comentarios ? `<p>Comentario: ${escape(b.comentarios)}</p>` : ''}</li>`).join('');
      return `<li><small>${escape(o.folio || '-')}</small><p><strong>${escape(o.cliente_nombre || 'Sin nombre')}</strong></p><p><span class='badge-status'>${escape(o.estado || '-')}</span></p><p>${escape((o.production?.burgers_listas || 0) + '/' + (o.production?.burgers_total || 0))} listas</p><ul>${lines || '<li>Sin burgers</li>'}</ul><div class='row'><button class='write-btn' data-write-action data-burgers-preparing='${id}'>Burgers preparando</button><button class='write-btn' data-write-action data-burgers-ready='${id}' ${o.production?.burgers_ready ? 'disabled' : ''}>Burgers listas</button></div></li>`;
    }).join('');
    const guarnicionOrders = pending.filter((o) => hasGuarniciones(o));
    const guarnicionTickets = guarnicionOrders.map((o) => {
      const id = escape(o.pedido_id || '');
      const guas = Array.isArray(o.guarniciones) ? o.guarniciones : [];
      const lines = guas.map((g) => `<li><strong>${escape(g.producto_id || 'Guarnición')}</strong> x${escape(g.cantidad || 0)} <span class='badge-status'>${escape(g.estado_guarnicion || 'Pendiente')}</span></li>`).join('');
      return `<li><small>${escape(o.folio || '-')}</small><p><strong>${escape(o.cliente_nombre || 'Sin nombre')}</strong></p><p>${escape((o.production?.guarniciones_hechas || 0) + '/' + (o.production?.guarniciones_total || 0))} hechas</p><ul>${lines || '<li>Sin guarniciones</li>'}</ul><div class='row'><button class='write-btn' data-write-action data-guarniciones-preparing='${id}'>Guarniciones preparando</button><button class='write-btn' data-write-action data-guarniciones-ready='${id}' ${(o.production?.guarniciones_ready) ? 'disabled' : ''}>Guarniciones hechas</button></div></li>`;
    }).join('');
    const readyOrders = pending.filter((o) => (o.production?.production_ready || o.production?.order_ready) && (o.production?.estado_produccion || o.estado_produccion || (o.estado === 'Listo' ? 'Preparada' : 'Pendiente')) !== 'Preparada');
    const readyTickets = readyOrders.map((o) => {
      const productionState = o.production?.estado_produccion || o.estado_produccion || (o.estado === 'Listo' ? 'Preparada' : 'Pendiente');
      return `<li><small>${escape(o.folio || '-')}</small><p><strong>${escape(o.cliente_nombre || 'Sin nombre')}</strong></p><p><span class='badge-status'>Burgers ${o.production?.burgers_ready ? 'OK' : 'Pendientes'}</span> <span class='badge-status'>Guarniciones ${o.production?.guarniciones_ready ? 'OK' : 'Pendientes'}</span> <span class='badge-status'>Producción ${escape(productionState)}</span></p><button class='write-btn' data-write-action data-complete-order='${escape(o.pedido_id || '')}'>Marcar como preparada</button></li>`;
    }).join('');
    document.querySelector('#cocina-content').innerHTML = `<h2>Cocina</h2>
      <h3>Burgers</h3>${burgerTickets ? `<ul class='readonly-list'>${burgerTickets}</ul>` : `<p class='empty-state'>No hay burgers pendientes.</p>`}
      <h3>Guarniciones</h3>${guarnicionTickets ? `<ul class='readonly-list'>${guarnicionTickets}</ul>` : `<p class='empty-state'>No hay guarniciones.</p>`}
      <h3>Listas para marcar preparadas</h3>${readyTickets ? `<ul class='readonly-list'>${readyTickets}</ul>` : `<p class='empty-state'>Sin órdenes listas para marcar preparadas.</p>`}`;
  }

  function renderOthers() {
    const closePreview = state.closePreview || {};
    const summary = state.summary || {};
    const historyPreview = state.historyPreview || {};
    const normalizedClosePreview = state.normalizedClosePreview || {};
    const archiveResult = state.normalizedCloseArchiveResult || null;
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

    const normalizedFinalized = Array.isArray(normalizedClosePreview.finalizedOrders) ? normalizedClosePreview.finalizedOrders : [];
    const normalizedBlocked = Array.isArray(normalizedClosePreview.blockedOrders) ? normalizedClosePreview.blockedOrders : [];
    const normalizedArchived = Array.isArray(normalizedClosePreview.alreadyArchivedOrders) ? normalizedClosePreview.alreadyArchivedOrders : [];
    const normalizedTotals = normalizedClosePreview.totals || {};
    const normalizedHasWarning = Boolean(normalizedClosePreview.warning);
    const normalizedCloseActions = `<button class='write-btn critical-btn' data-write-action id='archive-normalized-close-btn' ${Number(normalizedClosePreview.finalizedCount || 0) > 0 ? '' : 'disabled'}>Archivar cierre en Drive</button>`;
    const archiveResultLinks = archiveResult
      ? `<div class='card'><h4>Resultado último archivo</h4><p><strong>corte_id:</strong> ${escape(archiveResult.corte_id || '-')}</p>
        ${archiveResult.drive_folder_url ? `<p><a href='${escape(archiveResult.drive_folder_url)}' target='_blank' rel='noopener'>Ver carpeta Drive</a></p>` : ''}
        ${archiveResult.drive_summary_file_url ? `<p><a href='${escape(archiveResult.drive_summary_file_url)}' target='_blank' rel='noopener'>Ver resumen JSON</a></p>` : ''}
        <p><strong>archived:</strong> ${escape(String(Boolean(archiveResult.archived)))}</p>
        <p><strong>duplicate:</strong> ${escape(String(Boolean(archiveResult.duplicate)))}</p>
        <p>${escape(archiveResult.message || (archiveResult.archived ? 'Cierre archivado en Drive.' : ((archiveResult.alreadyArchivedCount || 0) > 0 ? 'Sin pedidos finalizados nuevos para archivar.' : 'Sin cambios en el archivo.')))}</p></div>`
      : '';

    const normalizedCloseSection = `
      <section class='card close-section'>
        <h3>Cierre Drive-first</h3>
        ${normalizedHasWarning ? `<p class='empty-state'>${escape(normalizedClosePreview.message || 'No se pudo cargar el preview normalizado de cierre.')}</p>` : ''}
        <div class='card-grid close-totals'>
          <article class='card'><h4>Fecha corte</h4><p>${escape(normalizedClosePreview.fecha_corte || '-')}</p></article>
          <article class='card'><h4>Total pedidos</h4><p>${escape(normalizedClosePreview.total_pedidos ?? 0)}</p></article>
          <article class='card'><h4>Finalizados nuevos</h4><p>${escape(normalizedClosePreview.finalizedCount ?? 0)}</p></article>
          <article class='card'><h4>Bloqueados</h4><p>${escape(normalizedClosePreview.blockedCount ?? 0)}</p></article>
          <article class='card'><h4>Ya archivados</h4><p>${escape(normalizedClosePreview.alreadyArchivedCount ?? 0)}</p></article>
          <article class='card'><h4>Total vendido</h4><p>${escape(normalizedTotals.total_vendido ?? 0)}</p></article>
          <article class='card'><h4>Total burgers</h4><p>${escape(normalizedTotals.total_burgers ?? 0)}</p></article>
          <article class='card'><h4>Total guarniciones</h4><p>${escape(normalizedTotals.total_guarniciones ?? 0)}</p></article>
        </div>
        <div class='row'>${normalizedCloseActions}</div>
        ${archiveResultLinks}
      </section>

      <section class='card'>
        <h3>Finalizados nuevos</h3>
        ${normalizedFinalized.length ? `<ul class='readonly-list'>${normalizedFinalized.map((o) => `<li><strong>${escape(o.folio || o.pedido_id || '-')}</strong><p>${escape(o.cliente_nombre || 'Sin nombre')}</p><p>Total: ${escape(o.total || 0)} | Producción: ${escape(o.estado_produccion || '-')} | Pago: ${escape(o.estado_pago || '-')} | Entrega: ${escape(o.estado_entrega || '-')}</p></li>`).join('')}</ul>` : `<p class='empty-state'>Sin pedidos finalizados nuevos</p>`}
      </section>

      <section class='card'>
        <h3>Bloqueados</h3>
        ${normalizedBlocked.length ? `<ul class='readonly-list'>${normalizedBlocked.map((o) => `<li><strong>${escape(o.folio || o.pedido_id || '-')}</strong><p>${escape(Array.isArray(o.blockers) ? o.blockers.join(', ') : '-')}</p></li>`).join('')}</ul>` : `<p class='empty-state'>No hay pedidos bloqueados.</p>`}
      </section>

      <section class='card'>
        <h3>Ya archivados</h3>
        ${normalizedArchived.length ? `<ul class='readonly-list'>${normalizedArchived.map((o) => `<li><strong>${escape(o.folio || o.pedido_id || '-')}</strong><p>${escape(o.archived_event_id_or_timestamp || '-')}</p></li>`).join('')}</ul>` : `<p class='empty-state'>No hay pedidos ya archivados.</p>`}
      </section>`;

    const legacyCloseSection = `
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
      </section>`;

    document.querySelector('#otros-content').innerHTML = `
      <h2>Otros</h2>
      ${isNormalizedMode() ? normalizedCloseSection : legacyCloseSection}

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
        <p class='scope-banner'>Cierre Drive-first activo. Operación normalizada sin borrado de filas.</p>
        <pre>${escape(JSON.stringify({ health: state.health, productionValidation: state.productionValidation, migrationPreview: state.migrationPreview }, null, 2))}</pre>
      </section>
    `;
  }

  function renderHome() {
    const loading = state.loadingPanel
      ? `<p class="scope-banner">Cargando panel operativo...</p>`
      : '';
    const err = state.panelError ? `<p class='empty-state'>${escape(state.panelError)}</p>` : '';
    document.querySelector('#inicio-content').innerHTML = `<h2>Inicio</h2>${loading}${err}<p>Fase 7B activa: Cierre Drive-first integrado.</p>`;
  }
  function renderTabs() { document.querySelectorAll('[data-tab-target]').forEach((b) => b.classList.toggle('is-active', b.dataset.tabTarget === state.activeTab)); document.querySelectorAll('[data-tab-panel]').forEach((p) => p.classList.toggle('is-hidden', p.dataset.tabPanel !== state.activeTab)); }
  function render() { renderTabs(); renderHome(); renderOrders(); renderKitchen(); renderOthers(); }

  async function openOrderDetail(orderId) {
    if (state.ordersSource === 'normalized') {
      const d = await rpcCall('getNormalizedOrderDetail', [orderId]);
      const payload = d?.data || d || {};
      const o = payload?.pedido || {};
      const items = Array.isArray(o.items) ? o.items : [];
      const burgers = Array.isArray(o.burgers) ? o.burgers : [];
      const guarniciones = Array.isArray(o.guarniciones) ? o.guarniciones : [];
      const eventos = Array.isArray(payload?.eventos) ? payload.eventos : [];
      const payment = o.payment || {};
      const selectedPaymentStatus = payment.estado_pago || o.estado_pago || 'Pendiente';
      const selectedPaymentMethod = payment.metodo_pago || o.metodo_pago || 'No definido';
      const initialNotaInterna = o.nota_interna || '';
      const initialNotaCliente = o.nota_cliente || '';
      const ticketSent = String(o.ticket_enviado).toLowerCase() === 'true' || o.ticket_enviado === true;
      const paidAlready = selectedPaymentStatus === 'Pagado';
      const production = o.production || {};
      const hasSideItems = Number(production.guarniciones_total || 0) > 0;
      const hasPendingSides = !Boolean(production.guarniciones_ready);
      const productionState = o.production?.estado_produccion || o.estado_produccion || (o.estado === 'Listo' ? 'Preparada' : 'Pendiente');
      const delivery = o.delivery || {};
      const deliveryState = delivery.estado_entrega || o.estado_entrega || 'Pendiente';
      const paymentReady = Boolean(payment.payment_ready || selectedPaymentStatus === 'Pagado');
      const productionReady = Boolean(production.production_ready || production.order_ready);
      const deliveryReady = deliveryState === 'Entregada';
      const finalized = Boolean(o.finalization?.finalized) || (productionReady && paymentReady && deliveryReady);
      const canComplete = productionReady && productionState !== 'Preparada';
      const finalizationBlockers = [].concat(!productionReady ? ['Producción pendiente'] : [], !paymentReady ? ['Pago pendiente'] : [], !deliveryReady ? ['Entrega pendiente'] : []);
      modalContent.innerHTML = `<h3>Detalle normalizado</h3>
        <div class='form-grid'>
          <p><strong>Pedido:</strong> ${escape(o.pedido_id || '-')} / ${escape(o.folio || '-')}</p>
          <p><strong>Cliente:</strong> ${escape(o.cliente_nombre || '-')}</p>
          <p><strong>Teléfono:</strong> ${escape(o.cliente_telefono || '-')}</p>
          <p><strong>Total:</strong> ${escape(o.total || '0')}</p>
          <p><strong>Estado general:</strong> ${escape(o.estado || 'Nuevo')}</p>
          <p><strong>Producción:</strong> ${escape(productionState)}</p>
          <label>Estado Pago<select id='norm-pay-status'>${NORMALIZED_PAYMENT_STATUSES.map((status) => `<option ${status === selectedPaymentStatus ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
          <label>Método Pago<select id='norm-pay-method'>${PAYMENT_METHODS.map((method) => `<option ${method === selectedPaymentMethod ? 'selected' : ''}>${method}</option>`).join('')}</select></label>
          <label>Nota interna<textarea id='norm-note-internal'>${escape(initialNotaInterna)}</textarea></label>
          <label>Nota cliente<textarea id='norm-note-client'>${escape(initialNotaCliente)}</textarea></label>
        </div>
        <div class='row'>
          <button class='write-btn' data-write-action id='save-normalized-payment' disabled>Guardar pago</button>
          <button class='write-btn' data-write-action id='save-normalized-notes' disabled>Guardar notas</button>
          <button class='write-btn' data-write-action id='mark-normalized-paid-modal' ${paidAlready ? 'disabled' : ''}>${paidAlready ? 'Pagado' : 'Marcar pagado'}</button>
          <button class='write-btn' data-write-action id='mark-normalized-ticket-modal' ${ticketSent ? 'disabled' : ''}>${ticketSent ? 'Ticket enviado' : 'Marcar ticket enviado'}</button>
          <button class='ghost' disabled title='Pendiente migración'>WhatsApp pendiente migración</button>
        </div>
        <h4>Producción</h4>
        <p>Estado producción: ${escape(productionState)}</p>
        <p>Bloqueos: ${escape((production.blockers || []).join(', ') || 'Sin bloqueos')}</p>
        <p>Burgers: ${escape((production.burgers_listas || 0) + '/' + (production.burgers_total || 0))} listas</p>
        <p>Guarniciones: ${hasSideItems ? escape((production.guarniciones_hechas || 0) + '/' + (production.guarniciones_total || 0)) + ' hechas' : 'Sin guarniciones'}</p>
        <div class='row'>
          <button class='write-btn' data-write-action data-burgers-preparing='${escape(orderId)}'>Burgers preparando</button>
          <button class='write-btn' data-write-action data-burgers-ready='${escape(orderId)}' ${production.burgers_ready ? 'disabled' : ''}>Burgers listas</button>
          ${hasSideItems ? `<button class='write-btn' data-write-action data-guarniciones-preparing='${escape(orderId)}'>Guarniciones preparando</button>` : ''}
          ${hasSideItems ? `<button class='write-btn' data-write-action data-guarniciones-ready='${escape(orderId)}' ${hasPendingSides ? '' : 'disabled'}>Guarniciones hechas</button>` : ''}
          <button class='write-btn' data-write-action data-complete-order='${escape(orderId)}' ${canComplete ? '' : 'disabled'}>Marcar como preparada</button>
        </div>
        <h4>Pago</h4>
        <p>Estado pago: ${escape(selectedPaymentStatus)} (${paymentReady ? 'OK' : 'Pendiente'})</p>
        <h4>Entrega</h4>
        <p>Estado entrega: ${escape(deliveryState)}</p>
        <div class='row'>
          <button class='write-btn' data-write-action data-mark-delivered='${escape(orderId)}' ${deliveryReady ? 'disabled' : ''}>${deliveryReady ? 'Entregada' : 'Marcar entregada'}</button>
        </div>
        <h4>Finalización</h4>
        <p>${finalized ? 'Finalizada' : `Pendiente: ${escape(finalizationBlockers.join(', '))}`}</p>
        <h4>Items</h4><pre>${escape(JSON.stringify(items, null, 2))}</pre>
        <h4>Burgers</h4><pre>${escape(JSON.stringify(burgers, null, 2))}</pre>
        <h4>Guarniciones</h4><pre>${escape(JSON.stringify(guarniciones, null, 2))}</pre>
        <h4>Eventos</h4><pre>${escape(JSON.stringify(eventos, null, 2))}</pre>`;
      modal.classList.remove('is-hidden');
      document.querySelector('#save-normalized-payment').onclick = () => updatePayment(orderId, document.querySelector('#norm-pay-status').value, document.querySelector('#norm-pay-method').value);
      document.querySelector('#save-normalized-notes').onclick = () => saveNotes(orderId, document.querySelector('#norm-note-internal').value, document.querySelector('#norm-note-client').value);
      document.querySelector('#mark-normalized-paid-modal').onclick = () => markPaid(orderId);
      document.querySelector('#mark-normalized-ticket-modal').onclick = () => markTicketSent(orderId);
      const payStatusSelect = document.querySelector('#norm-pay-status');
      const payMethodSelect = document.querySelector('#norm-pay-method');
      const noteInternal = document.querySelector('#norm-note-internal');
      const noteClient = document.querySelector('#norm-note-client');
      const savePaymentBtn = document.querySelector('#save-normalized-payment');
      const saveNotesBtn = document.querySelector('#save-normalized-notes');
      const syncNormalizedDetailButtons = () => {
        savePaymentBtn.disabled = payStatusSelect.value === selectedPaymentStatus && payMethodSelect.value === selectedPaymentMethod;
        saveNotesBtn.disabled = noteInternal.value.trim() === initialNotaInterna.trim() && noteClient.value.trim() === initialNotaCliente.trim();
      };
      [payStatusSelect, payMethodSelect, noteInternal, noteClient].forEach((node) => {
        node.addEventListener('change', syncNormalizedDetailButtons);
        node.addEventListener('input', syncNormalizedDetailButtons);
      });
      syncNormalizedDetailButtons();
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
      const orderStatus = e.target.closest('[data-order-status]'); if (orderStatus) return changeOrderStatus(orderStatus.dataset.orderStatus, orderStatus.dataset.nextStatus);
      const ready = e.target.closest('[data-ready]'); if (ready) return changeOrderStatus(ready.dataset.ready, 'Listo');
      const sideReady = e.target.closest('[data-side-ready]'); if (sideReady) return markSideReady(sideReady.dataset.sideReady);
      const burgersPreparing = e.target.closest('[data-burgers-preparing]'); if (burgersPreparing) return markNormalizedBurgersPreparing(burgersPreparing.dataset.burgersPreparing);
      const burgersReady = e.target.closest('[data-burgers-ready]'); if (burgersReady) return markNormalizedBurgersReady(burgersReady.dataset.burgersReady);
      const guaPreparing = e.target.closest('[data-guarniciones-preparing]'); if (guaPreparing) return markNormalizedSidesPreparing(guaPreparing.dataset.guarnicionesPreparing);
      const guaReady = e.target.closest('[data-guarniciones-ready]'); if (guaReady) return markNormalizedSideDone(guaReady.dataset.guarnicionesReady);
      const delivered = e.target.closest('[data-mark-delivered]'); if (delivered) return markNormalizedDelivered(delivered.dataset.markDelivered);
      const completeOrder = e.target.closest('[data-complete-order]'); if (completeOrder) return completeNormalizedReadyOrder(completeOrder.dataset.completeOrder);
      const wa = e.target.closest('[data-wa]'); if (wa) return openWhatsAppForOrder(wa.dataset.wa);
      const writeSummary = e.target.closest('#write-summary-btn'); if (writeSummary) return state.ordersSource === 'legacy-fallback' ? writeDailySummaryAction() : showCloseHistoryPending();
      const archiveCompleted = e.target.closest('#archive-completed-btn'); if (archiveCompleted) return state.ordersSource === 'legacy-fallback' ? archiveCompletedOrdersAction() : showCloseHistoryPending();
      const closeDayBtn = e.target.closest('#close-day-btn'); if (closeDayBtn) return state.ordersSource === 'legacy-fallback' ? closeDayAction() : showCloseHistoryPending();
      const archiveNormalizedCloseBtn = e.target.closest('#archive-normalized-close-btn'); if (archiveNormalizedCloseBtn) return isNormalizedMode() ? archiveNormalizedCloseDayAction() : null;
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
