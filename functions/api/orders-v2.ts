import type { OrderV2PaymentMethod, OrderV2Mode, OrderV2, OrderV2Environment } from '../../packages/config/src';
import {
  errorResponse,
  fetchOrderBundle,
  generateFolio,
  generateId,
  generatePreviewFolio,
  getOrderSourceForEnvironment,
  json,
  normalizePhone,
  parseJsonObject,
  parseOrderEnvironment
} from './_orders-v2-utils';
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
  stock_managed: number;
  stock_remaining: number | null;
};

type OrderExtra = { sku?: string; name: string; price?: number };
type SideQuestExtra = OrderExtra & { itemKind?: 'garnish' | 'drink' };
type ComboBurgerCustomization = {
  sku?: string;
  name: string;
  removedIngredients: string[];
  extras: OrderExtra[];
  burgerNote?: string;
};

type ItemCustomization = {
  name?: string;
  lineKey?: string;
  itemDisplayIndex?: number;
  itemKind?: 'burger' | 'combo' | 'garnish' | 'drink' | 'other';
  removedIngredients: string[];
  extras: OrderExtra[];
  burgerNote?: string;
  garnish?: { sku?: string; name: string; upcharge?: number } | null;
  includedDrink?: { sku?: string; name: string } | null;
  sideQuestExtras: SideQuestExtra[];
  comboBurgers: ComboBurgerCustomization[];
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
  environment: OrderV2Environment;
};

const ORDER_MODES = new Set<OrderV2Mode>(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set<OrderV2PaymentMethod>(['cash', 'transfer', 'card', 'unknown']);

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const ITEM_KINDS = new Set(['burger', 'combo', 'garnish', 'drink', 'other']);
const DRINK_CATEGORY_KEYS = new Set(['drinks', 'bebidas', 'drink', 'beverage']);
const SIDE_QUEST_ITEM_KINDS = new Set(['garnish', 'drink']);

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
  const upcharge = Number(raw.upcharge);
  return { ...(sku ? { sku } : {}), name: normalizeString(raw.name), ...(Number.isFinite(upcharge) && upcharge >= 0 ? { upcharge } : {}) };
};

const normalizeIncludedDrink = (value: unknown): ItemCustomization['includedDrink'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const sku = normalizeString(raw.sku);
  return { ...(sku ? { sku } : {}), name: normalizeString(raw.name) };
};

const normalizeSideQuestExtras = (value: unknown): ItemCustomization['sideQuestExtras'] => Array.isArray(value)
  ? value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    const sku = normalizeString(raw.sku);
    const name = normalizeString(raw.name);
    const price = Number(raw.price);
    const itemKind = normalizeString(raw.itemKind);
    return {
      ...(sku ? { sku } : {}),
      name,
      ...(Number.isFinite(price) && price >= 0 ? { price } : {}),
      ...(SIDE_QUEST_ITEM_KINDS.has(itemKind) ? { itemKind: itemKind as SideQuestExtra['itemKind'] } : {})
    };
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).slice(0, 20)
  : [];

const normalizeComboBurgers = (value: unknown): ItemCustomization['comboBurgers'] => Array.isArray(value)
  ? value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    const sku = normalizeString(raw.sku);
    const name = normalizeString(raw.name);
    if (!name) return null;
    return {
      ...(sku ? { sku } : {}),
      name,
      removedIngredients: normalizeStringArray(raw.removedIngredients),
      extras: normalizeExtras(raw.extras),
      burgerNote: normalizeString(raw.burgerNote).slice(0, 220) || undefined
    };
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).slice(0, 4)
  : [];

