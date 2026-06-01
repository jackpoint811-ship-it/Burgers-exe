import {
  buildInternalSessionCookie,
  createInternalSessionValue,
  errorResponse,
  json,
  parseJsonObject,
  type AdminEnv
} from '../_orders-v2-utils';

type Env = AdminEnv;

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const configuredPin = env.BOG_INTERNAL_PIN?.trim();
  const fallbackToken = env.BOG_ORDERS_ADMIN_TOKEN?.trim();
  const expectedPin = configuredPin || fallbackToken || '';
  if (!expectedPin || !fallbackToken) return errorResponse(503, 'AUTH_NOT_CONFIGURED', 'Internal auth is not configured.');

  const body = await parseJsonObject(request);
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';
  if (!pin || !safeEqual(pin, expectedPin)) return errorResponse(401, 'INVALID_PIN', 'PIN inválido.');

  const sessionValue = await createInternalSessionValue(env);
  if (!sessionValue) return errorResponse(503, 'AUTH_NOT_CONFIGURED', 'Internal auth is not configured.');

  const response = json(200, { ok: true, data: { authenticated: true } });
  response.headers.append('Set-Cookie', buildInternalSessionCookie(request, sessionValue));
  return response;
};
