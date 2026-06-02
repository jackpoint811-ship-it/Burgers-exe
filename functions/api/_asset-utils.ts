const SAFE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const SAFE_ASSET_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export const normalizeAssetKey = (rawKey: unknown): string | null => {
  const joined = Array.isArray(rawKey) ? rawKey.join('/') : String(rawKey ?? '');
  let decoded = joined.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  const key = decoded.replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\') || key.includes('//') || !SAFE_ASSET_KEY_PATTERN.test(key)) return null;
  if (!key.split('/').every((segment) => segment && segment !== '.' && segment !== '..')) return null;
  const lower = key.toLowerCase();
  if (![...SAFE_IMAGE_EXTENSIONS].some((extension) => lower.endsWith(extension))) return null;
  return key;
};

export const validateAssetKey = (value: unknown): string | null | undefined => {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeAssetKey(trimmed) ?? undefined;
};

export const validateImageUrl = (value: unknown): string | null | undefined => {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('https://')) return trimmed;
  return undefined;
};

export const inferImageContentType = (key: string): string => {
  const lower = key.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'application/octet-stream';
};
