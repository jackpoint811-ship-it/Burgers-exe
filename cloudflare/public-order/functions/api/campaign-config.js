function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

const DEFAULT_CONFIG = {
  enabled: false,
  name: '',
  ticketsPageEnabled: false,
  ticketsPageUrl: '/tickets',
  menuCtaLabel: '🎟️ Consulta tus tickets'
};

function parseDateMs(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(' ', 'T');
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

function isCampaignCurrentlyActive(row, nowMs) {
  if (!row || Number(row.is_active) !== 1) return false;
  const startsAt = parseDateMs(row.starts_at);
  const endsAt = parseDateMs(row.ends_at);
  if (startsAt !== null && startsAt > nowMs) return false;
  if (endsAt !== null && endsAt < nowMs) return false;
  return true;
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  const db = context.env && context.env.BOG_MENU_DB;
  if (!db) return jsonResponse(200, { ok: true, data: DEFAULT_CONFIG });

  try {
    const row = await db.prepare(`
      SELECT id, title, starts_at, ends_at, is_active
      FROM raffle_campaigns_v2
      WHERE is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).first();
    const active = isCampaignCurrentlyActive(row, Date.now());

    return jsonResponse(200, {
      ok: true,
      data: {
        enabled: active,
        name: active ? String(row.title || 'Sorteo activo') : '',
        ticketsPageEnabled: active,
        ticketsPageUrl: '/tickets',
        menuCtaLabel: '🎟️ Consulta tus tickets'
      }
    });
  } catch (_error) {
    return jsonResponse(200, { ok: true, data: DEFAULT_CONFIG });
  }
}
