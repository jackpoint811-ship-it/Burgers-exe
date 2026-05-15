import { buildLogoutCookie, jsonResponse } from '../_shared/auth.js';

export async function onRequestPost() {
  return jsonResponse(200, { ok: true }, { 'Set-Cookie': buildLogoutCookie() });
}
