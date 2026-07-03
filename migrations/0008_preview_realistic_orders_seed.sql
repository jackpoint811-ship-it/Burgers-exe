-- PREVIEW/TEST ONLY.
-- Fase 7B.1 prepares realistic preview fixtures for later authorized use.
-- Do not execute against production or live resources.
-- This file is intentionally non-destructive and preserves existing orders.
-- Future remote execution requires explicit authorization and verified preview bindings.

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT INTO orders_v2 (
  id,
  folio,
  idempotency_key,
  customer_name,
  customer_phone,
  order_mode,
  payment_method,
  payment_status,
  notes,
  subtotal_cents,
  total_cents,
  status,
  source,
  created_at,
  updated_at
) VALUES (
  'fixture-preview-order-1001',
  'PVW-1001',
  'fixture-preview-idempotency-1001',
  'Andrea Torres',
  '+520000000001',
  'delivery',
  'transfer',
  'paid',
  '[FIXTURE:PREVIEW_REALISTIC_ORDERS] Ubicación: Torre Valcob. Entrega en lobby, sin datos reales.',
  27900,
  27900,
  'new',
  'public-v2-preview',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 minutes'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 minutes')
) ON CONFLICT(id) DO UPDATE SET
  folio = excluded.folio,
  idempotency_key = excluded.idempotency_key,
  customer_name = excluded.customer_name,
  customer_phone = excluded.customer_phone,
  order_mode = excluded.order_mode,
  payment_method = excluded.payment_method,
  payment_status = excluded.payment_status,
  notes = excluded.notes,
  subtotal_cents = excluded.subtotal_cents,
  total_cents = excluded.total_cents,
  status = excluded.status,
  source = excluded.source,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

INSERT INTO orders_v2 (
  id,
  folio,
  idempotency_key,
  customer_name,
  customer_phone,
  order_mode,
  payment_method,
  payment_status,
  notes,
  subtotal_cents,
  total_cents,
  status,
  source,
  created_at,
  updated_at
) VALUES (
  'fixture-preview-order-1002',
  'PVW-1002',
  'fixture-preview-idempotency-1002',
  'Carlos Medina',
  '+520000000002',
  'pickup',
  'cash',
  'pending',
  '[FIXTURE:PREVIEW_REALISTIC_ORDERS] Ubicación: Torre GGA. Pick up en mostrador, sin datos reales.',
  19800,
  19800,
  'preparing',
  'public-v2-preview',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-16 minutes'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-16 minutes')
) ON CONFLICT(id) DO UPDATE SET
  folio = excluded.folio,
  idempotency_key = excluded.idempotency_key,
  customer_name = excluded.customer_name,
  customer_phone = excluded.customer_phone,
  order_mode = excluded.order_mode,
  payment_method = excluded.payment_method,
  payment_status = excluded.payment_status,
  notes = excluded.notes,
  subtotal_cents = excluded.subtotal_cents,
  total_cents = excluded.total_cents,
  status = excluded.status,
  source = excluded.source,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

INSERT INTO orders_v2 (
  id,
  folio,
  idempotency_key,
  customer_name,
  customer_phone,
  order_mode,
  payment_method,
  payment_status,
  notes,
  subtotal_cents,
  total_cents,
  status,
  source,
  created_at,
  updated_at
) VALUES (
  'fixture-preview-order-1003',
  'PVW-1003',
  'fixture-preview-idempotency-1003',
  'Mariana Rios',
  '+520000000003',
  'delivery',
  'card',
  'paid',
  '[FIXTURE:PREVIEW_REALISTIC_ORDERS] Ubicación: Torre Valcob. Referencia ficticia de QA preview.',
  34600,
  34600,
  'ready',
  'public-v2-preview',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 minutes'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 minutes')
) ON CONFLICT(id) DO UPDATE SET
  folio = excluded.folio,
  idempotency_key = excluded.idempotency_key,
  customer_name = excluded.customer_name,
  customer_phone = excluded.customer_phone,
  order_mode = excluded.order_mode,
  payment_method = excluded.payment_method,
  payment_status = excluded.payment_status,
  notes = excluded.notes,
  subtotal_cents = excluded.subtotal_cents,
  total_cents = excluded.total_cents,
  status = excluded.status,
  source = excluded.source,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

