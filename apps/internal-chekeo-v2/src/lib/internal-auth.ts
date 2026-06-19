type InternalAuthEnvelope = {
  ok: boolean;
  data?: { authenticated?: boolean };
  error?: { code?: string; message?: string };
};
export type InternalAuthMode = 'global' | 'admin-only';

const SUPPORTED_INTERNAL_AUTH_MODES = new Set<InternalAuthMode>([
  'global',
  'admin-only',
]);

const readInternalAuthModeEnv = () => import.meta.env.VITE_INTERNAL_AUTH_MODE;

export const normalizeInternalAuthMode = (
  value?: string | null,
): InternalAuthMode => {
  const normalized = value?.trim().toLowerCase();
  return SUPPORTED_INTERNAL_AUTH_MODES.has(normalized as InternalAuthMode)
    ? (normalized as InternalAuthMode)
    : 'global';
};

export const getInternalAuthMode = (): InternalAuthMode =>
  normalizeInternalAuthMode(readInternalAuthModeEnv());

export const shouldUseGlobalInternalAuthGate = (
  mode: InternalAuthMode,
): boolean => mode !== 'admin-only';

export const shouldGateAdminInternally = (mode: InternalAuthMode): boolean =>
  mode === 'admin-only';

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
