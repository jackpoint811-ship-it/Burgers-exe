import { normalizeAssetKey } from '../../../_asset-utils';
import { mapD1CatalogBanner } from '../../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../../_orders-v2-utils';

type Env = AdminEnv & { BOG_MENU_ASSETS?: R2Bucket };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
};
const GENERATED_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const timestampForKey = (date = new Date()): string =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const encodeAssetUrl = (key: string): string =>
  `/api/assets-v2/${key.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;

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

const deletePreviousBannerAsset = async (bucket: R2Bucket | undefined, previousKey: unknown): Promise<string | undefined> => {
  if (!bucket || typeof previousKey !== 'string') return undefined;
  const safePreviousKey = normalizeAssetKey(previousKey);
  if (!safePreviousKey || !safePreviousKey.startsWith('catalog-banners/')) return undefined;

  try {
    await bucket.delete(safePreviousKey);
    return undefined;
  } catch {
    return 'No se pudo borrar la imagen anterior.';
  }
};

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ env, params, request }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = params.id as string;
  if (!id) return json(400, { ok: false, error: 'ID is required' });

  const db = env.BOG_MENU_DB;
  const bucket = env.BOG_MENU_ASSETS;
  if (!bucket) return json(503, { ok: false, error: 'R2 Admin disabled' });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) return json(400, { ok: false, error: 'Expected multipart/form-data' });

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
  if (file.size > MAX_IMAGE_BYTES) return json(413, { ok: false, error: 'La imagen debe pesar 5 MB o menos' });

  const extension = getSafeFileExtension(file);
  if (!extension) return json(415, { ok: false, error: 'Usa JPG, PNG, WebP o AVIF.' });

  const currentBanner = await db.prepare('SELECT image_key FROM catalog_banners WHERE id = ?').bind(id).first();
  if (!currentBanner) return json(404, { ok: false, error: 'Banner no encontrado' });

  const key = `catalog-banners/${id}/${timestampForKey()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: { contentType: file.type.trim().toLowerCase() },
    customMetadata: {
      bannerId: id,
      uploadedBy: 'internal-chekeo-v2',
      purpose: 'catalog-banner'
    }
  });

  const result = await db.prepare(
    `UPDATE catalog_banners SET image_key = ?, image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(key, id).run();

  if (!result.success || result.meta.changes === 0) {
    await bucket.delete(key).catch(() => {});
    return json(500, { ok: false, error: 'No se pudo actualizar la imagen del banner en DB' });
  }

  const deleteWarning = await deletePreviousBannerAsset(bucket, currentBanner.image_key);
  const updatedBanner = await db.prepare('SELECT id, title, subtitle, cta_label, image_key, image_url, is_active, sort_order, updated_at FROM catalog_banners WHERE id = ? LIMIT 1').bind(id).first();

  return json(200, {
    ok: true,
    banner: mapD1CatalogBanner(updatedBanner),
    imageKey: key,
    assetUrl: encodeAssetUrl(key),
    ...(deleteWarning ? { warning: deleteWarning } : {})
  });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ env, params, request }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = params.id as string;
  if (!id) return json(400, { ok: false, error: 'ID is required' });

  const db = env.BOG_MENU_DB;
  if (!env.BOG_MENU_ASSETS) return json(503, { ok: false, error: 'R2 Admin disabled' });

  const currentBanner = await db.prepare('SELECT image_key FROM catalog_banners WHERE id = ?').bind(id).first();
  if (!currentBanner) return json(404, { ok: false, error: 'Banner no encontrado' });

  const deleteWarning = await deletePreviousBannerAsset(env.BOG_MENU_ASSETS, currentBanner.image_key);
  const result = await db.prepare(
    `UPDATE catalog_banners SET image_key = NULL, image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(id).run();

  if (!result.success || result.meta.changes === 0) return json(500, { ok: false, error: 'No se pudo quitar la imagen de DB' });

  const updatedBanner = await db.prepare('SELECT id, title, subtitle, cta_label, image_key, image_url, is_active, sort_order, updated_at FROM catalog_banners WHERE id = ? LIMIT 1').bind(id).first();

  return json(200, {
    ok: true,
    banner: mapD1CatalogBanner(updatedBanner),
    imageKey: null,
    assetUrl: null,
    removed: true,
    ...(deleteWarning ? { warning: deleteWarning } : {})
  });
};
