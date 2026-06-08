-- PR 5 — Catalog creation, stock and category banners
-- Non-destructive catalog extension. Existing products remain stock-unmanaged by default.

ALTER TABLE menu_items ADD COLUMN stock_managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN stock_limit INTEGER NULL;
ALTER TABLE menu_items ADD COLUMN stock_remaining INTEGER NULL;
ALTER TABLE menu_items ADD COLUMN sold_out_at TEXT NULL;

INSERT OR IGNORE INTO menu_categories (id, key, name, sort_order)
VALUES ('cat-combos', 'combos', 'Combos', 2);

CREATE TABLE IF NOT EXISTS menu_category_banners (
  category_key TEXT PRIMARY KEY,
  title TEXT NULL,
  subtitle TEXT NULL,
  image_key TEXT NULL,
  image_url TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_key) REFERENCES menu_categories(key)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_stock_managed ON menu_items(stock_managed, stock_remaining);
