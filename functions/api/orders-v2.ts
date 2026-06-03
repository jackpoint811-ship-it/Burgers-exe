import type { OrderV2PaymentMethod, OrderV2Mode, OrderV2 } from '../../packages/config/src';
import { errorResponse, fetchOrderBundle, generateFolio, generateId, json, normalizePhone, parseJsonObject } from './_orders-v2-utils';
import { buildReferralCodeText, normalizeReferralCode, REFERRAL_BURGER_WORDS, type RaffleCampaignRow, type ReferralCodeRow } from './raffles-v2-admin/_utils';

type Env = { BOG_MENU_DB?: D1Database; ORDERS_V2_WRITE_ENABLED?: string };

type CatalogRow = {
  sku: string;
  name: string;
  price_cents: number;
  is_available: number;
  category_key: string;
  tags_json: string;
  badge: string | null;
  promo_label: string | null;
};

type ItemCustomization = {
  name?: string;
  lineKey?: string;
  itemDisplayIndex?: number;
  itemKind?: 'burger' | 'combo' | 'garnish' | 'drink' | 'other';
  removedIngredients: string[];
  extras: Array<{ sku?: string; name: string; price?: number }>;
  burgerNote?: string;
  garnish?: { sku?: string; name: string } | null;
};

type NormalizedPayload = {
  customerName: string;
  customerPhone: string;
  orderMode: OrderV2Mode;
  paymentMethod: OrderV2PaymentMethod;
  notes: string | null;
  items: Array<{ sku: string; qty: number } & ItemCustomization>;
  idempotencyKey: string;
  referralCode: string | null;
};

const ORDER_MODES = new Set<OrderV2Mode>(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>(['cash', 'transfer', 'card', 'unknown']);

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const ITEM_KINDS = new Set(['burger', 'combo', 'garnish', 'drink', 'other']);

const normalizeStringArray = (value: unknown, limit = 20) => Array.isArray(value)
  ? value.map(normalizeString).filter(Boolean).slice(0, limit)
  : [];

const normalizeExtras = (value: unknown): ItemCustomization['extras'] => Array.isArray(value)
  ? value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    const sku = normalizeString(raw.sku);
    const name = normalizeString(raw.name);
    const price = Number(raw.price);
    return { ...(sku ? { sku } : {}), name, ...(Number.isFinite(price) && price >= 0 ? { price } : {}) };
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).slice(0, 20)
  : [];

const normalizeGarnish = (value: unknown): ItemCustomization['garnish'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const sku = normalizeString(raw.sku);
  return { ...(sku ? { sku } : {}), name: normalizeString(raw.name) };
};

const normalizeIdempotencyKey = (request: Request, body: Record<string, unknown>) => {
  const headerKey = normalizeString(request.headers.get('Idempotency-Key'));
  const bodyKey = normalizeString(body.idempotencyKey);
  const resolved = headerKey || bodyKey;
  return resolved || generateId('idem');
};

