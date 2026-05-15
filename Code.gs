function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.format === 'json') {
    return ContentService
      .createTextOutput(JSON.stringify(healthCheck()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Burger-OG')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



function doPost(e) {
  return bogHandleJsonPost_(e);
}

function bogHandleJsonPost_(e) {
  try {
    var bodyText = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!bodyText) {
      return bogJsonResponse_({ ok: false, error: { message: 'Body vacío.' } });
    }

    var requestBody = JSON.parse(bodyText);
    if (!requestBody || !requestBody.action) {
      return bogJsonResponse_({ ok: false, error: { message: 'Acción no soportada.' } });
    }

    if (requestBody.action === 'createPublicOrder') {
      var data = bogPublicWrite_(function () {
        return bogCreatePublicOrderFromCloudflare_(requestBody);
      }, 'Pedido público recibido.');
      return bogJsonResponse_(data);
    }

    return bogJsonResponse_(bogHandleInternalRpc_(requestBody));
  } catch (err) {
    return bogJsonResponse_(bogErrorEnvelope_(err));
  }
}

function bogJsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function healthCheck() {
  return bogPublicRead_(function () {
    return {
      phase: 7,
      service: 'Burger-OG Migración a Producción (modo seguro)',
      activeEnvironment: bogGetActiveEnvironment_(),
      activeSheet: bogGetActiveChekeoSheetName_(),
      timestamp: bogNowIso_()
    };
  }, 'Health check listo.');
}

function validateSheetsSetup() {
  return bogPublicRead_(function () {
    return bogValidateSheetSetup_();
  }, 'Validación de hojas ejecutada.');
}

function syncOrdersFromMaster() {
  return bogPublicWrite_(function () {
    return bogSyncOrdersFromMaster_();
  }, 'Sincronización completada.');
}

function getAppOrders() {
  return bogPublicRead_(function () {
    return bogGetAppOrders_();
  }, 'Listado de pedidos obtenido.');
}

function getOrderDetail(orderId) {
  return bogPublicRead_(function () {
    var data = bogGetOrderDetail_(orderId);
    if (!data) {
      throw new Error('Pedido no encontrado: ' + orderId);
    }
    return data;
  }, 'Detalle de pedido obtenido.');
}

function getClientTicketData(orderId) {
  return bogPublicRead_(function () {
    return bogGetClientTicketData_(orderId);
  }, 'Datos de ticket cliente obtenidos.');
}

function updateOrderStatus(orderId, nextStatus) {
  return bogPublicWrite_(function () {
    return bogUpdateOrderStatus_(orderId, nextStatus);
  }, 'Estado de pedido actualizado.');
}

function updateOrderOperationalData(orderId, payload) {
  return bogPublicWrite_(function () {
    return bogUpdateOrderOperationalData_(orderId, payload);
  }, 'Pedido actualizado.');
}

function updateOrderPayment(orderId, paymentStatus, paymentMethod) {
  return bogPublicWrite_(function () {
    return bogUpdateOrderPayment_(orderId, paymentStatus, paymentMethod);
  }, 'Pago del pedido actualizado.');
}

function markOrderPaid(orderId) {
  return bogPublicWrite_(function () {
    return bogMarkOrderPaid_(orderId);
  }, 'Pedido marcado como pagado.');
}

function markOrderSideReady(orderId) {
  return bogPublicWrite_(function () {
    return bogMarkOrderSideReady_(orderId);
  }, 'Guarnición marcada como lista.');
}

function updateOrderNotes(orderId, noteInternal, noteClient) {
  return bogPublicWrite_(function () {
    return bogUpdateOrderNotes_(orderId, noteInternal, noteClient);
  }, 'Notas del pedido actualizadas.');
}

function markTicketSent(orderId) {
  return bogPublicWrite_(function () {
    return bogMarkTicketSent_(orderId);
  }, 'Ticket marcado como enviado.');
}

function getDailySummary() {
  return bogPublicRead_(function () {
    return bogGetDailySummary_();
  }, 'Resumen diario calculado.');
}

function getBankConfig() {
  return bogPublicRead_(function () {
    return bogGetBankConfig_();
  }, 'Configuración bancaria obtenida.');
}

function getCloseDayPreview() {
  return bogPublicRead_(function () {
    return bogGetCloseDayPreview_();
  }, 'Preview de cierre obtenido.');
}

function writeDailySummary() {
  return bogPublicWrite_(function () {
    return bogWriteDailySummary_();
  }, 'Resumen de corte guardado.');
}

function archiveCompletedOrders() {
  return bogPublicWrite_(function () {
    return bogArchiveCompletedOrders_();
  }, 'Archivo de pedidos completados ejecutado.');
}

function closeDay() {
  return bogPublicWrite_(function () {
    return bogCloseDay_();
  }, 'Cierre del día completado.');
}

function getHistoryPreview() {
  return bogPublicRead_(function () {
    return bogGetHistoryPreview_();
  }, 'Preview de historico obtenido.');
}

function validateProductionReadiness() {
  return bogPublicRead_(function () {
    return bogGetProductionValidation_();
  }, 'Validación de producción ejecutada.');
}

function getProductionMigrationPreview() {
  return bogPublicRead_(function () {
    return bogGetProductionMigrationPreview_();
  }, 'Preview de migración obtenido.');
}

function prepareProductionSheets() {
  return bogPublicWrite_(function () {
    return bogPrepareProductionSheets_();
  }, 'Preparación segura de hojas completada.');
}

function archiveReadyPaidOrders() {
  return archiveCompletedOrders();
}

function getHistoryOrders(limit) {
  return bogPublicRead_(function () {
    return bogGetHistoryOrders_(limit);
  }, 'Historico obtenido.');
}

function apiHealth() {
  return healthCheck();
}

function apiSyncChekeoNuevo() {
  return syncOrdersFromMaster();
}

function bogPublicRead_(operation, successMessage) {
  try {
    return {
      ok: true,
      data: operation(),
      message: successMessage
    };
  } catch (err) {
    return bogErrorEnvelope_(err);
  }
}

function bogPublicWrite_(operation, successMessage) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    return {
      ok: true,
      data: operation(),
      message: successMessage
    };
  } catch (err) {
    return bogErrorEnvelope_(err);
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function bogErrorEnvelope_(err) {
  var message = err && err.message ? err.message : 'Error no controlado.';
  return {
    ok: false,
    error: {
      code: 'BACKEND_ERROR',
      message: message
    }
  };
}
