var BOG_INTERNAL_METHOD_ALLOWLIST_ = {
  healthCheck: true,
  syncOrdersFromMaster: true,
  getAppOrders: true,
  getOrderDetail: true,
  getClientTicketData: true,
  updateOrderStatus: true,
  updateOrderOperationalData: true,
  updateOrderPayment: true,
  markOrderPaid: true,
  markOrderSideReady: true,
  updateOrderNotes: true,
  markTicketSent: true,
  getDailySummary: true,
  getBankConfig: true,
  getCloseDayPreview: true,
  writeDailySummary: true,
  archiveCompletedOrders: true,
  closeDay: true,
  getHistoryPreview: true,
  validateProductionReadiness: true,
  getProductionMigrationPreview: true,
  prepareProductionSheets: true,
  getHistoryOrders: true
};

function bogHandleInternalApiFromCloudflare_(requestBody) {
  bogValidateInternalApiAuth_(requestBody);
  if (!requestBody || !requestBody.rpc || typeof requestBody.rpc !== 'object') {
    throw new Error('Payload RPC inválido.');
  }

  var method = typeof requestBody.rpc.method === 'string' ? requestBody.rpc.method : '';
  var args = requestBody.rpc.args;
  if (!method || !BOG_INTERNAL_METHOD_ALLOWLIST_[method]) {
    throw new Error('Método no permitido.');
  }
  if (!Array.isArray(args)) {
    throw new Error('args debe ser un arreglo.');
  }

  switch (method) {
    case 'healthCheck': return healthCheck();
    case 'syncOrdersFromMaster': return syncOrdersFromMaster();
    case 'getAppOrders': return getAppOrders();
    case 'getOrderDetail': return getOrderDetail(args[0]);
    case 'getClientTicketData': return getClientTicketData(args[0]);
    case 'updateOrderStatus': return updateOrderStatus(args[0], args[1]);
    case 'updateOrderOperationalData': return updateOrderOperationalData(args[0], args[1]);
    case 'updateOrderPayment': return updateOrderPayment(args[0], args[1], args[2]);
    case 'markOrderPaid': return markOrderPaid(args[0]);
    case 'markOrderSideReady': return markOrderSideReady(args[0]);
    case 'updateOrderNotes': return updateOrderNotes(args[0], args[1], args[2]);
    case 'markTicketSent': return markTicketSent(args[0]);
    case 'getDailySummary': return getDailySummary();
    case 'getBankConfig': return getBankConfig();
    case 'getCloseDayPreview': return getCloseDayPreview();
    case 'writeDailySummary': return writeDailySummary();
    case 'archiveCompletedOrders': return archiveCompletedOrders();
    case 'closeDay': return closeDay();
    case 'getHistoryPreview': return getHistoryPreview();
    case 'validateProductionReadiness': return validateProductionReadiness();
    case 'getProductionMigrationPreview': return getProductionMigrationPreview();
    case 'prepareProductionSheets': return prepareProductionSheets();
    case 'getHistoryOrders': return getHistoryOrders(args[0]);
    default: throw new Error('Método no soportado.');
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
