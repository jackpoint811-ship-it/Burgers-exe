import { inferImageContentType, normalizeAssetKey } from '../_asset-utils';

type Env = { BOG_ASSETS_BUCKET?: R2Bucket };

const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = normalizeAssetKey(params.key);
  if (!key || !env.BOG_ASSETS_BUCKET) return notFound();

  const object = await env.BOG_ASSETS_BUCKET.get(key);
  if (!object) return notFound();

  const headers = new Headers();
  headers.set('content-type', object.httpMetadata?.contentType ?? inferImageContentType(key));
  headers.set('cache-control', 'public, max-age=3600');
  headers.set('x-content-type-options', 'nosniff');
  if (object.httpEtag) headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
};

export const onRequestPost: PagesFunction<Env> = async () => new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
export const onRequestPut: PagesFunction<Env> = async () => new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
export const onRequestDelete: PagesFunction<Env> = async () => new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
