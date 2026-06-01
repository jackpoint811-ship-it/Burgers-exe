import { normalizeAssetKey } from '../../../_asset-utils';
import { mapD1PromoToPromoCard } from '../../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../../_orders-v2-utils';

/* POST/DELETE /api/menu-v2-admin/promos/:id/image */
type Env = AdminEnv & { BOG_ASSETS_BUCKET?: R2Bucket };

type PromoRow = {
  id: string;
  asset_image_key?: string | null;
  asset_image_url?: string | null;
  imageKey?: string | null;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif']
};
const GENERATED_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
};

const PROMO_SELECT =
  'SELECT id, title, description, badge, promo_label AS promoLabel, is_featured AS isFeatured, is_available AS isAvailable, sort_order AS sortOrder, tags_json, combo_links_json, asset_alt, asset_placeholder, asset_image_url, asset_image_key, asset_image_key AS imageKey, updated_at AS updatedAt FROM promo_cards WHERE id = ? LIMIT 1';

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const getAuthorizedId = async (env: Env, params: EventContext<Env, string, unknown>['params'], request: Request): Promise<{ id: string } | Response> => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = String(params.id ?? '').trim();
  if (!id) return json(400, { ok: false, error: 'Invalid promo id' });
  return { id };
};

const fetchPromo = async (db: D1Database, id: string) => db.prepare(PROMO_SELECT).bind(id).first();

const normalizePromoIdForKey = (id: string): string => {
  const normalized = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  return normalized || 'promo';
};

const timestampForKey = (date = new Date()): string => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const encodeAssetUrl = (key: string): string => `/api/assets-v2/${key.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;

const getSafeFileExtension = (file: File): string | null => {
  const type = file.type.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type)) return null;

  const fileName = file.name.trim().toLowerCase();
  if (!fileName || fileName.startsWith('data:') || fileName.includes('\0')) return null;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return null;

  const allowedExtensions = EXTENSIONS_BY_TYPE[type] ?? [];
  if (!allowedExtensions.some((extension) => fileName.endsWith(extension))) return null;

  return GENERATED_EXTENSION_BY_TYPE[type] ?? null;
};

const deletePreviousPromoAsset = async (bucket: R2Bucket | undefined, previousKey: unknown): Promise<string | undefined> => {
  if (!bucket || typeof previousKey !== 'string') return undefined;
  const safePreviousKey = normalizeAssetKey(previousKey);
  if (!safePreviousKey || !safePreviousKey.startsWith('promos/')) return undefined;

  try {
    await bucket.delete(safePreviousKey);
    return undefined;
  } catch {
    return 'Previous promo image could not be deleted from R2';
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, params, request }) => {
  const auth = await getAuthorizedId(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  const bucket = env.BOG_ASSETS_BUCKET;
  if (!db || !bucket) return json(503, { ok: false, error: 'Admin disabled' });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) return json(400, { ok: false, error: 'Expected multipart/form-data' });

  const currentPromo = (await fetchPromo(db, auth.id)) as PromoRow | null;
  if (!currentPromo) return json(404, { ok: false, error: 'Promo not found' });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, error: 'Invalid multipart/form-data' });
  }

  const files = formData.getAll('file');
  if (files.length !== 1 || !(files[0] instanceof File)) return json(400, { ok: false, error: 'Upload exactly one image file' });

  const file = files[0];
  if (file.size <= 0) return json(400, { ok: false, error: 'Image file is required' });
  if (file.size > MAX_IMAGE_BYTES) return json(413, { ok: false, error: 'Image must be 5 MB or less' });

  const extension = getSafeFileExtension(file);
  if (!extension) return json(415, { ok: false, error: 'Unsupported image type. Use JPG, PNG, WebP or AVIF.' });

  const key = `promos/${normalizePromoIdForKey(auth.id)}-${timestampForKey()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: { contentType: file.type.trim().toLowerCase() },
    customMetadata: { promoId: auth.id, uploadedBy: 'internal-chekeo-v2', purpose: 'promo-card' }
  });

  const result = await db.prepare(
    'UPDATE promo_cards SET asset_image_key = ?, asset_image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(key, auth.id)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) {
    await bucket.delete(key).catch(() => undefined);
    return json(500, { ok: false, error: 'Promo image could not be saved' });
  }

  const deleteWarning = await deletePreviousPromoAsset(bucket, currentPromo.imageKey ?? currentPromo.asset_image_key);
  const updatedPromo = await fetchPromo(db, auth.id);
  if (!updatedPromo) return json(404, { ok: false, error: 'Promo not found' });

  return json(200, { ok: true, promo: mapD1PromoToPromoCard(updatedPromo), imageKey: key, assetUrl: encodeAssetUrl(key), ...(deleteWarning ? { warning: deleteWarning } : {}) });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  const auth = await getAuthorizedId(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  if (!db) return json(503, { ok: false, error: 'Admin disabled' });

  const currentPromo = (await fetchPromo(db, auth.id)) as PromoRow | null;
  if (!currentPromo) return json(404, { ok: false, error: 'Promo not found' });

  const deleteWarning = await deletePreviousPromoAsset(env.BOG_ASSETS_BUCKET, currentPromo.imageKey ?? currentPromo.asset_image_key);

  const result = await db.prepare(
    'UPDATE promo_cards SET asset_image_key = NULL, asset_image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(auth.id)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return json(404, { ok: false, error: 'Promo not found' });

  const updatedPromo = await fetchPromo(db, auth.id);
  if (!updatedPromo) return json(404, { ok: false, error: 'Promo not found' });

  return json(200, { ok: true, promo: mapD1PromoToPromoCard(updatedPromo), removed: true, ...(deleteWarning ? { warning: deleteWarning } : {}) });
};
