function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function readBankConfig(env) {
  if (!env || env.BANK_ENABLED !== 'true') {
    return { enabled: false };
  }

  return {
    enabled: true,
    bankName: String(env.BANK_NAME || '').trim(),
    accountHolder: String(env.BANK_ACCOUNT_HOLDER || '').trim(),
    accountNumber: String(env.BANK_ACCOUNT_NUMBER || '').trim()
  };
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  return jsonResponse(200, {
    ok: true,
    data: readBankConfig(context.env)
  });
}
