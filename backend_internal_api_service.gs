function bogHandleInternalRpc_(requestBody) {
  bogValidateInternalApiAuth_(requestBody);
  var action = requestBody && requestBody.action ? String(requestBody.action) : '';
  var payload = requestBody && requestBody.payload ? requestBody.payload : {};

  switch (action) {
    case 'healthCheck':
      return healthCheck();
    case 'getAppOrders':
      return getAppOrders();
    case 'getOrderDetail':
      return getOrderDetail(payload.orderId);
    case 'updateOrderStatus':
      return updateOrderStatus(payload.orderId, payload.nextStatus);
    case 'updateOrderOperationalData':
      return updateOrderOperationalData(payload.orderId, payload.data || {});
    case 'updateOrderPayment':
      return updateOrderPayment(payload.orderId, payload.paymentStatus, payload.paymentMethod);
    case 'markOrderPaid':
      return markOrderPaid(payload.orderId);
    case 'markOrderSideReady':
      return markOrderSideReady(payload.orderId);
    case 'updateOrderNotes':
      return updateOrderNotes(payload.orderId, payload.noteInternal, payload.noteClient);
    case 'markTicketSent':
      return markTicketSent(payload.orderId);
    case 'getDailySummary':
      return getDailySummary();
    case 'getCloseDayPreview':
      return getCloseDayPreview();
    case 'writeDailySummary':
      return writeDailySummary();
    case 'archiveCompletedOrders':
      return archiveCompletedOrders();
    case 'closeDay':
      return closeDay();
    case 'getHistoryPreview':
      return getHistoryPreview();
    case 'getHistoryOrders':
      return getHistoryOrders(payload.limit);
    default:
      throw new Error('Acción interna no soportada.');
  }
}

function bogValidateInternalApiAuth_(requestBody) {
  var auth = requestBody && requestBody.auth ? requestBody.auth : {};
  var provided = auth && auth.secret ? String(auth.secret) : '';
  var expected = PropertiesService.getScriptProperties().getProperty('INTERNAL_API_SHARED_SECRET') || '';
  if (!provided || !expected || provided !== expected) {
    throw new Error('Unauthorized internal API call.');
  }
}
