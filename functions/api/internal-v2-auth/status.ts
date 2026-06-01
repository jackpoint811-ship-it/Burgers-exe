import { hasValidInternalSession, json, type AdminEnv } from '../_orders-v2-utils';

type Env = AdminEnv;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authenticated = await hasValidInternalSession(request, env);
  return json(200, { ok: true, data: { authenticated } });
};
