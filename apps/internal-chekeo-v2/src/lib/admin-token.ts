type InternalAuthEnvelope = {
  ok: boolean;
  data?: { authenticated?: boolean };
  error?: { code?: string; message?: string };
};

const parseAuthEnvelope = async (res: Response): Promise<InternalAuthEnvelope> => {
  let envelope: InternalAuthEnvelope | null = null;
  try {
    envelope = (await res.json()) as InternalAuthEnvelope;
  } catch {
    // Keep auth errors generic. Never include request payloads or cookies.
  }
  if (!envelope) return { ok: false, error: { code: `HTTP_${res.status}` } };
  return envelope;
};

export const fetchInternalAuthStatus = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/internal-v2-auth/status', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const envelope = await parseAuthEnvelope(res);
    return Boolean(res.ok && envelope.ok && envelope.data?.authenticated);
  } catch {
    return false;
  }
};

export const loginInternal = async (pin: string): Promise<void> => {
  const res = await fetch('/api/internal-v2-auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const envelope = await parseAuthEnvelope(res);
  if (!res.ok || !envelope.ok || !envelope.data?.authenticated) {
    throw new Error(envelope.error?.message || envelope.error?.code || 'No se pudo iniciar sesión.');
  }
};

export const logoutInternal = async (): Promise<void> => {
  await fetch('/api/internal-v2-auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
};
