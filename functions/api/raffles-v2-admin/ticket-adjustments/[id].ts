import type { RaffleTicketAdjustmentMutationResponse, UpdateRaffleTicketAdjustmentPayload } from '../../../../packages/config/src';
import { errorResponse, json, mapTicketAdjustment, readJsonPayload, requireRaffleAdmin, type Env, type RaffleTicketAdjustmentRow } from '../_utils';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  if (!id) return errorResponse(400, 'INVALID_ID', 'Id inválido.');
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = body as Partial<UpdateRaffleTicketAdjustmentPayload>;
  const status = normalizeText(payload.status);
  const actor = normalizeText(payload.actor) || 'internal-v2';

  if (status !== 'active' && status !== 'reverted') return errorResponse(400, 'INVALID_STATUS', 'Status inválido.');
  if (actor.length > 80) return errorResponse(400, 'INVALID_ACTOR', 'actor excede el máximo permitido.');

  try {
    const existing = await env.BOG_MENU_DB!.prepare(
      `SELECT id, campaign_id, participant_key, participant_name, participant_phone_masked, tickets_delta, reason, actor, status, created_at, updated_at, reverted_at, reverted_by
       FROM raffle_ticket_adjustments_v2
       WHERE id = ? LIMIT 1`
    ).bind(id).first<RaffleTicketAdjustmentRow>();
    if (!existing) return errorResponse(404, 'RAFFLE_ADJUSTMENT_NOT_FOUND', 'Ajuste no encontrado.');

    const now = new Date().toISOString();
    await env.BOG_MENU_DB!.prepare(
      `UPDATE raffle_ticket_adjustments_v2
       SET status = ?, reverted_at = ?, reverted_by = ?, actor = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      status,
      status === 'reverted' ? now : null,
      status === 'reverted' ? actor : null,
      actor,
      now,
      id,
    ).run();

    const row = await env.BOG_MENU_DB!.prepare(
      `SELECT id, campaign_id, participant_key, participant_name, participant_phone_masked, tickets_delta, reason, actor, status, created_at, updated_at, reverted_at, reverted_by
       FROM raffle_ticket_adjustments_v2
       WHERE id = ? LIMIT 1`
    ).bind(id).first<RaffleTicketAdjustmentRow>();
    if (!row) return errorResponse(404, 'RAFFLE_ADJUSTMENT_NOT_FOUND', 'Ajuste no encontrado.');

    const response: RaffleTicketAdjustmentMutationResponse = { ok: true, data: { adjustment: mapTicketAdjustment(row) } };
    return json(200, response);
  } catch {
    return errorResponse(500, 'RAFFLE_ADJUSTMENT_UPDATE_FAILED', 'No se pudo actualizar el ajuste.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'PATCH') return onRequestPatch(context);
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use PATCH.');
};
