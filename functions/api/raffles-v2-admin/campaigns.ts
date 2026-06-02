import type { RaffleCampaignsAdminResponse } from '../../../packages/config/src';
import { createCampaign, errorResponse, json, mapCampaign, readJsonPayload, requireRaffleAdmin, validateCreatePayload, type Env, type RaffleCampaignRow } from './_utils';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;

  try {
    const result = await env.BOG_MENU_DB!.prepare(
      'SELECT * FROM raffle_campaigns_v2 ORDER BY is_active DESC, created_at DESC'
    ).all<RaffleCampaignRow>();
    const payload: RaffleCampaignsAdminResponse = {
      ok: true,
      data: { campaigns: (result.results ?? []).map(mapCampaign) }
    };
    return json(200, payload);
  } catch {
    return errorResponse(500, 'RAFFLES_LIST_FAILED', 'No se pudieron cargar los sorteos.');
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = validateCreatePayload(body);
  if (payload instanceof Response) return payload;

  try {
    const campaign = await createCampaign(env.BOG_MENU_DB!, payload);
    return json(201, { ok: true, data: { campaign } });
  } catch {
    return errorResponse(500, 'RAFFLES_CREATE_FAILED', 'No se pudo crear el sorteo.');
  }
};
