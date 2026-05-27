PRAGMA foreign_keys = ON;

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
  price_cents INTEGER NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  badge TEXT,
  promo_label TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  image_key TEXT,
  combo_links_json TEXT NOT NULL DEFAULT '[]',
  upsell_items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_key) REFERENCES menu_categories(key)
);

CREATE TABLE IF NOT EXISTS promo_cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  badge TEXT,
  promo_label TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  combo_links_json TEXT NOT NULL DEFAULT '[]',
  asset_alt TEXT NOT NULL,
  asset_placeholder TEXT NOT NULL,
  asset_image_url TEXT,
  asset_image_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  order_modes_json TEXT NOT NULL,
  support_phone TEXT NOT NULL,
  hero_cta TEXT NOT NULL,
  notice TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_sort ON menu_items(category_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_available_sort ON menu_items(is_available, sort_order);
CREATE INDEX IF NOT EXISTS idx_promo_cards_available_sort ON promo_cards(is_available, sort_order);