const isDrinkCategory = (categoryKey: string) => DRINK_CATEGORY_KEYS.has(categoryKey.trim().toLowerCase());
const isOnionRingCatalogItem = (item: CatalogRow) => {
  const seed = `${item.sku} ${item.name} ${item.tags_json}`.toLowerCase();
  return seed.includes('aro') || seed.includes('onion');
};
const getIncludedGarnishUpchargeCents = (item: CatalogRow) => isOnionRingCatalogItem(item) ? 500 : 0;

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
  const environment = parseOrderEnvironment(body.environment);
  if (!environment) return errorResponse(400, 'INVALID_ENVIRONMENT', 'Ambiente de orden inválido.');

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
    const hasCustomizations = Boolean(item.lineKey || item.itemDisplayIndex || item.itemKind || item.removedIngredients || item.extras || item.burgerNote || item.garnish || item.includedDrink || item.sideQuestExtras || item.comboBurgers || item.name);
    if (!hasCustomizations) {
      const nextQty = (legacyQtyBySku.get(sku) ?? 0) + qty;
      legacyQtyBySku.set(sku, nextQty);
      continue;
    }
    const itemKind = normalizeString(item.itemKind);
    const burgerNote = normalizeString(item.burgerNote);
    const extras = normalizeExtras(item.extras);
    const garnish = normalizeGarnish(item.garnish);
    const includedDrink = normalizeIncludedDrink(item.includedDrink);
    const sideQuestExtras = normalizeSideQuestExtras(item.sideQuestExtras);
    const comboBurgers = normalizeComboBurgers(item.comboBurgers);
    const comboBurgerExtras = comboBurgers.flatMap((burger) => burger.extras);
    if (extras.some((extra) => !extra.sku) || garnish && !garnish.sku || includedDrink && !includedDrink.sku || sideQuestExtras.some((extra) => !extra.sku) || comboBurgerExtras.some((extra) => !extra.sku)) {
      return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'Extras, guarniciones y bebidas deben incluir SKU válido.');
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
      garnish,
      includedDrink,
      sideQuestExtras,
      comboBurgers
    });
  }
  normalizedItems.unshift(...[...legacyQtyBySku.entries()].map(([sku, qty]) => ({ sku, qty, removedIngredients: [], extras: [], garnish: null, includedDrink: null, sideQuestExtras: [], comboBurgers: [] })));

  return {
    customerName,
    customerPhone,
    orderMode,
    paymentMethod,
    notes: notesRaw || null,
    items: normalizedItems,
    idempotencyKey: normalizeIdempotencyKey(request, body),
    referralCode: normalizeReferralCode(body.referralCode) || null,
    environment
  };
};