INSERT INTO order_items_v2 (
  id,
  order_id,
  sku,
  name,
  qty,
  unit_price_cents,
  line_total_cents,
  snapshot_json,
  created_at
) VALUES (
  'fixture-preview-item-1001-1',
  'fixture-preview-order-1001',
  'classic-burger',
  'Classic Burger',
  2,
  10900,
  21800,
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","sku":"classic-burger","name":"Classic Burger","priceCents":10900,"category":"burgers","tags":"[]","lineKey":"pvw-1001-line-1","itemDisplayIndex":1,"itemKind":"burger","removedIngredients":[],"extras":[{"sku":"extra-cheese","name":"Queso","price":0}],"garnish":null,"includedDrink":null,"sideQuestExtras":[],"comboBurgers":[]}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  sku = excluded.sku,
  name = excluded.name,
  qty = excluded.qty,
  unit_price_cents = excluded.unit_price_cents,
  line_total_cents = excluded.line_total_cents,
  snapshot_json = excluded.snapshot_json,
  created_at = excluded.created_at;

INSERT INTO order_items_v2 (
  id,
  order_id,
  sku,
  name,
  qty,
  unit_price_cents,
  line_total_cents,
  snapshot_json,
  created_at
) VALUES (
  'fixture-preview-item-1001-2',
  'fixture-preview-order-1001',
  'loaded-fries',
  'Loaded Fries',
  1,
  6100,
  6100,
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","sku":"loaded-fries","name":"Loaded Fries","priceCents":6100,"category":"guarniciones","tags":"[]","lineKey":"pvw-1001-line-2","itemDisplayIndex":2,"itemKind":"garnish","removedIngredients":[],"extras":[],"garnish":null,"includedDrink":null,"sideQuestExtras":[],"comboBurgers":[]}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  sku = excluded.sku,
  name = excluded.name,
  qty = excluded.qty,
  unit_price_cents = excluded.unit_price_cents,
  line_total_cents = excluded.line_total_cents,
  snapshot_json = excluded.snapshot_json,
  created_at = excluded.created_at;

INSERT INTO order_items_v2 (
  id,
  order_id,
  sku,
  name,
  qty,
  unit_price_cents,
  line_total_cents,
  snapshot_json,
  created_at
) VALUES (
  'fixture-preview-item-1002-1',
  'fixture-preview-order-1002',
  'smash-burger',
  'Smash Burger',
  1,
  12900,
  12900,
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","sku":"smash-burger","name":"Smash Burger","priceCents":12900,"category":"burgers","tags":"[]","lineKey":"pvw-1002-line-1","itemDisplayIndex":1,"itemKind":"burger","removedIngredients":[],"extras":[],"garnish":null,"includedDrink":null,"sideQuestExtras":[{"sku":"onion-rings","name":"Aros","price":0,"itemKind":"garnish"}],"comboBurgers":[]}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-16 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  sku = excluded.sku,
  name = excluded.name,
  qty = excluded.qty,
  unit_price_cents = excluded.unit_price_cents,
  line_total_cents = excluded.line_total_cents,
  snapshot_json = excluded.snapshot_json,
  created_at = excluded.created_at;

INSERT INTO order_items_v2 (
  id,
  order_id,
  sku,
  name,
  qty,
  unit_price_cents,
  line_total_cents,
  snapshot_json,
  created_at
) VALUES (
  'fixture-preview-item-1002-2',
  'fixture-preview-order-1002',
  'house-drink',
  'House Drink',
  1,
  6900,
  6900,
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","sku":"house-drink","name":"House Drink","priceCents":6900,"category":"drinks","tags":"[]","lineKey":"pvw-1002-line-2","itemDisplayIndex":2,"itemKind":"drink","removedIngredients":[],"extras":[],"garnish":null,"includedDrink":null,"sideQuestExtras":[],"comboBurgers":[]}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-16 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  sku = excluded.sku,
  name = excluded.name,
  qty = excluded.qty,
  unit_price_cents = excluded.unit_price_cents,
  line_total_cents = excluded.line_total_cents,
  snapshot_json = excluded.snapshot_json,
  created_at = excluded.created_at;

INSERT INTO order_items_v2 (
  id,
  order_id,
  sku,
  name,
  qty,
  unit_price_cents,
  line_total_cents,
  snapshot_json,
  created_at
) VALUES (
  'fixture-preview-item-1003-1',
  'fixture-preview-order-1003',
  'double-bacon',
  'Double Bacon',
  2,
  14900,
  29800,
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","sku":"double-bacon","name":"Double Bacon","priceCents":14900,"category":"burgers","tags":"[]","lineKey":"pvw-1003-line-1","itemDisplayIndex":1,"itemKind":"burger","removedIngredients":[],"extras":[{"sku":"extra-bacon","name":"Tocino","price":0}],"garnish":{"sku":"loaded-fries","name":"Papas","upcharge":0},"includedDrink":null,"sideQuestExtras":[],"comboBurgers":[]}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  sku = excluded.sku,
  name = excluded.name,
  qty = excluded.qty,
  unit_price_cents = excluded.unit_price_cents,
  line_total_cents = excluded.line_total_cents,
  snapshot_json = excluded.snapshot_json,
  created_at = excluded.created_at;

INSERT INTO order_items_v2 (
  id,
  order_id,
  sku,
  name,
  qty,
  unit_price_cents,
  line_total_cents,
  snapshot_json,
  created_at
) VALUES (
  'fixture-preview-item-1003-2',
  'fixture-preview-order-1003',
  'onion-rings',
  'Onion Rings',
  1,
  4800,
  4800,
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","sku":"onion-rings","name":"Onion Rings","priceCents":4800,"category":"guarniciones","tags":"[]","lineKey":"pvw-1003-line-2","itemDisplayIndex":2,"itemKind":"garnish","removedIngredients":[],"extras":[],"garnish":null,"includedDrink":null,"sideQuestExtras":[],"comboBurgers":[]}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  sku = excluded.sku,
  name = excluded.name,
  qty = excluded.qty,
  unit_price_cents = excluded.unit_price_cents,
  line_total_cents = excluded.line_total_cents,
  snapshot_json = excluded.snapshot_json,
  created_at = excluded.created_at;

INSERT INTO order_events_v2 (
  id,
  order_id,
  type,
  previous_status,
  next_status,
  detail_json,
  actor,
  created_at
) VALUES (
  'fixture-preview-event-1001-created',
  'fixture-preview-order-1001',
  'created',
  NULL,
  'new',
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","source":"public-v2-preview"}',
  'preview-seed',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  type = excluded.type,
  previous_status = excluded.previous_status,
  next_status = excluded.next_status,
  detail_json = excluded.detail_json,
  actor = excluded.actor,
  created_at = excluded.created_at;

INSERT INTO order_events_v2 (
  id,
  order_id,
  type,
  previous_status,
  next_status,
  detail_json,
  actor,
  created_at
) VALUES (
  'fixture-preview-event-1002-preparing',
  'fixture-preview-order-1002',
  'status_changed',
  'new',
  'preparing',
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","source":"public-v2-preview"}',
  'preview-seed',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  type = excluded.type,
  previous_status = excluded.previous_status,
  next_status = excluded.next_status,
  detail_json = excluded.detail_json,
  actor = excluded.actor,
  created_at = excluded.created_at;

INSERT INTO order_events_v2 (
  id,
  order_id,
  type,
  previous_status,
  next_status,
  detail_json,
  actor,
  created_at
) VALUES (
  'fixture-preview-event-1003-ready',
  'fixture-preview-order-1003',
  'status_changed',
  'preparing',
  'ready',
  '{"fixture":"PREVIEW_REALISTIC_ORDERS","source":"public-v2-preview"}',
  'preview-seed',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 minutes')
) ON CONFLICT(id) DO UPDATE SET
  order_id = excluded.order_id,
  type = excluded.type,
  previous_status = excluded.previous_status,
  next_status = excluded.next_status,
  detail_json = excluded.detail_json,
  actor = excluded.actor,
  created_at = excluded.created_at;

COMMIT;
