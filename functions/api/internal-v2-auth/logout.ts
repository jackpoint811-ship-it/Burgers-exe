import { buildExpiredInternalSessionCookie, json, type AdminEnv } from '../_orders-v2-utils';

type Env = AdminEnv;

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  const response = json(200, { ok: true });
  response.headers.append('Set-Cookie', buildExpiredInternalSessionCookie(request));
  return response;
};
