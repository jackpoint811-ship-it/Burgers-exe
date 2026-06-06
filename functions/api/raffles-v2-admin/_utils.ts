import type { CreateRaffleCampaignPayload, RaffleCampaignV2, RaffleParticipantSummary, UpdateRaffleCampaignPayload } from '../../../packages/config/src';
import { errorResponse, generateId, json, normalizePhone, parseJsonObject, requireAdminToken, type AdminEnv } from '../_orders-v2-utils';

export type Env = AdminEnv;
export type RaffleCampaignRow = {
  id: string;
  title: string;
  description: string | null;
  rules_text: string | null;
  banner_image_key: string | null;
  banner_image_url: string | null;
  detail_image_key?: string | null;
  detail_image_url?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  ticket_per_burger: number;
  ticket_per_referral: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type OrderTicketRow = {
  order_id: string;
  folio: string;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  qty: number;
  snapshot_json: string;
};

type ReferralTicketRow = {
  referrer_phone: string;
  referrer_name: string;
  tickets_awarded: number;
  created_at: string;
  updated_at: string;
  code: string;
};

type InvitedTicketRow = {
  referred_customer_phone: string;
  referred_customer_name: string;
  referred_order_folio: string | null;
  created_at: string;
  updated_at: string;
};

type ParticipantAccumulator = RaffleParticipantSummary & {
  customerPhoneNormalized: string;
  searchName: string;
  lastActivityAt: string;
};

const MAX_DESCRIPTION_LENGTH = 600;
const MAX_RULES_LENGTH = 3000;
const MAX_ASSET_LENGTH = 800;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-][0-2]\d:[0-5]\d)?)?$/;

export const mapCampaign = (row: RaffleCampaignRow): RaffleCampaignV2 => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  rulesText: row.rules_text ?? undefined,
  bannerImageKey: row.banner_image_key ?? undefined,
  bannerImageUrl: row.banner_image_url ?? undefined,
  detailImageKey: row.detail_image_key ?? undefined,
  detailImageUrl: row.detail_image_url ?? undefined,
  startsAt: row.starts_at ?? undefined,
  endsAt: row.ends_at ?? undefined,
  isActive: Boolean(row.is_active),
  ticketPerBurger: Number(row.ticket_per_burger) || 1,
  ticketPerReferral: Number(row.ticket_per_referral) || 2,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at ?? undefined
});

export const requireRaffleAdmin = async (request: Request, env: Env): Promise<Response | null> => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'D1_NOT_CONFIGURED', 'BOG_MENU_DB no está configurado.');
  return requireAdminToken(request, env);
};

const asTrimmedOptionalString = (value: unknown, maxLength: number, field: string): string | null | Response => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return errorResponse(400, 'INVALID_FIELD', `${field} debe ser texto.`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return errorResponse(400, 'INVALID_FIELD', `${field} excede el máximo permitido.`);
  return trimmed;
};

const asOptionalDate = (value: unknown, field: string): string | null | Response => {
  const text = asTrimmedOptionalString(value, 80, field);
  if (text instanceof Response || text === null) return text;
  if (!DATE_TIME_RE.test(text)) return errorResponse(400, 'INVALID_DATE', `${field} debe usar fecha ISO o YYYY-MM-DD.`);
  return text;
};

const asTicketValue = (value: unknown, defaultValue: number, field: string): number | Response => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return errorResponse(400, 'INVALID_TICKETS', `${field} debe ser un entero de 0 a 100.`);
  return parsed;
};

const asBoolean = (value: unknown, defaultValue: boolean) => {
  if (value === undefined || value === null) return defaultValue;
  return value === true || value === 'true' || value === 1 || value === '1';
};

