const SESSION_COOKIE_NAME = 'bog_internal_session';
const SESSION_SCOPE = 'internal-chekeo';
const SESSION_MAX_AGE_SECONDS = 43200;

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...extraHeaders,
    },
  });
}

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}

export function isIpAllowed(request, env) {
  const rawAllowedIps = env.ALLOWED_IPS || '';
  if (!rawAllowedIps.trim()) {
    return true;
  }

  const allowed = rawAllowedIps
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!allowed.length) {
    return true;
  }

  const clientIp = getClientIp(request);
  return allowed.includes(clientIp);
}

export async function signSession(payload, secret) {
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const payloadEncoded = toBase64Url(payloadBytes);

  const key = await importHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadBytes);
  const signatureEncoded = toBase64Url(new Uint8Array(signatureBuffer));

  return `${payloadEncoded}.${signatureEncoded}`;
}

export async function verifySession(cookieValue, secret) {
  if (!cookieValue || typeof cookieValue !== 'string' || !secret) {
    return null;
  }

  const parts = cookieValue.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signatureEncoded] = parts;
  try {
    const payloadBytes = fromBase64Url(payloadEncoded);
    const signatureBytes = fromBase64Url(signatureEncoded);
    const key = await importHmacKey(secret);
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, payloadBytes);

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    const now = Math.floor(Date.now() / 1000);

    if (!payload || payload.scope !== SESSION_SCOPE) {
      return null;
    }

    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }

    if (payload.exp <= now || payload.iat > now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookie(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return valueParts.join('=');
    }
  }

  return null;
}

export async function requireSession(request, env) {
  const cookieValue = getSessionCookie(request);
  if (!cookieValue || !env.INTERNAL_SESSION_SECRET) {
    return { authenticated: false, payload: null };
  }

  const payload = await verifySession(cookieValue, env.INTERNAL_SESSION_SECRET);
  return { authenticated: Boolean(payload), payload };
}

export function buildSessionCookie(value) {
  return `${SESSION_COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function buildLogoutCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;
export const SESSION_SCOPE_NAME = SESSION_SCOPE;
