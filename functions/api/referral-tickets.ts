type Env = { BOG_MENU_DB?: D1Database };

type CampaignRow = {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  ticket_per_burger: number | null;
  ticket_per_referral: number | null;
};

type ReferralCodeRow = {
  owner_name: string | null;
  owner_phone: string | null;
  code: string | null;
};

type OrderTicketRow = {
  qty: number | null;
  snapshot_json: string | null;
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const normalizePhoneSql = (column: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')`;
const maskPhone = (value: unknown) => {
  const digits = onlyDigits(value);
  return digits ? `******${digits.slice(-4)}` : '';
};

const originFromRequest = (request: Request) => {
  try {
    return new URL(request.url).origin;
  } catch {
    return 'https://burgers-exe.pages.dev';
  }
};

const parseDateMs = (value: string | null) => {
  if (!value) return null;
  const ms = Date.parse(String(value).trim().replace(' ', 'T'));
  return Number.isFinite(ms) ? ms : null;
};

const campaignBound = (value: string | null, endOfDay: boolean) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`;
  return value;
};

const isCampaignCurrentlyActive = (row: CampaignRow | null, nowMs: number) => {
  if (!row || Number(row.is_active) !== 1) return false;
  const startsAt = parseDateMs(row.starts_at);
  const endsAt = parseDateMs(row.ends_at);
  if (startsAt !== null && startsAt > nowMs) return false;
  if (endsAt !== null && endsAt < nowMs) return false;
  return true;
};

const getSnapshotItemKind = (snapshotJson: string | null) => {
  if (!String(snapshotJson || '').trim()) return null;
  try {
    const parsed = JSON.parse(String(snapshotJson));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const kind = (parsed as Record<string, unknown>).itemKind;
    return typeof kind === 'string' ? kind : null;
  } catch {
    return null;
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: { code: 'MISSING_DB', message: 'Base de datos no configurada.' } });

  const url = new URL(request.url);
  const phone = onlyDigits(url.searchParams.get('phone'));
  if (phone.length < 8) return json(400, { ok: false, error: { code: 'INVALID_PHONE', message: 'Telefono invalido.' } });

  try {
    const campaign = await env.BOG_MENU_DB.prepare(
      `SELECT id, title, starts_at, ends_at, is_active, ticket_per_burger, ticket_per_referral
       FROM raffle_campaigns_v2
       WHERE is_active = 1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    ).first<CampaignRow>();

    if (!isCampaignCurrentlyActive(campaign ?? null, Date.now())) {
      return json(404, { ok: false, error: { code: 'NOT_FOUND', message: 'No hay campana activa.' } });
    }

    const campaignId = campaign!.id;
    const referral = await env.BOG_MENU_DB.prepare(
      `SELECT owner_name, owner_phone, code
       FROM raffle_referral_codes_v2
       WHERE campaign_id = ?
         AND ${normalizePhoneSql('owner_phone')} = ?
         AND is_active = 1
       LIMIT 1`
    ).bind(campaignId, phone).first<ReferralCodeRow>();

    if (!referral) {
      return json(404, { ok: false, error: { code: 'NOT_FOUND', message: 'No encontramos tickets con ese telefono.' } });
    }

    const startsAt = campaignBound(campaign!.starts_at, false);
    const endsAt = campaignBound(campaign!.ends_at, true);
    const burgerRows = await env.BOG_MENU_DB.prepare(
      `SELECT oi.qty, oi.snapshot_json
       FROM orders_v2 o
       JOIN order_items_v2 oi ON oi.order_id = o.id
       WHERE ${normalizePhoneSql('o.customer_phone')} = ?
         AND o.status IN ('new', 'preparing', 'ready', 'delivered')
         AND (? IS NULL OR o.created_at >= ?)
         AND (? IS NULL OR o.created_at <= ?)`
    ).bind(phone, startsAt, startsAt, endsAt, endsAt).all<OrderTicketRow>();

    const ticketsFromBurgers = (burgerRows.results ?? []).reduce((sum, row) => {
      const itemKind = getSnapshotItemKind(row.snapshot_json);
      if (itemKind !== 'burger' && itemKind !== 'combo') return sum;
      return sum + Math.max(0, Number(row.qty) || 0) * (Number(campaign!.ticket_per_burger) || 1);
    }, 0);

    const referralTicketsRow = await env.BOG_MENU_DB.prepare(
      `SELECT COALESCE(SUM(tickets_awarded), 0) AS referral_tickets
       FROM raffle_referrals_v2
       WHERE campaign_id = ?
         AND ${normalizePhoneSql('referrer_phone')} = ?
         AND status IN ('pending', 'valid')`
    ).bind(campaignId, phone).first<{ referral_tickets: number | null }>();

    const ticketsFromReferrals = Number(referralTicketsRow?.referral_tickets || 0);
    const ticketsCount = Math.max(0, Math.floor(ticketsFromBurgers + ticketsFromReferrals));
    const referralCode = String(referral.code || '');

    return json(200, {
      ok: true,
      data: {
        customerName: String(referral.owner_name || ''),
        phoneMasked: maskPhone(referral.owner_phone),
        referralCode,
        ticketsCount,
        ticketCountingMode: 'pending_and_valid',
        ticketsLabel: 'tickets',
        shareUrl: `${originFromRequest(request)}/?ref=${encodeURIComponent(referralCode)}`
      }
    });
  } catch {
    return json(500, { ok: false, error: { code: 'QUERY_FAILED', message: 'No se pudo consultar la campana.' } });
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') return json(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' } });
  return onRequestGet(context);
};
