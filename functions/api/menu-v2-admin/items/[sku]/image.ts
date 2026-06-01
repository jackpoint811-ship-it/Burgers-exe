import { normalizeAssetKey } from '../../../_asset-utils';
import { mapD1ItemToMenuItem } from '../../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../../_orders-v2-utils';

type Env = AdminEnv & { BOG_ASSETS_BUCKET?: R2Bucket };

type MenuItemRow = {
  sku: string;
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

const ITEM_SELECT =
  'SELECT sku, category_key AS category, name, description, price_cents AS price, tags_json, badge, promo_label AS promoLabel, is_available AS isAvailable, is_featured AS isFeatured, sort_order AS sortOrder, image_url AS imageUrl, image_key AS imageKey, combo_links_json, upsell_items_json, updated_at AS updatedAt FROM menu_items WHERE sku = ? LIMIT 1';

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const getAuthorizedSku = async (env: Env, params: EventContext<Env, string, unknown>['params'], request: Request): Promise<{ sku: string } | Response> => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const sku = String(params.sku ?? '').trim();
  if (!sku) return json(400, { ok: false, error: 'Invalid SKU' });
  return { sku };
};

const fetchItem = async (db: D1Database, sku: string) => db.prepare(ITEM_SELECT).bind(sku).first();

const normalizeSkuForKey = (sku: string): string => {
  const normalized = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  return normalized || 'item';
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

const deletePreviousMenuAsset = async (bucket: R2Bucket | undefined, previousKey: unknown): Promise<string | undefined> => {
  if (!bucket || typeof previousKey !== 'string') return undefined;
  const safePreviousKey = normalizeAssetKey(previousKey);
  if (!safePreviousKey || !safePreviousKey.startsWith('menu/')) return undefined;

  try {
    await bucket.delete(safePreviousKey);
    return undefined;
  } catch {
    return 'Previous image could not be deleted from R2';
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, params, request }) => {
  const auth = await getAuthorizedSku(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  const bucket = env.BOG_ASSETS_BUCKET;
  if (!db || !bucket) return json(503, { ok: false, error: 'Admin disabled' });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) return json(400, { ok: false, error: 'Expected multipart/form-data' });

  const currentItem = (await fetchItem(db, auth.sku)) as MenuItemRow | null;
  if (!currentItem) return json(404, { ok: false, error: 'Item not found' });

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

  const key = `menu/${normalizeSkuForKey(auth.sku)}-${timestampForKey()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: { contentType: file.type.trim().toLowerCase() },
    customMetadata: { sku: auth.sku, uploadedBy: 'internal-chekeo-v2', purpose: 'menu-item' }
  });

  const result = await db.prepare(
    'UPDATE menu_items SET image_key = ?, image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE sku = ?'
  )
    .bind(key, auth.sku)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) {
    await bucket.delete(key).catch(() => undefined);
    return json(404, { ok: false, error: 'Item not found' });
  }

  const deleteWarning = await deletePreviousMenuAsset(bucket, currentItem.imageKey);
  const updatedItem = await fetchItem(db, auth.sku);
  if (!updatedItem) return json(404, { ok: false, error: 'Item not found' });

  return json(200, { ok: true, item: mapD1ItemToMenuItem(updatedItem), imageKey: key, assetUrl: encodeAssetUrl(key), ...(deleteWarning ? { warning: deleteWarning } : {}) });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  const auth = await getAuthorizedSku(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  if (!db) return json(503, { ok: false, error: 'Admin disabled' });

  const currentItem = (await fetchItem(db, auth.sku)) as MenuItemRow | null;
  if (!currentItem) return json(404, { ok: false, error: 'Item not found' });

  const deleteWarning = await deletePreviousMenuAsset(env.BOG_ASSETS_BUCKET, currentItem.imageKey);

  const result = await db.prepare(
    'UPDATE menu_items SET image_key = NULL, image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE sku = ?'
  )
    .bind(auth.sku)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return json(404, { ok: false, error: 'Item not found' });

  const updatedItem = await fetchItem(db, auth.sku);
  if (!updatedItem) return json(404, { ok: false, error: 'Item not found' });

  return json(200, { ok: true, item: mapD1ItemToMenuItem(updatedItem), removed: true, ...(deleteWarning ? { warning: deleteWarning } : {}) });
};