export const validateCreatePayload = (body: Record<string, unknown>): CreateRaffleCampaignPayload | Response => {
  const title = asTrimmedOptionalString(body.title, 80, 'title');
  if (title instanceof Response) return title;
  if (!title || title.length < 3) return errorResponse(400, 'INVALID_TITLE', 'El título debe tener entre 3 y 80 caracteres.');
  const description = asTrimmedOptionalString(body.description, MAX_DESCRIPTION_LENGTH, 'description');
  if (description instanceof Response) return description;
  const rulesText = asTrimmedOptionalString(body.rulesText, MAX_RULES_LENGTH, 'rulesText');
  if (rulesText instanceof Response) return rulesText;
  const bannerImageUrl = asTrimmedOptionalString(body.bannerImageUrl, MAX_ASSET_LENGTH, 'bannerImageUrl');
  if (bannerImageUrl instanceof Response) return bannerImageUrl;
  const bannerImageKey = asTrimmedOptionalString(body.bannerImageKey, MAX_ASSET_LENGTH, 'bannerImageKey');
  if (bannerImageKey instanceof Response) return bannerImageKey;
  const detailImageUrl = asTrimmedOptionalString(body.detailImageUrl, MAX_ASSET_LENGTH, 'detailImageUrl');
  if (detailImageUrl instanceof Response) return detailImageUrl;
  const detailImageKey = asTrimmedOptionalString(body.detailImageKey, MAX_ASSET_LENGTH, 'detailImageKey');
  if (detailImageKey instanceof Response) return detailImageKey;
  const startsAt = asOptionalDate(body.startsAt, 'startsAt');
  if (startsAt instanceof Response) return startsAt;
  const endsAt = asOptionalDate(body.endsAt, 'endsAt');
  if (endsAt instanceof Response) return endsAt;
  if (startsAt && endsAt && startsAt > endsAt) return errorResponse(400, 'INVALID_DATE_RANGE', 'El rango de fechas es inválido.');
  const ticketPerBurger = asTicketValue(body.ticketPerBurger, 1, 'ticketPerBurger');
  if (ticketPerBurger instanceof Response) return ticketPerBurger;
  const ticketPerReferral = asTicketValue(body.ticketPerReferral, 2, 'ticketPerReferral');
  if (ticketPerReferral instanceof Response) return ticketPerReferral;

  return { title, description: description ?? undefined, rulesText: rulesText ?? undefined, bannerImageUrl: bannerImageUrl ?? undefined, bannerImageKey: bannerImageKey ?? undefined, detailImageUrl: detailImageUrl ?? undefined, detailImageKey: detailImageKey ?? undefined, startsAt: startsAt ?? undefined, endsAt: endsAt ?? undefined, ticketPerBurger, ticketPerReferral, isActive: asBoolean(body.isActive, false) };
};

export const validateUpdatePayload = (body: Record<string, unknown>): UpdateRaffleCampaignPayload | Response => {
  const payload: UpdateRaffleCampaignPayload = {};
  if ('title' in body) {
    const title = asTrimmedOptionalString(body.title, 80, 'title');
    if (title instanceof Response) return title;
    if (!title || title.length < 3) return errorResponse(400, 'INVALID_TITLE', 'El título debe tener entre 3 y 80 caracteres.');
    payload.title = title;
  }
  const stringFields = [
    ['description', MAX_DESCRIPTION_LENGTH],
    ['rulesText', MAX_RULES_LENGTH],
    ['bannerImageUrl', MAX_ASSET_LENGTH],
    ['bannerImageKey', MAX_ASSET_LENGTH],
    ['detailImageUrl', MAX_ASSET_LENGTH],
    ['detailImageKey', MAX_ASSET_LENGTH]
  ] as const;
  for (const [field, max] of stringFields) {
    if (field in body) {
      const value = asTrimmedOptionalString(body[field], max, field);
      if (value instanceof Response) return value;
      payload[field] = value ?? undefined;
    }
  }
  for (const field of ['startsAt', 'endsAt'] as const) {
    if (field in body) {
      const value = asOptionalDate(body[field], field);
      if (value instanceof Response) return value;
      payload[field] = value ?? undefined;
    }
  }
  if (payload.startsAt && payload.endsAt && payload.startsAt > payload.endsAt) return errorResponse(400, 'INVALID_DATE_RANGE', 'El rango de fechas es inválido.');
  if ('ticketPerBurger' in body) {
    const value = asTicketValue(body.ticketPerBurger, 1, 'ticketPerBurger');
    if (value instanceof Response) return value;
    payload.ticketPerBurger = value;
  }
  if ('ticketPerReferral' in body) {
    const value = asTicketValue(body.ticketPerReferral, 2, 'ticketPerReferral');
    if (value instanceof Response) return value;
    payload.ticketPerReferral = value;
  }
  if ('isActive' in body) payload.isActive = asBoolean(body.isActive, false);
  return payload;
};