const loadCatalogRows = async (db: D1Database, skus: string[]): Promise<CatalogRow[]> => {
  const placeholders = skus.map(() => '?').join(', ');
  const result = await db.prepare(
    `SELECT sku, name, price_cents, CASE WHEN stock_managed = 1 AND COALESCE(stock_remaining, 0) <= 0 THEN 0 ELSE is_available END AS is_available, category_key, tags_json, badge, promo_label, stock_managed, stock_remaining
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
     WHERE is_active = 1 AND deleted_at IS NULL
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
    await safeLogOrderEvent(db, {
      orderId: params.orderId,
      type: 'RAFFLE_INVITED_TICKET_AWARDED',
      detail: { referralCode: params.referralCode, referralAccepted: true, referralUsedTickets: 1 },
      now: params.now
    });
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

const calculateEarnedTicketsForOrder = async (db: D1Database, order: OrderV2, campaign: RaffleCampaignRow): Promise<EarnedTickets> => {
  const ticketPerBurger = Number(campaign.ticket_per_burger) || 1;
  const burgerTickets = order.items.reduce((total, item) => {
    const kind = typeof item.snapshot?.itemKind === 'string' ? item.snapshot.itemKind : null;
    if (kind !== 'burger' && kind !== 'combo') return total;
    return total + Math.max(0, Number(item.qty) || 0) * ticketPerBurger;
  }, 0);
  const acceptedReferral = await db.prepare(
    `SELECT id FROM raffle_referrals_v2
     WHERE campaign_id = ? AND referred_order_id = ? AND status IN ('pending', 'valid')
     LIMIT 1`
  ).bind(campaign.id, order.id).first<{ id: string }>();
  const referralUsedTickets = acceptedReferral ? 1 : 0;
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
    data.earnedTickets = await calculateEarnedTicketsForOrder(db, params.order, campaign);
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
  const orderSource = getOrderSourceForEnvironment(parsed.environment);
  const isPreviewOrder = parsed.environment === 'preview';

  try {
    const existingRow = await env.BOG_MENU_DB.prepare('SELECT id FROM orders_v2 WHERE idempotency_key = ? AND source = ? LIMIT 1').bind(parsed.idempotencyKey, orderSource).first<{ id: string }>();
    if (existingRow?.id) {
      const existingOrder = await fetchOrderBundle(env.BOG_MENU_DB, existingRow.id);
      if (!existingOrder) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden idempotente.');
      const raffleData = isPreviewOrder ? {} : await buildRaffleSuccessData(env.BOG_MENU_DB, { order: existingOrder, orderId: existingOrder.id, ownerName: existingOrder.customerName || parsed.customerName, ownerPhone: existingOrder.customerPhone || parsed.customerPhone, now: new Date().toISOString() });
      return json(200, { ok: true, data: { order: buildOrderSummary(existingOrder, parsed.idempotencyKey), idempotent: true, ...raffleData } });
    }

    const primarySkus = parsed.items.map((item) => item.sku);
    const customizationSkus = parsed.items.flatMap((item) => [
      ...item.extras.map((extra) => extra.sku).filter((sku): sku is string => Boolean(sku)),
      ...(item.garnish?.sku ? [item.garnish.sku] : []),
      ...(item.includedDrink?.sku ? [item.includedDrink.sku] : []),
      ...item.sideQuestExtras.map((extra) => extra.sku).filter((sku): sku is string => Boolean(sku)),
      ...item.comboBurgers.flatMap((burger) => burger.extras.map((extra) => extra.sku).filter((sku): sku is string => Boolean(sku)))
    ]);
    const skus = [...new Set([...primarySkus, ...customizationSkus])];
    const catalogRows = await loadCatalogRows(env.BOG_MENU_DB, skus);
    const catalogBySku = new Map(catalogRows.map((row) => [row.sku, row]));
    for (const item of parsed.items) {
      const catalogItem = catalogBySku.get(item.sku);
      if (!catalogItem || Number(catalogItem.is_available) !== 1) {
        return errorResponse(400, 'ITEM_UNAVAILABLE', 'Uno o más productos no existen o no están disponibles.');
      }
      if (item.itemKind === 'combo' && item.qty !== 1) {
        return errorResponse(400, 'INVALID_ITEMS', 'Cada combo debe armarse individualmente.');
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
        item.garnish = { sku: catalogGarnish.sku, name: catalogGarnish.name, upcharge: getIncludedGarnishUpchargeCents(catalogGarnish) / 100 };
      }
      if (item.includedDrink) {
        const catalogDrink = item.includedDrink.sku ? catalogBySku.get(item.includedDrink.sku) : null;
        if (!catalogDrink || Number(catalogDrink.is_available) !== 1 || !isDrinkCategory(catalogDrink.category_key)) {
          return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'La bebida incluida no existe, no está disponible o no es bebida.');
        }
        item.includedDrink = { sku: catalogDrink.sku, name: catalogDrink.name };
      }
      const validSideQuestExtras = [];
      for (const extra of item.sideQuestExtras) {
        const catalogExtra = extra.sku ? catalogBySku.get(extra.sku) : null;
        const categoryKind: SideQuestExtra['itemKind'] | null = catalogExtra?.category_key === 'guarniciones' ? 'garnish' : catalogExtra && isDrinkCategory(catalogExtra.category_key) ? 'drink' : null;
        if (!catalogExtra || Number(catalogExtra.is_available) !== 1 || !categoryKind || extra.itemKind && extra.itemKind !== categoryKind) {
          return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'Una Side Quest extra no existe, no está disponible o no coincide con guarnición/bebida.');
        }
        validSideQuestExtras.push({ sku: catalogExtra.sku, name: catalogExtra.name, price: Number(catalogExtra.price_cents) / 100, itemKind: categoryKind });
      }
      item.sideQuestExtras = validSideQuestExtras;
      const validComboBurgers = [];
      for (const burger of item.comboBurgers) {
        const validBurgerExtras = [];
        for (const extra of burger.extras) {
          const catalogExtra = extra.sku ? catalogBySku.get(extra.sku) : null;
          if (!catalogExtra || Number(catalogExtra.is_available) !== 1 || catalogExtra.category_key !== 'extras') {
            return errorResponse(400, 'INVALID_CUSTOMIZATIONS', 'Uno o más extras de burger de combo no existen o no están disponibles.');
          }
          validBurgerExtras.push({ sku: catalogExtra.sku, name: catalogExtra.name, price: Number(catalogExtra.price_cents) / 100 });
        }
        validComboBurgers.push({ ...burger, extras: validBurgerExtras });
      }
      item.comboBurgers = validComboBurgers;
    }

    for (const item of parsed.items) {
      // Billing source for burger extras is item.extras. Combo burger extras are snapshot detail;
      // if a client omits one from item.extras, normalize it into item.extras once as a compatibility fallback.
      const billedExtraCounts = new Map<string, number>();
      for (const extra of item.extras) billedExtraCounts.set(extra.sku!, (billedExtraCounts.get(extra.sku!) ?? 0) + 1);
      const fallbackExtras: OrderExtra[] = [];
      for (const extra of item.comboBurgers.flatMap((burger) => burger.extras)) {
        const currentCount = billedExtraCounts.get(extra.sku!) ?? 0;
        if (currentCount > 0) {
          billedExtraCounts.set(extra.sku!, currentCount - 1);
        } else {
          fallbackExtras.push(extra);
        }
      }
      if (fallbackExtras.length) item.extras = [...item.extras, ...fallbackExtras];
    }

    const purchasedQtyBySku = new Map<string, number>();
    for (const item of parsed.items) {
      purchasedQtyBySku.set(item.sku, (purchasedQtyBySku.get(item.sku) ?? 0) + item.qty);
      for (const extra of item.extras) purchasedQtyBySku.set(extra.sku!, (purchasedQtyBySku.get(extra.sku!) ?? 0) + item.qty);
      if (item.garnish?.sku) purchasedQtyBySku.set(item.garnish.sku, (purchasedQtyBySku.get(item.garnish.sku) ?? 0) + item.qty);
      if (item.includedDrink?.sku) purchasedQtyBySku.set(item.includedDrink.sku, (purchasedQtyBySku.get(item.includedDrink.sku) ?? 0) + item.qty);
      for (const extra of item.sideQuestExtras) purchasedQtyBySku.set(extra.sku!, (purchasedQtyBySku.get(extra.sku!) ?? 0) + item.qty);
    }
    for (const [sku, qty] of purchasedQtyBySku.entries()) {
      const row = catalogBySku.get(sku);
      if (row && Number(row.stock_managed) === 1 && (row.stock_remaining == null || Number(row.stock_remaining) < qty)) {
        return errorResponse(409, 'INSUFFICIENT_STOCK', 'No hay stock suficiente para completar la orden. Actualiza el menú e intenta de nuevo.');
      }
    }

    const now = new Date().toISOString();
    const orderId = generateId('ord');
    const folio = isPreviewOrder ? generatePreviewFolio(new Date(now)) : generateFolio(new Date(now));
    const orderItems = parsed.items.map((item) => {
      const catalogItem = catalogBySku.get(item.sku)!;
      const unitPriceCents = Number(catalogItem.price_cents);
      const extrasTotalCents = item.extras.reduce((acc, extra) => acc + Math.round((extra.price ?? 0) * 100), 0);
      const sideQuestExtrasTotalCents = item.sideQuestExtras.reduce((acc, extra) => acc + Math.round((extra.price ?? 0) * 100), 0);
      const includedGarnishUpchargeCents = item.garnish?.sku ? Math.round((item.garnish.upcharge ?? 0) * 100) : 0;
      const lineTotalCents = (unitPriceCents + extrasTotalCents + sideQuestExtrasTotalCents + includedGarnishUpchargeCents) * item.qty;
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
          sideQuestExtrasTotalCents,
          includedGarnishUpchargeCents,
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
          garnish: item.garnish,
          includedDrink: item.includedDrink,
          sideQuestExtras: item.sideQuestExtras,
          comboBurgers: item.comboBurgers
        })
      };
    });
    const subtotalCents = orderItems.reduce((acc, item) => acc + item.lineTotalCents, 0);
    const totalCents = subtotalCents;
    const eventId = generateId('evt');

    const stockBySku = new Map<string, number>();
    for (const [sku, qty] of purchasedQtyBySku.entries()) {
      const row = catalogBySku.get(sku);
      if (row && Number(row.stock_managed) === 1) stockBySku.set(sku, qty);
    }

    if (!isPreviewOrder && stockBySku.size > 0) {
      const stockEntries = [...stockBySku.entries()];
      const stockStatements = stockEntries.map(([sku, qty]) => env.BOG_MENU_DB!.prepare(
        `UPDATE menu_items
         SET stock_remaining = stock_remaining - ?,
             sold_out_at = CASE WHEN stock_remaining - ? <= 0 THEN COALESCE(sold_out_at, ?) ELSE sold_out_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE sku = ? AND stock_managed = 1 AND stock_remaining IS NOT NULL AND stock_remaining >= ?`
      ).bind(qty, qty, now, sku, qty));
      const stockResult = await env.BOG_MENU_DB.batch(stockStatements);
      const failedStock = stockResult.some((entry) => !entry.success || (entry.meta?.changes ?? 0) !== 1);
      if (failedStock) {
        const reservedEntries = stockEntries.filter((_, index) => {
          const entry = stockResult[index];
          return Boolean(entry?.success && (entry.meta?.changes ?? 0) === 1);
        });
        if (reservedEntries.length > 0) {
          await env.BOG_MENU_DB.batch(reservedEntries.map(([sku, qty]) => env.BOG_MENU_DB!.prepare(
            `UPDATE menu_items
             SET stock_remaining = COALESCE(stock_remaining, 0) + ?,
                 sold_out_at = CASE WHEN COALESCE(stock_remaining, 0) + ? > 0 THEN NULL ELSE sold_out_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE sku = ? AND stock_managed = 1`
          ).bind(qty, qty, sku)));
        }
        return errorResponse(409, 'INSUFFICIENT_STOCK', 'No hay stock suficiente para completar la orden. Actualiza el menú e intenta de nuevo.');
      }
    }

    const orderStatements: D1PreparedStatement[] = [
      env.BOG_MENU_DB.prepare(
        `INSERT INTO orders_v2 (id, folio, idempotency_key, customer_name, customer_phone, order_mode, payment_method, payment_status, notes, subtotal_cents, total_cents, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'new', ?, ?, ?)`
      ).bind(orderId, folio, parsed.idempotencyKey, parsed.customerName, parsed.customerPhone, parsed.orderMode, parsed.paymentMethod, parsed.notes, subtotalCents, totalCents, orderSource, now, now),
      ...orderItems.map((item) => env.BOG_MENU_DB!.prepare(
        `INSERT INTO order_items_v2 (id, order_id, sku, name, qty, unit_price_cents, line_total_cents, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(item.id, item.orderId, item.sku, item.name, item.qty, item.unitPriceCents, item.lineTotalCents, item.snapshotJson, now)),
      env.BOG_MENU_DB.prepare(
        `INSERT INTO order_events_v2 (id, order_id, type, previous_status, next_status, detail_json, actor, created_at)
         VALUES (?, ?, 'ORDER_CREATED', NULL, 'new', ?, ?, ?)`
      ).bind(eventId, orderId, JSON.stringify({ source: orderSource, environment: parsed.environment, itemCount: orderItems.length, idempotencyKey: parsed.idempotencyKey }), orderSource, now)
    ];

    const orderResult = await env.BOG_MENU_DB.batch(orderStatements);
    if (!orderResult.every((entry) => entry.success)) {
      if (!isPreviewOrder && stockBySku.size > 0) {
        await env.BOG_MENU_DB.batch([...stockBySku.entries()].map(([sku, qty]) => env.BOG_MENU_DB!.prepare(
          `UPDATE menu_items
           SET stock_remaining = COALESCE(stock_remaining, 0) + ?,
               sold_out_at = CASE WHEN COALESCE(stock_remaining, 0) + ? > 0 THEN NULL ELSE sold_out_at END,
               updated_at = CURRENT_TIMESTAMP
           WHERE sku = ? AND stock_managed = 1`
        ).bind(qty, qty, sku)));
      }
      return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo crear la orden.');
    }

    const referralAccepted = isPreviewOrder ? undefined : await applyReferralCode(env.BOG_MENU_DB, { referralCode: parsed.referralCode, orderId, customerPhone: parsed.customerPhone, customerName: parsed.customerName, eligibleForReferral: orderHasReferralEligibleItem(parsed.items), now });

    const createdOrder = await fetchOrderBundle(env.BOG_MENU_DB, orderId);
    if (!createdOrder) return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo recuperar la orden creada.');
    const raffleData = isPreviewOrder ? {} : await buildRaffleSuccessData(env.BOG_MENU_DB, { order: createdOrder, orderId, ownerName: parsed.customerName, ownerPhone: parsed.customerPhone, now });
    return json(201, { ok: true, data: { order: buildOrderSummary(createdOrder, parsed.idempotencyKey), ...(referralAccepted === undefined ? {} : { referralAccepted }), ...raffleData } });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'No se pudo crear la orden.');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  return onRequestPost(context);
};
