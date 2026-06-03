import { normalizeAssetKey } from '../../../_asset-utils';
import { errorResponse, json, mapCampaign, requireRaffleAdmin, type Env, type RaffleCampaignRow } from '../../_utils';

type ImageEnv = Env & { BOG_MENU_ASSETS?: R2Bucket };
type ImageKind = 'banner' | 'detail';

type ImageConfig = {
  columnKey: 'banner_image_key' | 'detail_image_key';
  columnUrl: 'banner_image_url' | 'detail_image_url';
  folder: 'raffles/banners/' | 'raffles/details/';
  purpose: 'raffle-banner' | 'raffle-detail';
};

const CONFIG: Record<ImageKind, ImageConfig> = {
  banner: { columnKey: 'banner_image_key', columnUrl: 'banner_image_url', folder: 'raffles/banners/', purpose: 'raffle-banner' },
  detail: { columnKey: 'detail_image_key', columnUrl: 'detail_image_url', folder: 'raffles/details/', purpose: 'raffle-detail' }
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

const normalizeCampaignIdForKey = (id: string): string => {
  const normalized = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  return normalized || 'campaign';
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

const fetchCampaign = async (db: D1Database, id: string) => db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? LIMIT 1').bind(id).first<RaffleCampaignRow>();

const deletePreviousAsset = async (bucket: R2Bucket | undefined, previousKey: unknown, folder: string): Promise<string | undefined> => {
  if (!bucket || typeof previousKey !== 'string') return undefined;
  const safePreviousKey = normalizeAssetKey(previousKey);
  if (!safePreviousKey || !safePreviousKey.startsWith(folder)) return undefined;

  try {
    await bucket.delete(safePreviousKey);
    return undefined;
  } catch {
    return 'La imagen anterior no se pudo borrar de R2.';
  }
};

const getAuthorizedId = async (env: ImageEnv, params: EventContext<ImageEnv, string, unknown>['params'], request: Request): Promise<{ id: string } | Response> => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  if (!id) return errorResponse(400, 'INVALID_ID', 'Id inválido.');
  return { id };
};

export const uploadRaffleImage = async (kind: ImageKind, context: EventContext<ImageEnv, string, unknown>) => {
  const { env, params, request } = context;
  const auth = await getAuthorizedId(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  const bucket = env.BOG_MENU_ASSETS;
  if (!db) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  if (!bucket) return errorResponse(503, 'ASSETS_NOT_CONFIGURED', 'BOG_MENU_ASSETS no está configurado.');

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) return errorResponse(400, 'INVALID_MULTIPART', 'Se esperaba multipart/form-data.');

  const currentCampaign = await fetchCampaign(db, auth.id);
  if (!currentCampaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, 'INVALID_MULTIPART', 'multipart/form-data inválido.');
  }

  const fieldNames = Array.from(formData.keys());
  const files = formData.getAll('file');
  if (fieldNames.length !== 1 || fieldNames[0] !== 'file' || files.length !== 1 || !(files[0] instanceof File)) return errorResponse(400, 'INVALID_FILE', 'Sube exactamente un archivo en el campo file.');

  const file = files[0];
  if (file.size <= 0) return errorResponse(400, 'INVALID_FILE', 'La imagen es requerida.');
  if (file.size > MAX_IMAGE_BYTES) return errorResponse(413, 'IMAGE_TOO_LARGE', 'La imagen debe pesar 5 MB o menos.');

  const extension = getSafeFileExtension(file);
  if (!extension) return errorResponse(415, 'UNSUPPORTED_IMAGE', 'Usa JPG, PNG, WebP o AVIF.');

  const config = CONFIG[kind];
  const key = `${config.folder}${normalizeCampaignIdForKey(auth.id)}-${timestampForKey()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: { contentType: file.type.trim().toLowerCase() },
    customMetadata: { campaignId: auth.id, uploadedBy: 'internal-chekeo-v2', purpose: config.purpose }
  });

  const result = await db.prepare(`UPDATE raffle_campaigns_v2 SET ${config.columnKey} = ?, ${config.columnUrl} = NULL, updated_at = ? WHERE id = ?`)
    .bind(key, new Date().toISOString(), auth.id)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) {
    await bucket.delete(key).catch(() => undefined);
    return errorResponse(500, 'RAFFLE_IMAGE_SAVE_FAILED', 'No se pudo guardar la imagen del sorteo.');
  }

  const deleteWarning = await deletePreviousAsset(bucket, currentCampaign[config.columnKey], config.folder);
  const updatedCampaign = await fetchCampaign(db, auth.id);
  if (!updatedCampaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');

  return json(200, { ok: true, data: { campaign: mapCampaign(updatedCampaign) }, imageKey: key, assetUrl: encodeAssetUrl(key), ...(deleteWarning ? { warning: deleteWarning } : {}) });
};

export const deleteRaffleImage = async (kind: ImageKind, context: EventContext<ImageEnv, string, unknown>) => {
  const { env, params, request } = context;
  const auth = await getAuthorizedId(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  if (!db) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');

  const config = CONFIG[kind];
  const currentCampaign = await fetchCampaign(db, auth.id);
  if (!currentCampaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');

  const deleteWarning = await deletePreviousAsset(env.BOG_MENU_ASSETS, currentCampaign[config.columnKey], config.folder);
  const result = await db.prepare(`UPDATE raffle_campaigns_v2 SET ${config.columnKey} = NULL, ${config.columnUrl} = NULL, updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), auth.id)
    .run();

  if (!result.success || (result.meta?.changes ?? 0) < 1) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');

  const updatedCampaign = await fetchCampaign(db, auth.id);
  if (!updatedCampaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');

  return json(200, { ok: true, data: { campaign: mapCampaign(updatedCampaign) }, imageKey: null, assetUrl: null, removed: true, ...(deleteWarning ? { warning: deleteWarning } : {}) });
};
