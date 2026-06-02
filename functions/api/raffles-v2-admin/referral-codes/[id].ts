import type { RaffleReferralCodeMutationResponse, UpdateRaffleReferralCodePayload } from '../../../../packages/config/src';
import { errorResponse, json, mapReferralCode, readJsonPayload, requireRaffleAdmin, type Env, type ReferralCodeRow } from '../_utils';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  if (!id) return errorResponse(400, 'INVALID_ID', 'Id inválido.');
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = body as UpdateRaffleReferralCodePayload;
  const assignments: string[] = [];
  const bindings: Array<string | number | null> = [];
  if ('isActive' in payload) { assignments.push('is_active = ?'); bindings.push(payload.isActive ? 1 : 0); }
  if ('labelText' in payload) { const label = normalizeText(payload.labelText); if (label.length > 160) return errorResponse(400, 'INVALID_LABEL', 'labelText excede el máximo.'); assignments.push('label_text = ?'); bindings.push(label || null); }
  if ('ownerName' in payload) { const ownerName = normalizeText(payload.ownerName); if (ownerName.length < 2 || ownerName.length > 80) return errorResponse(400, 'INVALID_OWNER_NAME', 'El nombre debe tener entre 2 y 80 caracteres.'); assignments.push('owner_name = ?'); bindings.push(ownerName); }
  if (!assignments.length) return errorResponse(400, 'EMPTY_PATCH', 'No hay cambios permitidos.');
  assignments.push('updated_at = ?'); bindings.push(new Date().toISOString());
  try {
    await env.BOG_MENU_DB!.prepare(`UPDATE raffle_referral_codes_v2 SET ${assignments.join(', ')} WHERE id = ?`).bind(...bindings, id).run();
    const row = await env.BOG_MENU_DB!.prepare('SELECT * FROM raffle_referral_codes_v2 WHERE id = ? LIMIT 1').bind(id).first<ReferralCodeRow>();
    if (!row) return errorResponse(404, 'REFERRAL_CODE_NOT_FOUND', 'Código no encontrado.');
    const response: RaffleReferralCodeMutationResponse = { ok: true, data: { code: mapReferralCode(row) } };
    return json(200, response);
  } catch {
    return errorResponse(500, 'REFERRAL_CODES_UPDATE_FAILED', 'No se pudo actualizar el código.');
  }
};
