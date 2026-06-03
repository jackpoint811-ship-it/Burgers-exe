type Env = { BOG_MENU_DB?: D1Database };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const DEFAULT_CONFIG = {
  enabled: false,
  name: '',
  ticketsPageEnabled: false,
  ticketsPageUrl: '/tickets',
  menuCtaLabel: 'Consulta tus tickets'
};

type CampaignRow = {
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
};

const parseDateMs = (value: string | null) => {
  if (!value) return null;
  const ms = Date.parse(String(value).trim().replace(' ', 'T'));
  return Number.isFinite(ms) ? ms : null;
};

const isCampaignCurrentlyActive = (row: CampaignRow | null, nowMs: number) => {
  if (!row || Number(row.is_active) !== 1) return false;
  const startsAt = parseDateMs(row.starts_at);
  const endsAt = parseDateMs(row.ends_at);
  if (startsAt !== null && startsAt > nowMs) return false;
  if (endsAt !== null && endsAt < nowMs) return false;
  return true;
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.BOG_MENU_DB) return json(200, { ok: true, data: DEFAULT_CONFIG });

  try {
    const row = await env.BOG_MENU_DB.prepare(
      `SELECT title, starts_at, ends_at, is_active
       FROM raffle_campaigns_v2
       WHERE is_active = 1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    ).first<CampaignRow>();
    const active = isCampaignCurrentlyActive(row ?? null, Date.now());

    return json(200, {
      ok: true,
      data: {
        enabled: active,
        name: active ? String(row?.title || 'Sorteo activo') : '',
        ticketsPageEnabled: active,
        ticketsPageUrl: '/tickets',
        menuCtaLabel: 'Consulta tus tickets'
      }
    });
  } catch {
    return json(200, { ok: true, data: DEFAULT_CONFIG });
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') return json(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' } });
  return onRequestGet(context);
};
