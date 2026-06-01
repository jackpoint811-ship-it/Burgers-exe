import { errorResponse, hasInternalAuthSecret, hasValidInternalSession, json, type AdminEnv } from '../_orders-v2-utils';

type Env = AdminEnv;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!hasInternalAuthSecret(env)) return errorResponse(503, 'AUTH_NOT_CONFIGURED', 'Internal auth is not configured.');
  const authenticated = await hasValidInternalSession(request, env);
  return json(200, { ok: true, data: { authenticated } });
};
