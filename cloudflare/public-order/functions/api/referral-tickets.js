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

    const burgerTicketsRow = await db.prepare(`
      SELECT COALESCE(SUM(oi.qty), 0) AS burgers
      FROM orders_v2 o
      JOIN order_items_v2 oi ON oi.order_id = o.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
        AND o.status != 'cancelled'
        AND (? IS NULL OR o.created_at >= ?)
        AND (? IS NULL OR o.created_at <= ?)
        AND (oi.sku IN ('OG', 'BBQ') OR LOWER(oi.name) LIKE '%burger%')
    `).bind(phone, campaign.starts_at || null, campaign.starts_at || null, campaign.ends_at || null, campaign.ends_at || null).first();

    const referralTicketsRow = await db.prepare(`
      SELECT COALESCE(SUM(tickets_awarded), 0) AS referral_tickets
      FROM raffle_referrals_v2
      WHERE campaign_id = ?
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(referrer_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
        AND status = 'valid'
    `).bind(campaign.id, phone).first();

    const ticketsFromBurgers = Number(burgerTicketsRow && burgerTicketsRow.burgers ? burgerTicketsRow.burgers : 0) * Number(campaign.ticket_per_burger || 1);
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
        shareUrl
      }
    });
  } catch (_error) {
    return jsonResponse(500, { ok: false, error: { code: 'QUERY_FAILED', message: 'No se pudo consultar la campaña.' } });
  }
}
