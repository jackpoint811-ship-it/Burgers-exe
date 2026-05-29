PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders_v2 (
  id TEXT PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  order_mode TEXT NOT NULL CHECK (order_mode IN ('pickup', 'delivery')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card', 'unknown')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  notes TEXT,
  subtotal_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'preparing', 'ready', 'delivered', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'public-v2',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items_v2 (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders_v2(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS order_events_v2 (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders_v2(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_orders_v2_status_created
ON orders_v2(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_v2_created
ON orders_v2(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_v2_idempotency
ON orders_v2(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_order_items_v2_order
ON order_items_v2(order_id);

CREATE INDEX IF NOT EXISTS idx_order_events_v2_order_created
ON order_events_v2(order_id, created_at DESC);
