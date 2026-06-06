import { errorResponse, json, readJsonPayload, requireRaffleAdmin, softDeleteCampaign, updateCampaign, validateUpdatePayload, type Env } from '../_utils';

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const id = typeof params.id === 'string' ? params.id : '';
  if (!id.trim()) return errorResponse(400, 'INVALID_ID', 'Id inválido.');
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = validateUpdatePayload(body);
  if (payload instanceof Response) return payload;

  try {
    const campaign = await updateCampaign(env.BOG_MENU_DB!, id, payload);
    if (!campaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');
    return json(200, { ok: true, data: { campaign } });
  } catch {
    return errorResponse(500, 'RAFFLES_UPDATE_FAILED', 'No se pudo actualizar el sorteo.');
  }
};


export const onRequestDelete: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const id = typeof params.id === 'string' ? params.id : '';
  if (!id.trim()) return errorResponse(400, 'INVALID_ID', 'Id inválido.');

  try {
    const campaign = await softDeleteCampaign(env.BOG_MENU_DB!, id);
    if (!campaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');
    return json(200, { ok: true, data: { campaign } });
  } catch {
    return errorResponse(500, 'RAFFLES_DELETE_FAILED', 'No se pudo ocultar el sorteo.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'PATCH') return onRequestPatch(context);
  if (context.request.method === 'DELETE') return onRequestDelete(context);
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use PATCH or DELETE.');
};