const validatePayload = (body: Record<string, unknown>, request: Request): NormalizedPayload | Response => {
  const customer = body.customer && typeof body.customer === 'object' && !Array.isArray(body.customer) ? body.customer as Record<string, unknown> : null;
  const customerName = normalizeString(customer?.name);
  const customerPhone = normalizePhone(customer?.phone);
  if (customerName.length < 2 || customerName.length > 80 || customerPhone.length < 10) {
    return errorResponse(400, 'INVALID_CUSTOMER', 'Nombre y teléfono de cliente son requeridos.');
  }

  const orderMode = normalizeString(body.orderMode) as OrderV2Mode;
  if (!ORDER_MODES.has(orderMode)) return errorResponse(400, 'INVALID_ORDER_MODE', 'Modo de entrega inválido.');

  const paymentMethod = (normalizeString(body.paymentMethod) || 'unknown') as OrderV2PaymentMethod;
  if (!PAYMENT_METHODS.has(paymentMethod)) return errorResponse(400, 'INVALID_PAYMENT_METHOD', 'Método de pago inválido.');

  const notesRaw = normalizeString(body.notes);
  if (notesRaw.length > 500) return errorResponse(400, 'INVALID_CUSTOMER', 'Notas exceden el máximo permitido.');

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return errorResponse(400, 'INVALID_ITEMS', 'Agrega entre 1 y 50 líneas de productos.');
  }

  const normalizedItems: NormalizedPayload['items'] = [];
  const qtyBySku = new Map<string, number>();
  const legacyQtyBySku = new Map<string, number>();
  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return errorResponse(400, 'INVALID_ITEMS', 'Item inválido.');
    }
    const item = rawItem as Record<string, unknown>;
    const sku = normalizeString(item.sku);
    const qty = Number(item.qty);
    if (!sku || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return errorResponse(400, 'INVALID_ITEMS', 'SKU y cantidad son requeridos.');
    }
    const nextSkuQty = (qtyBySku.get(sku) ?? 0) + qty;
    if (nextSkuQty > 20) return errorResponse(400, 'INVALID_ITEMS', 'Cantidad máxima por SKU excedida.');
    qtyBySku.set(sku, nextSkuQty);
    const hasCustomizations = Boolean(item.lineKey || item.itemDisplayIndex || item.itemKind || item.removedIngredients || item.extras || item.burgerNote || item.garnish || item.name);
    if (!hasCustomizations) {
      const nextQty = (legacyQtyBySku.get(sku) ?? 0) + qty;
      legacyQtyBySku.set(sku, nextQty);
      continue;
    }
    const itemKind = normalizeString(item.itemKind);
    const burgerNote = normalizeString(item.burgerNote);
    const extras = normalizeExtras(item.extras);
    const garnish = normalizeGarnish(item.garnish);
    if (extras.some((extra) => !extra.sku) || garnish && !garnish.sku) {
      return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'Extras y guarniciones deben incluir SKU válido.');
    }
    normalizedItems.push({
      sku,
      qty,
      name: normalizeString(item.name) || undefined,
      lineKey: normalizeString(item.lineKey) || undefined,
      itemDisplayIndex: Number.isInteger(Number(item.itemDisplayIndex)) ? Number(item.itemDisplayIndex) : undefined,
      itemKind: ITEM_KINDS.has(itemKind) ? itemKind as ItemCustomization['itemKind'] : 'other',
      removedIngredients: normalizeStringArray(item.removedIngredients),
      extras,
      burgerNote: burgerNote.slice(0, 220) || undefined,
      garnish
    });
  }
  normalizedItems.unshift(...[...legacyQtyBySku.entries()].map(([sku, qty]) => ({ sku, qty, removedIngredients: [], extras: [], garnish: null })));

  return {
    customerName,
    customerPhone,
    orderMode,
    paymentMethod,
    notes: notesRaw || null,
    items: normalizedItems,
    idempotencyKey: normalizeIdempotencyKey(request, body),
    referralCode: normalizeReferralCode(body.referralCode) || null
  };
};

const loadCatalogRows = async (db: D1Database, skus: string[]): Promise<CatalogRow[]> => {
  const placeholders = skus.map(() => '?').join(', ');
  const result = await db.prepare(
    `SELECT sku, name, price_cents, is_available, category_key, tags_json, badge, promo_label
     FROM menu_items
     WHERE sku IN (${placeholders})`
  ).bind(...skus).all<CatalogRow>();
  return result.results ?? [];
};

const buildOrderSummary = (order: NonNullable<Awaited<ReturnType<typeof fetchOrderBundle>>>, idempotencyKey: string) => ({
  id: order.id,
  folio: order.folio,
  status: order.status,
  subtotal: order.subtotal,
  total: order.total,
  currency: 'MXN' as const,
  createdAt: order.createdAt,
  idempotencyKey
});


const loadActiveReferralCampaign = async (db: D1Database) => {
  const row = await db.prepare(
    `SELECT * FROM raffle_campaigns_v2
     WHERE is_active = 1
     ORDER BY updated_at DESC, created_at DESC LIMIT 1`
  ).first<RaffleCampaignRow>();
  return row ?? null;
};

const orderHasReferralEligibleItem = (items: NormalizedPayload['items']) => items.some((item) =>
  (item.itemKind === 'burger' || item.itemKind === 'combo') && Math.max(0, Number(item.qty) || 0) > 0
);

