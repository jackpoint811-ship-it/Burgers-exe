import type { RaffleSummaryResponse } from '../../../packages/config/src';
import { calculateSummary, errorResponse, getCampaignForSummary, json, requireRaffleAdmin, type Env } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId')?.trim() || null;
  const q = (url.searchParams.get('q') ?? '').trim();

  try {
    const campaign = await getCampaignForSummary(env.BOG_MENU_DB!, campaignId);
    if (campaignId && !campaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');
    const summary = await calculateSummary(env.BOG_MENU_DB!, campaign, q);
    const payload: RaffleSummaryResponse = {
      ok: true,
      data: {
        campaign,
        ...summary
      }
    };
    return json(200, payload);
  } catch {
    return errorResponse(500, 'RAFFLES_SUMMARY_FAILED', 'No se pudo calcular el resumen del sorteo.');
  }
};
