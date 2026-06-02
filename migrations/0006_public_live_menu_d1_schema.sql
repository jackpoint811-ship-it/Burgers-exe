PRAGMA foreign_keys = ON;

-- Live Menu runtime source for Cloudflare Pages Functions.
-- Reuses the v2 menu_items shape when it already exists and creates it for fresh D1 DBs.
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  category_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  tags_json TEXT NOT NULL DEFAULT '[]',
  badge TEXT,
  promo_label TEXT,
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  image_key TEXT,
  combo_links_json TEXT NOT NULL DEFAULT '[]',
  upsell_items_json TEXT NOT NULL DEFAULT '[]',
  origin_cost_ref TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_key) REFERENCES menu_categories(key)
);

-- Public order line table for future D1 order persistence. The current public endpoint
-- still forwards orders upstream, but now accepts this line-oriented contract.
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('Burger', 'Guarnicion', 'Extra')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents INTEGER GENERATED ALWAYS AS (quantity * unit_price_cents) VIRTUAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(sku)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_available_sort
ON menu_items(category_key, is_available, sort_order);

CREATE INDEX IF NOT EXISTS idx_menu_items_sku_available
ON menu_items(sku, is_available);

CREATE INDEX IF NOT EXISTS idx_order_items_order
ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_menu_item
ON order_items(menu_item_id);

-- The existing v2 orders model already supports multiple lines through order_items_v2.
