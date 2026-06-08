import { normalizeAssetKey } from "../../../_asset-utils";
import { mapD1CategoryBanner } from "../../../_menu-v2-utils";
import { requireAdminToken, type AdminEnv } from "../../../_orders-v2-utils";
import type { MenuCategory } from "../../../../../packages/config/src";

type Env = AdminEnv & { BOG_MENU_ASSETS?: R2Bucket };
type CategoryKey = MenuCategory["key"];
type CategoryBannerRow = { categoryKey: CategoryKey; imageKey?: string | null };

const CATEGORIES = new Set<CategoryKey>([
  "burgers",
  "combos",
  "guarniciones",
  "drinks",
  "extras",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
};
const GENERATED_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const BANNER_SELECT =
  "SELECT category_key AS categoryKey, title, subtitle, image_key AS imageKey, image_url AS imageUrl, updated_at AS updatedAt FROM menu_category_banners WHERE category_key = ? LIMIT 1";
const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const getAuthorizedCategory = async (
  env: Env,
  params: EventContext<Env, string, unknown>["params"],
  request: Request,
): Promise<{ categoryKey: CategoryKey } | Response> => {
  if (!env.BOG_MENU_DB)
    return json(503, { ok: false, error: "Admin disabled" });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const categoryKey = String(params.categoryKey ?? "").trim();
  if (!CATEGORIES.has(categoryKey as CategoryKey))
    return json(400, { ok: false, error: "Categoría inválida" });
  return { categoryKey: categoryKey as CategoryKey };
};

const fetchBanner = async (db: D1Database, categoryKey: CategoryKey) =>
  db.prepare(BANNER_SELECT).bind(categoryKey).first();

const timestampForKey = (date = new Date()): string =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
const encodeAssetUrl = (key: string): string =>
  `/api/assets-v2/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

const getSafeFileExtension = (file: File): string | null => {
  const type = file.type.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type)) return null;

  const fileName = file.name.trim().toLowerCase();
  if (!fileName || fileName.startsWith("data:") || fileName.includes("\0"))
    return null;
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..")
  )
    return null;

  const allowedExtensions = EXTENSIONS_BY_TYPE[type] ?? [];
  if (!allowedExtensions.some((extension) => fileName.endsWith(extension)))
    return null;

  return GENERATED_EXTENSION_BY_TYPE[type] ?? null;
};

const deletePreviousBannerAsset = async (
  bucket: R2Bucket | undefined,
  previousKey: unknown,
): Promise<string | undefined> => {
  if (!bucket || typeof previousKey !== "string") return undefined;
  const safePreviousKey = normalizeAssetKey(previousKey);
  if (!safePreviousKey || !safePreviousKey.startsWith("category-banners/"))
    return undefined;

  try {
    await bucket.delete(safePreviousKey);
    return undefined;
  } catch {
    return "No se pudo borrar la imagen anterior.";
  }
};

export const onRequestPost: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  const auth = await getAuthorizedCategory(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  const bucket = env.BOG_MENU_ASSETS;
  if (!db || !bucket) return json(503, { ok: false, error: "Admin disabled" });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data"))
    return json(400, { ok: false, error: "Expected multipart/form-data" });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, error: "Invalid multipart/form-data" });
  }

  const files = formData.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File))
    return json(400, { ok: false, error: "Upload exactly one image file" });

  const file = files[0];
  if (file.size <= 0)
    return json(400, { ok: false, error: "Image file is required" });
  if (file.size > MAX_IMAGE_BYTES)
    return json(413, { ok: false, error: "La imagen debe pesar 5 MB o menos" });

  const extension = getSafeFileExtension(file);
  if (!extension)
    return json(415, { ok: false, error: "Usa JPG, PNG, WebP o AVIF." });

  const currentBanner = (await fetchBanner(
    db,
    auth.categoryKey,
  )) as CategoryBannerRow | null;
  const key = `category-banners/${auth.categoryKey}/${auth.categoryKey}-${timestampForKey()}.${extension}`;
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: { contentType: file.type.trim().toLowerCase() },
    customMetadata: {
      categoryKey: auth.categoryKey,
      uploadedBy: "internal-chekeo-v2",
      purpose: "category-banner",
    },
  });

  const result = await db
    .prepare(
      `INSERT INTO menu_category_banners (category_key, title, subtitle, image_key, image_url, updated_at)
     VALUES (?, NULL, NULL, ?, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(category_key) DO UPDATE SET
       image_key = excluded.image_key,
       image_url = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(auth.categoryKey, key)
    .run();

  if (!result.success) {
    await bucket.delete(key).catch(() => undefined);
    return json(500, {
      ok: false,
      error: "No se pudo guardar la imagen del banner",
    });
  }

  const deleteWarning = await deletePreviousBannerAsset(
    bucket,
    currentBanner?.imageKey,
  );
  const updatedBanner = await fetchBanner(db, auth.categoryKey);
  if (!updatedBanner)
    return json(500, { ok: false, error: "No se pudo recuperar banner" });

  return json(200, {
    ok: true,
    banner: mapD1CategoryBanner(updatedBanner),
    imageKey: key,
    assetUrl: encodeAssetUrl(key),
    ...(deleteWarning ? { warning: deleteWarning } : {}),
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  const auth = await getAuthorizedCategory(env, params, request);
  if (auth instanceof Response) return auth;
  const db = env.BOG_MENU_DB;
  if (!db) return json(503, { ok: false, error: "Admin disabled" });

  const currentBanner = (await fetchBanner(
    db,
    auth.categoryKey,
  )) as CategoryBannerRow | null;
  const deleteWarning = await deletePreviousBannerAsset(
    env.BOG_MENU_ASSETS,
    currentBanner?.imageKey,
  );
  const result = await db
    .prepare(
      `INSERT INTO menu_category_banners (category_key, title, subtitle, image_key, image_url, updated_at)
     VALUES (?, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(category_key) DO UPDATE SET
       image_key = NULL,
       image_url = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(auth.categoryKey)
    .run();

  if (!result.success)
    return json(500, {
      ok: false,
      error: "No se pudo quitar la imagen del banner",
    });

  const updatedBanner = await fetchBanner(db, auth.categoryKey);
  if (!updatedBanner)
    return json(500, { ok: false, error: "No se pudo recuperar banner" });

  return json(200, {
    ok: true,
    banner: mapD1CategoryBanner(updatedBanner),
    imageKey: null,
    assetUrl: null,
    removed: true,
    ...(deleteWarning ? { warning: deleteWarning } : {}),
  });
};
