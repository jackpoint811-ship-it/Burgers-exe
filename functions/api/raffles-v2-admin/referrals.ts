import type { RaffleReferralsAdminResponse } from '../../../packages/config/src';
import { errorResponse, json, mapReferral, normalizePhone, readJsonPayload, REFERRAL_STATUSES, requireRaffleAdmin, type Env, type ReferralRow } from './_utils';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const url = new URL(request.url);
  const campaignId = normalizeText(url.searchParams.get('campaignId'));
  const q = normalizeText(url.searchParams.get('q'));
  const status = normalizeText(url.searchParams.get('status')) || 'all';
  if (!campaignId) return errorResponse(400, 'CAMPAIGN_REQUIRED', 'campaignId es requerido.');
  if (status !== 'all' && !REFERRAL_STATUSES.includes(status as typeof REFERRAL_STATUSES[number])) return errorResponse(400, 'INVALID_STATUS', 'Status inválido.');

  try {
    const conditions = ['r.campaign_id = ?'];
    const bindings: string[] = [campaignId];
    if (status !== 'all') { conditions.push('r.status = ?'); bindings.push(status); }
    if (q) {
      const phone = normalizePhone(q);
      conditions.push('(c.code LIKE ? OR UPPER(r.referrer_name) LIKE ? OR UPPER(r.referred_customer_name) LIKE ? OR r.referrer_phone LIKE ? OR r.referred_customer_phone LIKE ? OR o.folio LIKE ?)');
      bindings.push(`%${q.toUpperCase()}%`, `%${q.toUpperCase()}%`, `%${q.toUpperCase()}%`, `%${phone || q}%`, `%${phone || q}%`, `%${q.toUpperCase()}%`);
    }
    const result = await env.BOG_MENU_DB!.prepare(
      `SELECT r.*, c.code, o.folio AS referred_order_folio
       FROM raffle_referrals_v2 r
       JOIN raffle_referral_codes_v2 c ON c.id = r.referral_code_id
       JOIN orders_v2 o ON o.id = r.referred_order_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC LIMIT 150`
    ).bind(...bindings).all<ReferralRow>();
    const response: RaffleReferralsAdminResponse = { ok: true, data: { referrals: (result.results ?? []).map(mapReferral) } };
    return json(200, response);
  } catch {
    return errorResponse(500, 'REFERRALS_LIST_FAILED', 'No se pudieron cargar pedidos referidos.');
  }
};
