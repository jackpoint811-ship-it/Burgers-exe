function bogValidateInternalApiAuth_(requestBody) {
  var props = PropertiesService.getScriptProperties();
  var expectedSecret = props.getProperty('INTERNAL_API_SHARED_SECRET');
  var providedSecret = requestBody && requestBody.auth ? requestBody.auth.secret : '';

  if (!expectedSecret) {
    return { ok: false, error: { code: 'MISSING_EXPECTED_SECRET', message: 'Configuración interna incompleta.' } };
  }

  if (!providedSecret) {
    return { ok: false, error: { code: 'MISSING_PROVIDED_SECRET', message: 'Credencial interna incompleta.' } };
  }

  if (providedSecret !== expectedSecret) {
    return { ok: false, error: { code: 'INVALID_SECRET', message: 'Credencial interna inválida.' } };
  }

  return { ok: true };
}

function bogHandleInternalApiFromCloudflare_(requestBody) {
  var authCheck = bogValidateInternalApiAuth_(requestBody);
  if (!authCheck.ok) {
    return authCheck;
  }

  var rpc = requestBody && requestBody.rpc ? requestBody.rpc : null;
  var method = rpc ? rpc.method : null;
  var args = rpc ? rpc.args : null;

  if (typeof method !== 'string' || !method) {
    return { ok: false, error: { code: 'INVALID_METHOD', message: 'rpc.method debe ser string.' } };
  }

  if (!Array.isArray(args)) {
    return { ok: false, error: { code: 'INVALID_ARGS', message: 'rpc.args debe ser un arreglo.' } };
  }

  var handlers = {
    healthCheck: healthCheck,
    getAppOrders: getAppOrders,
    getDailySummary: getDailySummary,
    getBankConfig: getBankConfig
  };

  if (!handlers[method]) {
    return { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } };
  }

  return handlers[method].apply(null, args);
}
