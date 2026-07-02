function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function maskPhone(phone) {
  const digits = onlyDigits(phone);
  if (digits.length <= 4) return digits ? '******' + digits : '';
  return '******' + digits.slice(-4);
}

function originFromRequest(request) {
  try { return new URL(request.url).origin; } catch (_error) { return 'https://burgers-exe.pages.dev'; }
}


function getSnapshotItemKind(snapshotJson) {
  if (!String(snapshotJson || '').trim()) return null;
  try {
    const parsed = JSON.parse(snapshotJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return typeof parsed.itemKind === 'string' ? parsed.itemKind : null;
  } catch (_error) {
    return null;
  }
}

function campaignBound(value, endOfDay) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z');
  return text;
}

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
  if (!db) return jsonResponse(503, { ok: false, error: { code: 'MISSING_DB', message: 'Base de datos no configurada.' } });

  const url = new URL(context.request.url);
  const phone = onlyDigits(url.searchParams.get('phone'));
  if (phone.length < 8) {
    return jsonResponse(400, { ok: false, error: { code: 'INVALID_PHONE', message: 'Teléfono inválido.' } });
  }

  try {
    const campaign = await db.prepare(`
      SELECT id, title, starts_at, ends_at, is_active, ticket_per_burger, ticket_per_referral
      FROM raffle_campaigns_v2
      WHERE is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).first();

    if (!isCampaignCurrentlyActive(campaign, Date.now())) {
      return jsonResponse(404, { ok: false, error: { code: 'NOT_FOUND', message: 'No hay campaña activa.' } });
    }

    const referral = await db.prepare(`
      SELECT owner_name, owner_phone, code
      FROM raffle_referral_codes_v2
      WHERE campaign_id = ?
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(owner_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
        AND is_active = 1
      LIMIT 1
    `).bind(campaign.id, phone).first();

    if (!referral) {
      return jsonResponse(404, { ok: false, error: { code: 'NOT_FOUND', message: 'No encontramos tickets con ese teléfono.' } });
    }

    const startsAt = campaignBound(campaign.starts_at, false);
    const endsAt = campaignBound(campaign.ends_at, true);
    const burgerTicketRows = await db.prepare(`
      SELECT oi.qty, oi.snapshot_json
      FROM orders_v2 o
      JOIN order_items_v2 oi ON oi.order_id = o.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
        AND o.status IN ('new', 'preparing', 'ready', 'delivered')
        AND (? IS NULL OR o.created_at >= ?)
        AND (? IS NULL OR o.created_at <= ?)
    `).bind(phone, startsAt, startsAt, endsAt, endsAt).all();

    // Public ticket lookup intentionally matches the admin summary: purchase tickets
    // count snapshot_json.itemKind values "burger" and "combo"; referral tickets
    // include both pending and valid referrals because the UI says "tickets".
    const ticketsFromBurgers = (burgerTicketRows.results || []).reduce((sum, row) => {
      const itemKind = getSnapshotItemKind(String(row.snapshot_json || ''));
      if (itemKind !== 'burger' && itemKind !== 'combo') return sum;
      return sum + Math.max(0, Number(row.qty) || 0) * Number(campaign.ticket_per_burger || 1);
    }, 0);

    const referralTicketsRow = await db.prepare(`
      SELECT COALESCE(SUM(tickets_awarded), 0) AS referral_tickets
      FROM raffle_referrals_v2
      WHERE campaign_id = ?
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(referrer_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
        AND status IN ('pending', 'valid')
    `).bind(campaign.id, phone).first();

    const ticketsFromReferrals = Number(referralTicketsRow && referralTicketsRow.referral_tickets ? referralTicketsRow.referral_tickets : 0);
    const ticketsCount = Math.max(0, Math.floor(ticketsFromBurgers + ticketsFromReferrals));
    const shareUrl = originFromRequest(context.request) + '/?ref=' + encodeURIComponent(referral.code);

    return jsonResponse(200, {
      ok: true,
      data: {
        customerName: String(referral.owner_name || ''),
        phoneMasked: maskPhone(referral.owner_phone),
        referralCode: String(referral.code || ''),
        ticketsCount,
        ticketCountingMode: 'pending_and_valid',
        ticketsLabel: 'tickets',
        shareUrl
      }
    });
  } catch (_error) {
    return jsonResponse(500, { ok: false, error: { code: 'QUERY_FAILED', message: 'No se pudo consultar la campaña.' } });
  }
}
