import type { CreateRaffleTicketAdjustmentPayload, RaffleTicketAdjustmentMutationResponse } from '../../../packages/config/src';
import { errorResponse, generateId, getCampaignForSummary, json, readJsonPayload, requireRaffleAdmin, type Env, type RaffleTicketAdjustmentRow, calculateSummary, mapTicketAdjustment } from './_utils';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = body as Partial<CreateRaffleTicketAdjustmentPayload>;
  const campaignId = normalizeText(payload.campaignId);
  const participantKey = normalizeText(payload.participantKey);
  const reason = normalizeText(payload.reason);
  const actor = normalizeText(payload.actor) || 'internal-v2';
  const ticketsDelta = Number(payload.ticketsDelta);

  if (!campaignId) return errorResponse(400, 'CAMPAIGN_REQUIRED', 'campaignId es requerido.');
  if (!participantKey) return errorResponse(400, 'PARTICIPANT_REQUIRED', 'participantKey es requerido.');
  if (!Number.isInteger(ticketsDelta) || ticketsDelta <= 0 || ticketsDelta > 100) return errorResponse(400, 'INVALID_TICKETS', 'ticketsDelta debe ser un entero de 1 a 100.');
  if (reason.length < 3) return errorResponse(400, 'INVALID_REASON', 'El motivo es obligatorio.');
  if (reason.length > 300) return errorResponse(400, 'INVALID_REASON', 'El motivo excede el máximo permitido.');
  if (actor.length > 80) return errorResponse(400, 'INVALID_ACTOR', 'actor excede el máximo permitido.');

  try {
    const campaign = await getCampaignForSummary(env.BOG_MENU_DB!, campaignId);
    if (!campaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');

    const summary = await calculateSummary(env.BOG_MENU_DB!, campaign, participantKey);
    const participant = summary.participantResults.find((item) => item.participantKey === participantKey)
      ?? summary.topParticipants.find((item) => item.participantKey === participantKey);
    if (!participant) return errorResponse(404, 'PARTICIPANT_NOT_FOUND', 'Participante no encontrado en la campaña.');

    const now = new Date().toISOString();
    const id = generateId('raffleadj');
    await env.BOG_MENU_DB!.prepare(
      `INSERT INTO raffle_ticket_adjustments_v2
       (id, campaign_id, participant_key, participant_name, participant_phone_masked, tickets_delta, reason, actor, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).bind(id, campaignId, participant.participantKey, participant.customerName, participant.customerPhoneMasked, ticketsDelta, reason, actor, now, now).run();

    const row = await env.BOG_MENU_DB!.prepare(
      `SELECT id, campaign_id, participant_key, participant_name, participant_phone_masked, tickets_delta, reason, actor, status, created_at, updated_at, reverted_at, reverted_by
       FROM raffle_ticket_adjustments_v2
       WHERE id = ? LIMIT 1`
    ).bind(id).first<RaffleTicketAdjustmentRow>();
    if (!row) throw new Error('Missing inserted adjustment');

    const response: RaffleTicketAdjustmentMutationResponse = { ok: true, data: { adjustment: mapTicketAdjustment(row) } };
    return json(201, response);
  } catch {
    return errorResponse(500, 'RAFFLE_ADJUSTMENT_CREATE_FAILED', 'No se pudo guardar el ajuste de tickets.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'POST') return onRequestPost(context);
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
};
