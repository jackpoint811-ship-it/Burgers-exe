export const ADMIN_TOKEN_STORAGE_KEY = 'bog-menu-admin-token-v2';
export const ADMIN_TOKEN_CHANGED_EVENT = 'bog-admin-token-changed-v2';

const emitTokenChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ADMIN_TOKEN_CHANGED_EVENT));
};

export const getAdminToken = (): string => {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? '';
};

export const setAdminToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
  else window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  emitTokenChanged();
};

export const clearAdminToken = (): void => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  emitTokenChanged();
};
