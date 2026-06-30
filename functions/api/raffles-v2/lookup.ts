import type { RaffleTicketsLookupResponse, RaffleTicketsLookupResult } from '../../../packages/config/src';
import { errorResponse, json, normalizePhone } from '../_orders-v2-utils';

type Env = { BOG_MENU_DB?: D1Database };

type RaffleCampaignRow = {
  id: string;
  title: string;
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
  folio: string;
  customer_name: string;
  created_at: string;
  qty: number;
  snapshot_json: string;
};

type ReferralTicketRow = {
  referrer_name: string;
  tickets_awarded: number;
  created_at: string;
  updated_at: string;
};

type InvitedTicketRow = {
  referred_customer_name: string;
  referred_order_folio: string | null;
  created_at: string;
  updated_at: string;
};

type ReferralCodeLookupRow = {
  code: string;
  owner_name: string;
  owner_phone: string;
  is_active: number;
};

type ParticipantAccumulator = NonNullable<RaffleTicketsLookupResult['participant']> & {
  lastActivityAt: string;
};

const normalizeLookupCode = (value: unknown) => String(value ?? '').trim().toUpperCase().slice(0, 32);
const maskPhone = (normalized: string) => `****${normalized.slice(-4).padStart(Math.min(4, normalized.length), '*')}`;
const makeParticipantKey = (normalizedPhone: string) => {
  let hash = 0x811c9dc5;
  for (const char of normalizedPhone) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `pk-${(hash >>> 0).toString(36)}-${normalizedPhone.length.toString(36)}`;
};

const mapPublicCampaign = (row: RaffleCampaignRow): RaffleTicketsLookupResult['campaign'] => ({
  id: row.id,
  title: row.title,
  ticketPerBurger: Number(row.ticket_per_burger) || 1,
  ticketPerReferral: Number(row.ticket_per_referral) || 2
});

const emptyResult = (campaign: RaffleTicketsLookupResult['campaign'] | null): RaffleTicketsLookupResponse => ({
  ok: true,
  data: { found: false, campaign, participant: null, referralCode: null }
});

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

const campaignDateBounds = (campaign: RaffleCampaignRow) => ({
  startsAt: campaign.starts_at && /^\d{4}-\d{2}-\d{2}$/.test(campaign.starts_at) ? `${campaign.starts_at}T00:00:00.000Z` : campaign.starts_at,
  endsAt: campaign.ends_at && /^\d{4}-\d{2}-\d{2}$/.test(campaign.ends_at) ? `${campaign.ends_at}T23:59:59.999Z` : campaign.ends_at
});

const loadActiveCampaign = async (db: D1Database) => db.prepare(
  `SELECT id, title, starts_at, ends_at, is_active, ticket_per_burger, ticket_per_referral, created_at, updated_at
   FROM raffle_campaigns_v2
   WHERE is_active = 1 AND deleted_at IS NULL
   ORDER BY updated_at DESC, created_at DESC
   LIMIT 1`
).first<RaffleCampaignRow>();

const loadReferralCodeByCode = async (db: D1Database, campaignId: string, code: string) => db.prepare(
  `SELECT code, owner_name, owner_phone, is_active
   FROM raffle_referral_codes_v2
   WHERE campaign_id = ? AND code = ?
   LIMIT 1`
).bind(campaignId, code).first<ReferralCodeLookupRow>();

const loadReferralCodeByPhone = async (db: D1Database, campaignId: string, phone: string) => db.prepare(
  `SELECT code, owner_name, owner_phone, is_active
   FROM raffle_referral_codes_v2
   WHERE campaign_id = ? AND owner_phone = ?
   LIMIT 1`
).bind(campaignId, phone).first<ReferralCodeLookupRow>();

const mapReferralCode = (row: ReferralCodeLookupRow | null | undefined): RaffleTicketsLookupResult['referralCode'] => row ? ({
  code: row.code,
  ownerName: row.owner_name,
  ownerPhoneMasked: maskPhone(normalizePhone(row.owner_phone)),
  isActive: Boolean(row.is_active)
}) : null;

