const SESSION_COOKIE_NAME = 'bog_internal_session';
const SESSION_MAX_AGE_SECONDS = 43200;
const SESSION_SCOPE = 'internal-chekeo';

function withSecurityHeaders(headers = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    ...headers
  };
}

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withSecurityHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders })
  });
}

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || '';
}

export function isIpAllowed(request, env) {
  const allowed = (env.ALLOWED_IPS || '').trim();
  if (!allowed) return true;
  const clientIp = getClientIp(request);
  if (!clientIp) return false;
  const whitelist = allowed.split(',').map((s) => s.trim()).filter(Boolean);
  return whitelist.includes(clientIp);
}

function base64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function signSession(payload, secret) {
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, payloadBytes);
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySession(cookieValue, secret) {
  if (!cookieValue || !secret) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [payloadPart, sigPart] = parts;
  const payloadBytes = base64urlDecode(payloadPart);
  const signature = base64urlDecode(sigPart);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, signature, payloadBytes);
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.scope !== SESSION_SCOPE || typeof payload.exp !== 'number' || now >= payload.exp) return null;
  return payload;
}

export function getSessionCookie(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1)) : '';
}

export async function requireSession(request, env) {
  if (!isIpAllowed(request, env)) {
    return { ok: false, response: jsonResponse(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Acceso no permitido.' } }) };
  }
  if (!env.INTERNAL_SESSION_SECRET) {
    return { ok: false, response: jsonResponse(500, { ok: false, error: { code: 'MISSING_ENV', message: 'Configuración interna incompleta.' } }) };
  }
  const cookie = getSessionCookie(request);
  const session = await verifySession(cookie, env.INTERNAL_SESSION_SECRET);
  if (!session) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sesión requerida.' } }) };
  }
  return { ok: true, session };
}

export function buildSessionCookie(value) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function buildLogoutCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export { SESSION_MAX_AGE_SECONDS, SESSION_SCOPE };