export const readJsonPayload = async (request: Request) => {
  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, 'INVALID_JSON', 'JSON inválido.');
  return body;
};

export const createCampaign = async (db: D1Database, payload: CreateRaffleCampaignPayload): Promise<RaffleCampaignV2> => {
  const id = generateId('raffle');
  const now = new Date().toISOString();
  const isActive = payload.isActive ? 1 : 0;
  const statements = [];
  if (isActive) statements.push(db.prepare('UPDATE raffle_campaigns_v2 SET is_active = 0, updated_at = ? WHERE is_active = 1 AND deleted_at IS NULL').bind(now));
  statements.push(db.prepare(
    `INSERT INTO raffle_campaigns_v2 (id, title, description, rules_text, banner_image_key, banner_image_url, detail_image_key, detail_image_url, starts_at, ends_at, is_active, ticket_per_burger, ticket_per_referral, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, payload.title, payload.description ?? null, payload.rulesText ?? null, payload.bannerImageKey ?? null, payload.bannerImageUrl ?? null, payload.detailImageKey ?? null, payload.detailImageUrl ?? null, payload.startsAt ?? null, payload.endsAt ?? null, isActive, payload.ticketPerBurger ?? 1, payload.ticketPerReferral ?? 2, now, now));
  await db.batch(statements);
  const row = await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? LIMIT 1').bind(id).first<RaffleCampaignRow>();
  if (!row) throw new Error('Campaign insert failed');
  return mapCampaign(row);
};

export const updateCampaign = async (db: D1Database, id: string, payload: UpdateRaffleCampaignPayload): Promise<RaffleCampaignV2 | null> => {
  const existing = await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? AND deleted_at IS NULL LIMIT 1').bind(id).first<RaffleCampaignRow>();
  if (!existing) return null;
  const now = new Date().toISOString();
  const assignments: string[] = [];
  const bindings: Array<string | number | null> = [];
  const add = (column: string, value: string | number | null) => { assignments.push(`${column} = ?`); bindings.push(value); };
  if ('title' in payload) add('title', payload.title ?? existing.title);
  if ('description' in payload) add('description', payload.description ?? null);
  if ('rulesText' in payload) add('rules_text', payload.rulesText ?? null);
  if ('bannerImageUrl' in payload) add('banner_image_url', payload.bannerImageUrl ?? null);
  if ('bannerImageKey' in payload) add('banner_image_key', payload.bannerImageKey ?? null);
  if ('detailImageUrl' in payload) add('detail_image_url', payload.detailImageUrl ?? null);
  if ('detailImageKey' in payload) add('detail_image_key', payload.detailImageKey ?? null);
  if ('startsAt' in payload) add('starts_at', payload.startsAt ?? null);
  if ('endsAt' in payload) add('ends_at', payload.endsAt ?? null);
  if ('ticketPerBurger' in payload) add('ticket_per_burger', payload.ticketPerBurger ?? 1);
  if ('ticketPerReferral' in payload) add('ticket_per_referral', payload.ticketPerReferral ?? 2);
  if ('isActive' in payload) add('is_active', payload.isActive ? 1 : 0);
  add('updated_at', now);
  const statements = [];
  if (payload.isActive === true) statements.push(db.prepare('UPDATE raffle_campaigns_v2 SET is_active = 0, updated_at = ? WHERE is_active = 1 AND deleted_at IS NULL AND id <> ?').bind(now, id));
  statements.push(db.prepare(`UPDATE raffle_campaigns_v2 SET ${assignments.join(', ')} WHERE id = ?`).bind(...bindings, id));
  await db.batch(statements);
  const row = await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? AND deleted_at IS NULL LIMIT 1').bind(id).first<RaffleCampaignRow>();
  return row ? mapCampaign(row) : null;
};


export const softDeleteCampaign = async (db: D1Database, id: string): Promise<RaffleCampaignV2 | null> => {
  const existing = await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? AND deleted_at IS NULL LIMIT 1').bind(id).first<RaffleCampaignRow>();
  if (!existing) return null;
  const now = new Date().toISOString();
  await db.prepare('UPDATE raffle_campaigns_v2 SET deleted_at = ?, is_active = 0, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(now, now, id).run();
  const row = await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? LIMIT 1').bind(id).first<RaffleCampaignRow>();
  return row ? mapCampaign(row) : null;
};

export const getCampaignForSummary = async (db: D1Database, campaignId: string | null): Promise<RaffleCampaignV2 | null> => {
  const row = campaignId
    ? await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE id = ? AND deleted_at IS NULL LIMIT 1').bind(campaignId).first<RaffleCampaignRow>()
    : await db.prepare('SELECT * FROM raffle_campaigns_v2 WHERE is_active = 1 AND deleted_at IS NULL ORDER BY updated_at DESC, created_at DESC LIMIT 1').first<RaffleCampaignRow>();
  return row ? mapCampaign(row) : null;
};

const maskPhone = (normalized: string) => `****${normalized.slice(-4).padStart(Math.min(4, normalized.length), '*')}`;

const getSnapshotItemKind = (snapshotJson: string): string | null => {
  if (!snapshotJson.trim()) return null;
  try {
    const parsed = JSON.parse(snapshotJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const kind = (parsed as Record<string, unknown>).itemKind;
    return typeof kind === 'string' ? kind : null;
  } catch {
    return null;
  }
};

const toParticipant = (participant: ParticipantAccumulator): RaffleParticipantSummary => ({
  customerName: participant.customerName,
  customerPhoneMasked: participant.customerPhoneMasked,
  burgerTickets: participant.burgerTickets,
  referralTickets: participant.referralTickets,
  totalTickets: participant.totalTickets,
  lastOrderFolio: participant.lastOrderFolio,
  lastOrderAt: participant.lastOrderAt
});

export const calculateSummary = async (db: D1Database, campaign: RaffleCampaignV2 | null, q: string) => {
  if (!campaign) {
    return { totalTickets: 0, totalParticipants: 0, topParticipants: [], participantResults: [] };
  }
  const conditions = ["o.status IN ('new', 'preparing', 'ready', 'delivered')"];
  const bindings: string[] = [];
  const startsAt = campaign.startsAt && /^\d{4}-\d{2}-\d{2}$/.test(campaign.startsAt) ? `${campaign.startsAt}T00:00:00.000Z` : campaign.startsAt;
  const endsAt = campaign.endsAt && /^\d{4}-\d{2}-\d{2}$/.test(campaign.endsAt) ? `${campaign.endsAt}T23:59:59.999Z` : campaign.endsAt;
  if (startsAt) { conditions.push('o.created_at >= ?'); bindings.push(startsAt); }
  if (endsAt) { conditions.push('o.created_at <= ?'); bindings.push(endsAt); }
  const rows = await db.prepare(
    `SELECT o.id AS order_id, o.folio, o.customer_name, o.customer_phone, o.created_at, i.qty, i.snapshot_json
     FROM orders_v2 o
     JOIN order_items_v2 i ON i.order_id = o.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.created_at DESC`
  ).bind(...bindings).all<OrderTicketRow>();

  const byPhone = new Map<string, ParticipantAccumulator>();
  for (const row of rows.results ?? []) {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) continue;
    const itemKind = getSnapshotItemKind(String(row.snapshot_json ?? ''));
    const burgerTickets = itemKind === 'burger' || itemKind === 'combo' ? Math.max(0, Number(row.qty) || 0) * (campaign.ticketPerBurger || 1) : 0;
    if (burgerTickets <= 0 && !byPhone.has(phone)) {
      byPhone.set(phone, {
        customerName: String(row.customer_name || 'Sin nombre'),
        customerPhoneMasked: maskPhone(phone),
        customerPhoneNormalized: phone,
        searchName: String(row.customer_name || '').toLowerCase(),
        burgerTickets: 0,
        referralTickets: 0,
        totalTickets: 0,
        lastOrderFolio: String(row.folio || ''),
        lastOrderAt: String(row.created_at || ''),
        lastActivityAt: String(row.created_at || '')
      });
      continue;
    }
    const current = byPhone.get(phone) ?? {
      customerName: String(row.customer_name || 'Sin nombre'),
      customerPhoneMasked: maskPhone(phone),
      customerPhoneNormalized: phone,
      searchName: String(row.customer_name || '').toLowerCase(),
      burgerTickets: 0,
      referralTickets: 0,
      totalTickets: 0,
      lastOrderFolio: String(row.folio || ''),
      lastOrderAt: String(row.created_at || ''),
      lastActivityAt: String(row.created_at || '')
    };
    current.burgerTickets += burgerTickets;
    current.totalTickets = current.burgerTickets + current.referralTickets;
    if (!current.lastOrderAt || String(row.created_at) > current.lastOrderAt) {
      current.customerName = String(row.customer_name || current.customerName);
      current.searchName = current.customerName.toLowerCase();
      current.lastOrderFolio = String(row.folio || current.lastOrderFolio);
      current.lastOrderAt = String(row.created_at || current.lastOrderAt);
      current.lastActivityAt = String(row.created_at || current.lastActivityAt);
    }
    byPhone.set(phone, current);
  }


  const referralRows = await db.prepare(
    `SELECT referrer_phone, referrer_name, tickets_awarded, created_at, updated_at, '' AS code
     FROM raffle_referrals_v2
     WHERE campaign_id = ? AND status IN ('pending', 'valid')
     ORDER BY updated_at DESC, created_at DESC`
  ).bind(campaign.id).all<ReferralTicketRow>();

  for (const row of referralRows.results ?? []) {
    const phone = normalizePhone(row.referrer_phone);
    if (!phone) continue;
    const activityAt = String(row.updated_at || row.created_at || '');
    const current = byPhone.get(phone) ?? {
      customerName: String(row.referrer_name || 'Sin nombre'),
      customerPhoneMasked: maskPhone(phone),
      customerPhoneNormalized: phone,
      searchName: String(row.referrer_name || '').toLowerCase(),
      burgerTickets: 0,
      referralTickets: 0,
      totalTickets: 0,
      lastOrderFolio: '—',
      lastOrderAt: activityAt,
      lastActivityAt: activityAt
    };
    current.referralTickets += Math.max(0, Number(row.tickets_awarded) || campaign.ticketPerReferral || 2);
    current.totalTickets = current.burgerTickets + current.referralTickets;
    if (!current.lastActivityAt || activityAt > current.lastActivityAt) {
      current.customerName = String(row.referrer_name || current.customerName);
      current.searchName = current.customerName.toLowerCase();
      current.lastActivityAt = activityAt;
      if (!current.lastOrderFolio || current.lastOrderFolio === '—') current.lastOrderAt = activityAt;
    }
    byPhone.set(phone, current);
  }

  const invitedRows = await db.prepare(
    `SELECT r.referred_customer_phone, r.referred_customer_name, o.folio AS referred_order_folio, r.created_at, r.updated_at
     FROM raffle_referrals_v2 r
     LEFT JOIN orders_v2 o ON o.id = r.referred_order_id
     WHERE r.campaign_id = ? AND r.status IN ('pending', 'valid')
     ORDER BY r.updated_at DESC, r.created_at DESC`
  ).bind(campaign.id).all<InvitedTicketRow>();

  for (const row of invitedRows.results ?? []) {
    const phone = normalizePhone(row.referred_customer_phone);
    if (!phone) continue;
    const activityAt = String(row.updated_at || row.created_at || '');
    const current = byPhone.get(phone) ?? {
      customerName: String(row.referred_customer_name || 'Sin nombre'),
      customerPhoneMasked: maskPhone(phone),
      customerPhoneNormalized: phone,
      searchName: String(row.referred_customer_name || '').toLowerCase(),
      burgerTickets: 0,
      referralTickets: 0,
      totalTickets: 0,
      lastOrderFolio: String(row.referred_order_folio || '—'),
      lastOrderAt: activityAt,
      lastActivityAt: activityAt
    };
    current.referralTickets += 1;
    current.totalTickets = current.burgerTickets + current.referralTickets;
    if (!current.lastActivityAt || activityAt > current.lastActivityAt) {
      current.customerName = String(row.referred_customer_name || current.customerName);
      current.searchName = current.customerName.toLowerCase();
      current.lastActivityAt = activityAt;
      if (row.referred_order_folio) current.lastOrderFolio = String(row.referred_order_folio);
      if (!current.lastOrderAt || current.lastOrderFolio === '—') current.lastOrderAt = activityAt;
    }
    byPhone.set(phone, current);
  }

  const participants = [...byPhone.values()]
    .filter((participant) => participant.totalTickets > 0)
    .sort((a, b) => b.totalTickets - a.totalTickets || b.lastActivityAt.localeCompare(a.lastActivityAt));
  const trimmedQ = q.trim();
  const normalizedQ = normalizePhone(trimmedQ);
  const lowerQ = trimmedQ.toLowerCase();
  const participantResults = trimmedQ
    ? participants.filter((participant) => {
        if (participant.searchName.includes(lowerQ)) return true;
        if (normalizedQ && participant.customerPhoneNormalized.includes(normalizedQ)) return true;
        if (normalizedQ.length <= 4 && participant.customerPhoneNormalized.endsWith(normalizedQ)) return true;
        return false;
      }).slice(0, 25).map(toParticipant)
    : [];
  const topParticipants = participants.slice(0, 10).map(toParticipant);
  return {
    totalTickets: participants.reduce((sum, participant) => sum + participant.totalTickets, 0),
    totalParticipants: participants.length,
    topParticipants,
    participantResults
  };
};

export { errorResponse, generateId, json, normalizePhone };

export type ReferralCodeRow = {
  id: string;
  campaign_id: string;
  owner_phone: string;
  owner_name: string;
  code: string;
  label_text: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type ReferralRow = {
  id: string;
  campaign_id: string;
  referral_code_id: string;
  referrer_phone: string;
  referrer_name: string;
  referred_order_id: string;
  referred_customer_phone: string;
  referred_customer_name: string;
  status: string;
  tickets_awarded: number;
  invalid_reason: string | null;
  created_at: string;
  updated_at: string;
  code?: string;
  referred_order_folio?: string;
};

export const REFERRAL_BURGER_WORDS = ['BURGER', 'SMASH', 'BACON', 'PICKLES', 'PICKLE', 'CHEESE', 'FRIES', 'PAPAS', 'TOCINO', 'QUESO', 'CRUNCH', 'BBQ', 'COMBO', 'OG', 'CHEDDAR', 'KETCHUP', 'MOSTAZA'] as const;
export const REFERRAL_STATUSES = ['pending', 'valid', 'invalid'] as const;

export const maskNormalizedPhone = maskPhone;

export const normalizeReferralCode = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 32);

export const normalizeReferralNamePart = (value: unknown) => {
  const firstName = String(value ?? '').trim().split(/\s+/)[0] ?? '';
  return normalizeReferralCode(firstName).replace(/-/g, '').slice(0, 14);
};

export const buildReferralCodeText = (ownerName: string, burgerWord: string, number: number) => {
  const namePart = normalizeReferralNamePart(ownerName);
  const safeWord = REFERRAL_BURGER_WORDS.includes(burgerWord as typeof REFERRAL_BURGER_WORDS[number]) ? burgerWord : '';
  const safeNumber = Number.isInteger(number) && number >= 1 && number <= 100 ? String(number).padStart(2, '0') : '';
  if (!namePart || !safeWord || !safeNumber) return '';
  return normalizeReferralCode(`${namePart}-${safeWord}-${safeNumber}`);
};

export const mapReferralCode = (row: ReferralCodeRow) => ({
  id: row.id,
  campaignId: row.campaign_id,
  ownerName: row.owner_name,
  ownerPhoneMasked: maskPhone(normalizePhone(row.owner_phone)),
  code: row.code,
  labelText: row.label_text ?? undefined,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapReferral = (row: ReferralRow) => ({
  id: row.id,
  campaignId: row.campaign_id,
  code: row.code ?? '',
  referrerName: row.referrer_name,
  referrerPhoneMasked: maskPhone(normalizePhone(row.referrer_phone)),
  referredCustomerName: row.referred_customer_name,
  referredCustomerPhoneMasked: maskPhone(normalizePhone(row.referred_customer_phone)),
  referredOrderFolio: row.referred_order_folio ?? '',
  status: row.status as 'pending' | 'valid' | 'invalid',
  ticketsAwarded: Number(row.tickets_awarded) || 0,
  invalidReason: row.invalid_reason ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