const loadParticipant = async (db: D1Database, campaign: RaffleCampaignRow, phone: string): Promise<RaffleTicketsLookupResult['participant']> => {
  const ticketPerBurger = Number(campaign.ticket_per_burger) || 1;
  const ticketPerReferral = Number(campaign.ticket_per_referral) || 2;
  const participantKey = makeParticipantKey(phone);
  const { startsAt, endsAt } = campaignDateBounds(campaign);
  const orderConditions = ["o.status IN ('new', 'preparing', 'ready', 'delivered')", "o.source = 'public-v2'", 'o.customer_phone = ?'];
  const orderBindings: string[] = [phone];
  if (startsAt) { orderConditions.push('o.created_at >= ?'); orderBindings.push(startsAt); }
  if (endsAt) { orderConditions.push('o.created_at <= ?'); orderBindings.push(endsAt); }

  const makeParticipant = (base: Pick<ParticipantAccumulator, 'customerName' | 'customerPhoneMasked' | 'lastOrderFolio' | 'lastOrderAt' | 'lastActivityAt'>): ParticipantAccumulator => ({
    participantKey: makeParticipantKey(phone),
    customerName: base.customerName,
    customerPhoneMasked: base.customerPhoneMasked,
    burgerTickets: 0,
    referralTickets: 0,
    manualExtraTickets: 0,
    totalTickets: 0,
    lastOrderFolio: base.lastOrderFolio,
    lastOrderAt: base.lastOrderAt,
    lastActivityAt: base.lastActivityAt
  });

  const orderRows = await db.prepare(
    `SELECT o.folio, o.customer_name, o.created_at, i.qty, i.snapshot_json
     FROM orders_v2 o
     JOIN order_items_v2 i ON i.order_id = o.id
     WHERE ${orderConditions.join(' AND ')}
     ORDER BY o.created_at DESC`
  ).bind(...orderBindings).all<OrderTicketRow>();

  let participant: ParticipantAccumulator | null = null;
  for (const row of orderRows.results ?? []) {
    const itemKind = getSnapshotItemKind(String(row.snapshot_json ?? ''));
    const burgerTickets = itemKind === 'burger' || itemKind === 'combo'
      ? Math.max(0, Number(row.qty) || 0) * ticketPerBurger
      : 0;
    const rowCreatedAt = String(row.created_at || '');
    const currentParticipant = participant ?? (participant = makeParticipant({
      customerName: String(row.customer_name || 'Sin nombre'),
      customerPhoneMasked: maskPhone(phone),
      lastOrderFolio: String(row.folio || '—'),
      lastOrderAt: rowCreatedAt,
      lastActivityAt: rowCreatedAt
    }));
    currentParticipant.burgerTickets += burgerTickets;
    if (rowCreatedAt && (!currentParticipant.lastOrderAt || rowCreatedAt > currentParticipant.lastOrderAt)) {
      currentParticipant.customerName = String(row.customer_name || currentParticipant.customerName);
      currentParticipant.lastOrderFolio = String(row.folio || currentParticipant.lastOrderFolio || '—');
      currentParticipant.lastOrderAt = rowCreatedAt;
    }
  }

  const referralRows = await db.prepare(
    `SELECT referrer_name, tickets_awarded, created_at, updated_at
     FROM raffle_referrals_v2
     WHERE campaign_id = ? AND referrer_phone = ? AND status IN ('pending', 'valid')
     ORDER BY updated_at DESC, created_at DESC`
  ).bind(campaign.id, phone).all<ReferralTicketRow>();

  for (const row of referralRows.results ?? []) {
    const activityAt = String(row.updated_at || row.created_at || '');
    const currentParticipant = participant ?? (participant = makeParticipant({
      customerName: String(row.referrer_name || 'Sin nombre'),
      customerPhoneMasked: maskPhone(phone),
      lastOrderFolio: '—',
      lastOrderAt: activityAt,
      lastActivityAt: activityAt
    }));
    currentParticipant.referralTickets += Math.max(0, Number(row.tickets_awarded) || ticketPerReferral);
    if (activityAt && (!currentParticipant.lastActivityAt || activityAt > currentParticipant.lastActivityAt)) {
      currentParticipant.customerName = String(row.referrer_name || currentParticipant.customerName);
      currentParticipant.lastActivityAt = activityAt;
      if (!currentParticipant.lastOrderAt || currentParticipant.lastOrderFolio === '—') currentParticipant.lastOrderAt = activityAt;
    }
  }

  const invitedRows = await db.prepare(
    `SELECT r.referred_customer_name, o.folio AS referred_order_folio, r.created_at, r.updated_at
     FROM raffle_referrals_v2 r
     LEFT JOIN orders_v2 o ON o.id = r.referred_order_id
     WHERE r.campaign_id = ? AND r.referred_customer_phone = ? AND r.status IN ('pending', 'valid')
     ORDER BY r.updated_at DESC, r.created_at DESC`
  ).bind(campaign.id, phone).all<InvitedTicketRow>();

  for (const row of invitedRows.results ?? []) {
    const activityAt = String(row.updated_at || row.created_at || '');
    const currentParticipant = participant ?? (participant = makeParticipant({
      customerName: String(row.referred_customer_name || 'Sin nombre'),
      customerPhoneMasked: maskPhone(phone),
      lastOrderFolio: String(row.referred_order_folio || '—'),
      lastOrderAt: activityAt,
      lastActivityAt: activityAt
    }));
    currentParticipant.referralTickets += 1;
    if (activityAt && (!currentParticipant.lastActivityAt || activityAt > currentParticipant.lastActivityAt)) {
      currentParticipant.customerName = String(row.referred_customer_name || currentParticipant.customerName);
      currentParticipant.lastActivityAt = activityAt;
      if (row.referred_order_folio) currentParticipant.lastOrderFolio = String(row.referred_order_folio);
      if (!currentParticipant.lastOrderAt || currentParticipant.lastOrderFolio === '—') currentParticipant.lastOrderAt = activityAt;
    }
  }

  const manualExtraTicketsRow = await db.prepare(
    `SELECT COALESCE(SUM(tickets_delta), 0) AS manual_extra_tickets
     FROM raffle_ticket_adjustments_v2
     WHERE campaign_id = ? AND participant_key = ? AND status = 'active'`
  ).bind(campaign.id, participantKey).first<{ manual_extra_tickets: number }>();

  const manualExtraTickets = Math.max(0, Number(manualExtraTicketsRow?.manual_extra_tickets) || 0);
  if (!participant && manualExtraTickets > 0) {
    const latestAdjustmentRow = await db.prepare(
      `SELECT participant_name, participant_phone_masked, created_at, updated_at
       FROM raffle_ticket_adjustments_v2
       WHERE campaign_id = ? AND participant_key = ? AND status = 'active'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    ).bind(campaign.id, participantKey).first<{ participant_name: string; participant_phone_masked: string; created_at: string; updated_at: string }>();
    const lastAdjustmentAt = String(latestAdjustmentRow?.updated_at || latestAdjustmentRow?.created_at || '');
    participant = makeParticipant({
      customerName: String(latestAdjustmentRow?.participant_name || 'Sin nombre'),
      customerPhoneMasked: String(latestAdjustmentRow?.participant_phone_masked || maskPhone(phone)),
      lastOrderFolio: '—',
      lastOrderAt: '',
      lastActivityAt: lastAdjustmentAt
    });
  }

  if (!participant) return null;
  participant.manualExtraTickets = manualExtraTickets;
  participant.totalTickets = participant.burgerTickets + participant.referralTickets + participant.manualExtraTickets;
  if (participant.totalTickets <= 0) return null;
  const { lastActivityAt: _lastActivityAt, ...safeParticipant } = participant;
  return safeParticipant;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return json(200, emptyResult(null));

  const url = new URL(request.url);
  const phone = normalizePhone(url.searchParams.get('phone'));
  const code = normalizeLookupCode(url.searchParams.get('code'));

  if (!phone && !code) return errorResponse(400, 'LOOKUP_REQUIRED', 'Ingresa teléfono o código referido.');
  if (phone && phone.length < 10) return errorResponse(400, 'INVALID_PHONE', 'El teléfono debe tener al menos 10 dígitos.');
  if (code && code.length > 32) return errorResponse(400, 'INVALID_CODE', 'El código referido es inválido.');

  try {
    const campaign = await loadActiveCampaign(env.BOG_MENU_DB);
    if (!campaign) return json(200, emptyResult(null));
    const publicCampaign = mapPublicCampaign(campaign);

    const rawCodeRow = code ? await loadReferralCodeByCode(env.BOG_MENU_DB, campaign.id, code) : null;
    const codeRow = phone && rawCodeRow && normalizePhone(rawCodeRow.owner_phone) !== phone ? null : rawCodeRow;
    const lookupPhone = phone || (codeRow ? normalizePhone(codeRow.owner_phone) : '');
    const participant = lookupPhone ? await loadParticipant(env.BOG_MENU_DB, campaign, lookupPhone) : null;
    const phoneCodeRow = !codeRow && lookupPhone ? await loadReferralCodeByPhone(env.BOG_MENU_DB, campaign.id, lookupPhone) : null;
    const referralCode = mapReferralCode(codeRow ?? phoneCodeRow);
    const found = Boolean(participant || referralCode);
    const payload: RaffleTicketsLookupResponse = {
      ok: true,
      data: { found, campaign: publicCampaign, participant, referralCode }
    };
    return json(200, payload);
  } catch {
    return errorResponse(500, 'RAFFLE_LOOKUP_FAILED', 'No pudimos consultar tickets en este momento.');
  }
};
