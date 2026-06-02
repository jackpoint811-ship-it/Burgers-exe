import type { RaffleReferralMutationResponse, UpdateRaffleReferralPayload } from '../../../../packages/config/src';
import { errorResponse, json, mapReferral, readJsonPayload, REFERRAL_STATUSES, requireRaffleAdmin, type Env, type ReferralRow } from '../_utils';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  if (!id) return errorResponse(400, 'INVALID_ID', 'Id inválido.');
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = body as UpdateRaffleReferralPayload;
  const status = normalizeText(payload.status);
  const invalidReason = normalizeText(payload.invalidReason);
  if (!REFERRAL_STATUSES.includes(status as typeof REFERRAL_STATUSES[number])) return errorResponse(400, 'INVALID_STATUS', 'Status inválido.');
  if (status === 'invalid' && invalidReason.length < 3) return errorResponse(400, 'INVALID_REASON_REQUIRED', 'Razón requerida para invalidar.');
  if (invalidReason.length > 300) return errorResponse(400, 'INVALID_REASON_TOO_LONG', 'La razón excede el máximo.');
  try {
    await env.BOG_MENU_DB!.prepare('UPDATE raffle_referrals_v2 SET status = ?, invalid_reason = ?, updated_at = ? WHERE id = ?')
      .bind(status, status === 'invalid' ? invalidReason : null, new Date().toISOString(), id).run();
    const row = await env.BOG_MENU_DB!.prepare(
      `SELECT r.*, c.code, o.folio AS referred_order_folio
       FROM raffle_referrals_v2 r
       JOIN raffle_referral_codes_v2 c ON c.id = r.referral_code_id
       JOIN orders_v2 o ON o.id = r.referred_order_id
       WHERE r.id = ? LIMIT 1`
    ).bind(id).first<ReferralRow>();
    if (!row) return errorResponse(404, 'REFERRAL_NOT_FOUND', 'Referido no encontrado.');
    const response: RaffleReferralMutationResponse = { ok: true, data: { referral: mapReferral(row) } };
    return json(200, response);
  } catch {
    return errorResponse(500, 'REFERRAL_UPDATE_FAILED', 'No se pudo actualizar el referido.');
  }
};
