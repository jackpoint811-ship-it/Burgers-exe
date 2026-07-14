import { normalizeAssetKey, validateAssetKey, validateImageUrl } from '../../_asset-utils';
import { mapD1CatalogBanner } from '../../_menu-v2-utils';
import { requireAdminToken, type AdminEnv } from '../../_orders-v2-utils';

type Env = AdminEnv & { BOG_MENU_ASSETS?: R2Bucket };

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const normalizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ env, request, params }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = params.id as string;
  if (!id) return json(400, { ok: false, error: 'ID is required' });

  let raw: unknown;
  try { raw = await request.json(); } catch { return json(400, { ok: false, error: 'Invalid payload' }); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json(400, { ok: false, error: 'Invalid payload' });
  const body = raw as Record<string, unknown>;

  const updates: string[] = [];
  const bindings: any[] = [];

  if (typeof body.title === 'string' && body.title.trim()) {
    updates.push('title = ?');
    bindings.push(body.title.trim());
  }

  const subtitle = normalizeOptionalString(body.subtitle);
  if (subtitle !== undefined) {
    updates.push('subtitle = ?');
    bindings.push(subtitle);
  }

  const ctaLabel = normalizeOptionalString(body.ctaLabel);
  if (ctaLabel !== undefined) {
    updates.push('cta_label = ?');
    bindings.push(ctaLabel);
  }

  if ('imageUrl' in body) {
    const imageUrl = validateImageUrl(body.imageUrl);
    if (imageUrl === undefined) return json(400, { ok: false, error: 'Invalid image URL' });
    updates.push('image_url = ?');
    bindings.push(imageUrl);
  }

  if ('imageKey' in body) {
    const imageKey = validateAssetKey(body.imageKey);
    if (imageKey === undefined) return json(400, { ok: false, error: 'Invalid image key' });
    updates.push('image_key = ?');
    bindings.push(imageKey);
  }

  if (typeof body.isActive === 'boolean') {
    updates.push('is_active = ?');
    bindings.push(body.isActive ? 1 : 0);
  }

  if (body.sortOrder !== undefined && (typeof body.sortOrder !== 'number' || !Number.isInteger(body.sortOrder))) {
    return json(400, { ok: false, error: 'sortOrder must be an integer' });
  }
  if (typeof body.sortOrder === 'number') {
    updates.push('sort_order = ?');
    bindings.push(body.sortOrder);
  }

  if (updates.length === 0) return json(400, { ok: false, error: 'No fields to update' });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  bindings.push(id);

  const result = await env.BOG_MENU_DB.prepare(
    `UPDATE catalog_banners SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...bindings).run();

  if (!result.success || result.meta.changes === 0) {
    return json(404, { ok: false, error: 'Banner not found or could not be updated' });
  }

  const row = await env.BOG_MENU_DB.prepare('SELECT id, title, subtitle, cta_label, image_key, image_url, is_active, sort_order, updated_at FROM catalog_banners WHERE id = ? LIMIT 1').bind(id).first();
  return row ? json(200, { ok: true, banner: mapD1CatalogBanner(row) }) : json(500, { ok: false, error: 'Error fetching updated banner' });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ env, request, params }) => {
  if (!env.BOG_MENU_DB) return json(503, { ok: false, error: 'Admin disabled' });
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;

  const id = params.id as string;
  if (!id) return json(400, { ok: false, error: 'ID is required' });

  const row = await env.BOG_MENU_DB.prepare('SELECT image_key FROM catalog_banners WHERE id = ?').bind(id).first();
  const result = await env.BOG_MENU_DB.prepare('DELETE FROM catalog_banners WHERE id = ?').bind(id).run();
  if (!result.success || result.meta.changes === 0) {
    return json(404, { ok: false, error: 'Banner not found' });
  }

  let warning: string | undefined;
  if (row?.image_key && env.BOG_MENU_ASSETS) {
    const key = normalizeAssetKey(row.image_key as string);
    if (key && key.startsWith('catalog-banners/')) {
      try {
        await env.BOG_MENU_ASSETS.delete(key);
      } catch {
        warning = 'El banner se eliminó, pero no se pudo borrar su imagen anterior.';
      }
    }
  }

  return json(200, { ok: true, deleted: true, ...(warning ? { warning } : {}) });
};
