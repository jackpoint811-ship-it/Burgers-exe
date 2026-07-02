import { getMenuCatalog } from '../_shared/menu-catalog.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'public, max-age=60, stale-while-revalidate=60' : 'no-store' }
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return jsonResponse(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  try {
    const catalog = await getMenuCatalog(context.env);
    return jsonResponse(200, {
      ok: true,
      source: catalog.source,
      burgers: catalog.burgers,
      sides: catalog.sides,
      extras: catalog.extras,
      data: catalog.data,
      warnings: catalog.warnings,
      timestamp: catalog.timestamp
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: {
        code: 'MENU_D1_UNAVAILABLE',
        message: 'No se pudo cargar el menú desde D1.',
        detail: error && error.message ? error.message : 'Error desconocido'
      }
    });
  }
}