const applyReferralCode = async (db: D1Database, params: { referralCode: string | null; orderId: string; customerPhone: string; customerName: string; eligibleForReferral: boolean; now: string }) => {
  if (!params.referralCode) return undefined;
  if (!params.eligibleForReferral) {
    await safeLogOrderEvent(db, { orderId: params.orderId, type: 'RAFFLE_REFERRAL_SKIPPED', detail: { referralCode: params.referralCode, referralAccepted: false, reason: 'no_paid_burger_or_combo' }, now: params.now });
    return false;
  }
  try {
    const campaign = await loadActiveReferralCampaign(db);
    if (!campaign) return false;
    const codeRow = await db.prepare(
      `SELECT * FROM raffle_referral_codes_v2
       WHERE campaign_id = ? AND code = ? AND is_active = 1 LIMIT 1`
    ).bind(campaign.id, params.referralCode).first<ReferralCodeRow>();
    if (!codeRow) return false;
    if (normalizePhone(codeRow.owner_phone) === normalizePhone(params.customerPhone)) return false;
    await db.prepare(
      `INSERT INTO raffle_referrals_v2 (id, campaign_id, referral_code_id, referrer_phone, referrer_name, referred_order_id, referred_customer_phone, referred_customer_name, status, tickets_awarded, invalid_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`
    ).bind(generateId('referral'), campaign.id, codeRow.id, codeRow.owner_phone, codeRow.owner_name, params.orderId, params.customerPhone, params.customerName, Number(campaign.ticket_per_referral) || 2, params.now, params.now).run();
    await db.prepare(
      `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
       VALUES (?, ?, 'RAFFLE_REFERRAL_APPLIED', NULL, NULL, ?, 'public-v2', ?)`
    ).bind(generateId('evt'), params.orderId, JSON.stringify({ referralCode: params.referralCode, referralAccepted: true }), params.now).run();
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) return true;
    try {
      await db.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, 'RAFFLE_REFERRAL_SKIPPED', NULL, NULL, ?, 'public-v2', ?)`
      ).bind(generateId('evt'), params.orderId, JSON.stringify({ referralCode: params.referralCode, referralAccepted: false }), params.now).run();
    } catch {
      // Referral logging must never block a real order.
    }
    return false;
  }
};


type EarnedTickets = {
  burgerTickets: number;
  referralUsedTickets: number;
  totalTickets: number;
};

const safeLogOrderEvent = async (db: D1Database, params: { orderId: string; type: string; detail: Record<string, unknown>; now: string }) => {
  try {
    await db.prepare(
      `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
       VALUES (?, ?, ?, NULL, NULL, ?, 'public-v2', ?)`
    ).bind(generateId('evt'), params.orderId, params.type, JSON.stringify(params.detail), params.now).run();
  } catch {
    // Raffle telemetry must never block a real order.
  }
};

const calculateEarnedTicketsForOrder = (order: OrderV2, campaign: RaffleCampaignRow): EarnedTickets => {
  const ticketPerBurger = Number(campaign.ticket_per_burger) || 1;
  const burgerTickets = order.items.reduce((total, item) => {
    const kind = typeof item.snapshot?.itemKind === 'string' ? item.snapshot.itemKind : null;
    if (kind !== 'burger' && kind !== 'combo') return total;
    return total + Math.max(0, Number(item.qty) || 0) * ticketPerBurger;
  }, 0);
  const referralUsedTickets = 0;
  return { burgerTickets, referralUsedTickets, totalTickets: burgerTickets + referralUsedTickets };
};

const hashReferralSeed = (seed: string) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};

const pickReferralBurgerWord = (seed: string, attempt: number) => {
  const hash = hashReferralSeed(`${seed}:word:${attempt}`);
  return REFERRAL_BURGER_WORDS[hash % REFERRAL_BURGER_WORDS.length];
};

const pickReferralNumber = (seed: string, attempt: number) => {
  const hash = hashReferralSeed(`${seed}:number:${attempt}`);
  return (hash % 99) + 1;
};

const ensureCustomerReferralCode = async (db: D1Database, params: { campaign: RaffleCampaignRow; ownerName: string; ownerPhone: string; orderId: string; now: string }) => {
  const ownerPhone = normalizePhone(params.ownerPhone);
  if (!ownerPhone) return null;
  const existingOwner = await db.prepare(
    'SELECT * FROM raffle_referral_codes_v2 WHERE campaign_id = ? AND owner_phone = ? LIMIT 1'
  ).bind(params.campaign.id, ownerPhone).first<ReferralCodeRow>();
  if (existingOwner?.code) return existingOwner.code;

  const seed = `${params.campaign.id}:${params.orderId}:${ownerPhone}:${params.ownerName}`;
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const burgerWord = pickReferralBurgerWord(seed, attempt);
    const number = pickReferralNumber(seed, attempt);
    const code = buildReferralCodeText(params.ownerName, burgerWord, number);
    if (!code) continue;
    const existingCode = await db.prepare(
      'SELECT id FROM raffle_referral_codes_v2 WHERE campaign_id = ? AND code = ? LIMIT 1'
    ).bind(params.campaign.id, code).first<{ id: string }>();
    if (existingCode) continue;
    try {
      await db.prepare(
        `INSERT INTO raffle_referral_codes_v2 (id, campaign_id, owner_phone, owner_name, code, label_text, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)`
      ).bind(generateId('refcode'), params.campaign.id, ownerPhone, params.ownerName, code, params.now, params.now).run();
      return code;
    } catch (error) {
      const ownerAfterCollision = await db.prepare(
        'SELECT * FROM raffle_referral_codes_v2 WHERE campaign_id = ? AND owner_phone = ? LIMIT 1'
      ).bind(params.campaign.id, ownerPhone).first<ReferralCodeRow>();
      if (ownerAfterCollision?.code) return ownerAfterCollision.code;
      if (!(error instanceof Error && error.message.includes('UNIQUE'))) throw error;
    }
  }
  throw new Error('Could not generate unique customer referral code');
};

const buildRaffleSuccessData = async (db: D1Database, params: { order: OrderV2; orderId: string; ownerName: string; ownerPhone: string; now: string }) => {
  let campaign: RaffleCampaignRow | null = null;
  try {
    campaign = await loadActiveReferralCampaign(db);
  } catch {
    await safeLogOrderEvent(db, { orderId: params.orderId, type: 'RAFFLE_SUCCESS_DATA_SKIPPED', detail: { reason: 'active_campaign_lookup_failed' }, now: params.now });
    return {};
  }
  if (!campaign) return {};
  const data: { customerReferralCode?: string; activeRaffleTitle?: string; earnedTickets?: EarnedTickets } = {
    activeRaffleTitle: campaign.title
  };
  try {
    data.earnedTickets = calculateEarnedTicketsForOrder(params.order, campaign);
  } catch {
    await safeLogOrderEvent(db, { orderId: params.orderId, type: 'RAFFLE_TICKETS_SKIPPED', detail: { reason: 'earned_tickets_calculation_failed' }, now: params.now });
  }
  try {
    const code = await ensureCustomerReferralCode(db, { campaign, ownerName: params.ownerName, ownerPhone: params.ownerPhone, orderId: params.orderId, now: params.now });
    if (code) data.customerReferralCode = code;
  } catch {
    await safeLogOrderEvent(db, { orderId: params.orderId, type: 'RAFFLE_CUSTOMER_CODE_SKIPPED', detail: { reason: 'customer_referral_code_generation_failed' }, now: params.now });
  }
  return data;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.BOG_MENU_DB) return errorResponse(503, 'MISSING_DB', 'BOG_MENU_DB no está configurado.');
  if (env.ORDERS_V2_WRITE_ENABLED !== 'true') return errorResponse(403, 'ORDERING_DISABLED', 'Órdenes V2 deshabilitadas temporalmente.');

  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, 'INVALID_JSON', 'JSON inválido.');

  const parsed = validatePayload(body, request);
  if (parsed instanceof Response) return parsed;

  try {
    const existingRow = await env.BOG_MENU_DB.prepare('SELECT id FROM orders_v2 WHERE idempotency_key = ? LIMIT 1').bind(parsed.idempotencyKey).first<{ id: string }>();
    if (existingRow?.id) {
      const existingOrder = await fetchOrderBundle(env.BOG_MENU_DB, existingRow.id);
      if (!existingOrder) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden idempotente.');
      const raffleData = await buildRaffleSuccessData(env.BOG_MENU_DB, { order: existingOrder, orderId: existingOrder.id, ownerName: existingOrder.customerName || parsed.customerName, ownerPhone: existingOrder.customerPhone || parsed.customerPhone, now: new Date().toISOString() });
      return json(200, { ok: true, data: { order: buildOrderSummary(existingOrder, parsed.idempotencyKey), idempotent: true, ...raffleData } });
    }

    const primarySkus = parsed.items.map((item) => item.sku);
    const customizationSkus = parsed.items.flatMap((item) => [
      ...item.extras.map((extra) => extra.sku).filter((sku): sku is string => Boolean(sku)),
      ...(item.garnish?.sku ? [item.garnish.sku] : [])
    ]);
    const skus = [...new Set([...primarySkus, ...customizationSkus])];
    const catalogRows = await loadCatalogRows(env.BOG_MENU_DB, skus);
    const catalogBySku = new Map(catalogRows.map((row) => [row.sku, row]));
    for (const item of parsed.items) {
      const catalogItem = catalogBySku.get(item.sku);
      if (!catalogItem || Number(catalogItem.is_available) !== 1) {
        return errorResponse(400, 'ITEM_UNAVAILABLE', 'Uno o más productos no existen o no están disponibles.');
      }
      const validExtras = [];
      for (const extra of item.extras) {
        const catalogExtra = extra.sku ? catalogBySku.get(extra.sku) : null;
        if (!catalogExtra || Number(catalogExtra.is_available) !== 1 || catalogExtra.category_key !== 'extras') {
          return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'Uno o más extras no existen, no están disponibles o no son extras.');
        }
        validExtras.push({ sku: catalogExtra.sku, name: catalogExtra.name, price: Number(catalogExtra.price_cents) / 100 });
      }
      item.extras = validExtras;
      if (item.garnish) {
        const catalogGarnish = item.garnish.sku ? catalogBySku.get(item.garnish.sku) : null;
        if (!catalogGarnish || Number(catalogGarnish.is_available) !== 1 || catalogGarnish.category_key !== 'guarniciones') {
          return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'La guarnición no existe, no está disponible o no es guarnición.');
        }
        item.garnish = { sku: catalogGarnish.sku, name: catalogGarnish.name };
      }
    }

    const now = new Date().toISOString();
    const orderId = generateId('ord');
    const folio = generateFolio(new Date(now));
    const orderItems = parsed.items.map((item) => {
      const catalogItem = catalogBySku.get(item.sku)!;
      const unitPriceCents = Number(catalogItem.price_cents);
      const extrasTotalCents = item.extras.reduce((acc, extra) => acc + Math.round((extra.price ?? 0) * 100), 0);
      const lineTotalCents = (unitPriceCents + extrasTotalCents) * item.qty;
      return {
        id: generateId('oi'),
        orderId,
        sku: item.sku,
        name: catalogItem.name,
        qty: item.qty,
        unitPriceCents,
        lineTotalCents,
        snapshotJson: JSON.stringify({
          sku: catalogItem.sku,
          name: catalogItem.name,
          priceCents: unitPriceCents,
          extrasTotalCents,
          category: catalogItem.category_key,
          tags: catalogItem.tags_json,
          badge: catalogItem.badge,
          promoLabel: catalogItem.promo_label,
          lineKey: item.lineKey,
          itemDisplayIndex: item.itemDisplayIndex,
          itemKind: item.itemKind,
          removedIngredients: item.removedIngredients,
          extras: item.extras,
          burgerNote: item.burgerNote,
          garnish: item.garnish
        })
      };
    });
    const subtotalCents = orderItems.reduce((acc, item) => acc + item.lineTotalCents, 0);
    const totalCents = subtotalCents;
    const eventId = generateId('evt');

    const statements: D1PreparedStatement[] = [
      env.BOG_MENU_DB.prepare(
        `INSERT INTO orders_v2 (id, folio, idempotency_key, customer_name, customer_phone, order_mode, payment_method, payment_status, notes, subtotal_cents, total_cents, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'new', 'public-v2', ?, ?)`
      ).bind(orderId, folio, parsed.idempotencyKey, parsed.customerName, parsed.customerPhone, parsed.orderMode, parsed.paymentMethod, parsed.notes, subtotalCents, totalCents, now, now),
      ...orderItems.map((item) => env.BOG_MENU_DB!.prepare(
        `INSERT INTO order_items_v2 (id, order_id, sku, name, qty, unit_price_cents, line_total_cents, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(item.id, item.orderId, item.sku, item.name, item.qty, item.unitPriceCents, item.lineTotalCents, item.snapshotJson, now)),
      env.BOG_MENU_DB.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, 'ORDER_CREATED', NULL, 'new', ?, 'public-v2', ?)`
      ).bind(eventId, orderId, JSON.stringify({ source: 'public-v2', itemCount: orderItems.length, idempotencyKey: parsed.idempotencyKey }), now)
    ];

    const batchResult = await env.BOG_MENU_DB.batch(statements);
    if (!batchResult.every((entry) => entry.success)) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo crear la orden.');

    const referralAccepted = await applyReferralCode(env.BOG_MENU_DB, { referralCode: parsed.referralCode, orderId, customerPhone: parsed.customerPhone, customerName: parsed.customerName, eligibleForReferral: orderHasReferralEligibleItem(parsed.items), now });

    const createdOrder = await fetchOrderBundle(env.BOG_MENU_DB, orderId);
    if (!createdOrder) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden creada.');
    const raffleData = await buildRaffleSuccessData(env.BOG_MENU_DB, { order: createdOrder, orderId, ownerName: parsed.customerName, ownerPhone: parsed.customerPhone, now });
    return json(201, { ok: true, data: { order: buildOrderSummary(createdOrder, parsed.idempotencyKey), ...(referralAccepted === undefined ? {} : { referralAccepted }), ...raffleData } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo crear la orden.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  return onRequestPost(context);
};
