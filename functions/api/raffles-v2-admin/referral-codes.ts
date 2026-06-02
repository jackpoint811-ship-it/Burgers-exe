import type { CreateRaffleReferralCodePayload, RaffleReferralCodeMutationResponse, RaffleReferralCodesAdminResponse } from '../../../packages/config/src';
import { buildReferralCodeText, errorResponse, generateId, getCampaignForSummary, json, mapReferralCode, normalizePhone, readJsonPayload, REFERRAL_BURGER_WORDS, requireRaffleAdmin, type Env, type ReferralCodeRow } from './_utils';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const url = new URL(request.url);
  const campaignId = normalizeText(url.searchParams.get('campaignId'));
  const q = normalizeText(url.searchParams.get('q'));
  if (!campaignId) return errorResponse(400, 'CAMPAIGN_REQUIRED', 'campaignId es requerido.');

  try {
    const conditions = ['campaign_id = ?'];
    const bindings: string[] = [campaignId];
    if (q) {
      const normalizedPhone = normalizePhone(q);
      conditions.push('(UPPER(owner_name) LIKE ? OR code LIKE ? OR owner_phone LIKE ?)');
      bindings.push(`%${q.toUpperCase()}%`, `%${q.toUpperCase()}%`, `%${normalizedPhone || q}%`);
    }
    const result = await env.BOG_MENU_DB!.prepare(
      `SELECT * FROM raffle_referral_codes_v2 WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`
    ).bind(...bindings).all<ReferralCodeRow>();
    const payload: RaffleReferralCodesAdminResponse = { ok: true, data: { codes: (result.results ?? []).map(mapReferralCode) } };
    return json(200, payload);
  } catch {
    return errorResponse(500, 'REFERRAL_CODES_LIST_FAILED', 'No se pudieron cargar códigos de invitado.');
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = await requireRaffleAdmin(request, env);
  if (authError) return authError;
  const body = await readJsonPayload(request);
  if (body instanceof Response) return body;
  const payload = body as Partial<CreateRaffleReferralCodePayload>;
  const campaignId = normalizeText(payload.campaignId);
  const ownerName = normalizeText(payload.ownerName);
  const ownerPhone = normalizePhone(payload.ownerPhone);
  const burgerWord = normalizeText(payload.burgerWord).toUpperCase();
  const number = Number(payload.number);
  if (!campaignId) return errorResponse(400, 'CAMPAIGN_REQUIRED', 'campaignId es requerido.');
  if (ownerName.length < 2 || ownerName.length > 80) return errorResponse(400, 'INVALID_OWNER_NAME', 'El nombre debe tener entre 2 y 80 caracteres.');
  if (ownerPhone.length < 10) return errorResponse(400, 'INVALID_OWNER_PHONE', 'Teléfono de participante requerido.');
  if (!REFERRAL_BURGER_WORDS.includes(burgerWord as typeof REFERRAL_BURGER_WORDS[number])) return errorResponse(400, 'INVALID_BURGER_WORD', 'Palabra burger inválida.');
  if (!Number.isInteger(number) || number < 1 || number > 100) return errorResponse(400, 'INVALID_NUMBER', 'El número debe ser entero entre 1 y 100.');
  const code = buildReferralCodeText(ownerName, burgerWord, number);
  if (!code || code.length > 32) return errorResponse(400, 'INVALID_CODE', 'No se pudo generar un código válido.');

  try {
    const campaign = await getCampaignForSummary(env.BOG_MENU_DB!, campaignId);
    if (!campaign) return errorResponse(404, 'RAFFLE_NOT_FOUND', 'Sorteo no encontrado.');
    const existingOwner = await env.BOG_MENU_DB!.prepare('SELECT * FROM raffle_referral_codes_v2 WHERE campaign_id = ? AND owner_phone = ? LIMIT 1').bind(campaignId, ownerPhone).first<ReferralCodeRow>();
    if (existingOwner) {
      const response: RaffleReferralCodeMutationResponse = { ok: true, data: { code: mapReferralCode(existingOwner) } };
      return json(200, response);
    }
    const existingCode = await env.BOG_MENU_DB!.prepare('SELECT id FROM raffle_referral_codes_v2 WHERE campaign_id = ? AND code = ? LIMIT 1').bind(campaignId, code).first<{ id: string }>();
    if (existingCode) return errorResponse(409, 'REFERRAL_CODE_CONFLICT', 'Ese código ya existe para el sorteo. Cambia el número.');
    const id = generateId('refcode');
    const now = new Date().toISOString();
    await env.BOG_MENU_DB!.prepare(
      `INSERT INTO raffle_referral_codes_v2 (id, campaign_id, owner_phone, owner_name, code, label_text, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)`
    ).bind(id, campaignId, ownerPhone, ownerName, code, now, now).run();
    const row = await env.BOG_MENU_DB!.prepare('SELECT * FROM raffle_referral_codes_v2 WHERE id = ? LIMIT 1').bind(id).first<ReferralCodeRow>();
    if (!row) throw new Error('Missing inserted referral code');
    const response: RaffleReferralCodeMutationResponse = { ok: true, data: { code: mapReferralCode(row) } };
    return json(201, response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) return errorResponse(409, 'REFERRAL_CODE_CONFLICT', 'Ya existe un código para ese participante o código.');
    return errorResponse(500, 'REFERRAL_CODES_CREATE_FAILED', 'No se pudo crear el código de invitado.');
  }
};
