PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredients_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price_cents INTEGER NULL,
  is_quantifiable INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_ingredient_recipes_v2 (
  id TEXT PRIMARY KEY,
  product_sku TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity_per_unit REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_sku, ingredient_id),
  FOREIGN KEY (product_sku) REFERENCES menu_items(sku) ON DELETE RESTRICT,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients_v2(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ingredients_v2_active_sort
ON ingredients_v2(is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_product_ingredient_recipes_v2_product
ON product_ingredient_recipes_v2(product_sku);

CREATE INDEX IF NOT EXISTS idx_product_ingredient_recipes_v2_ingredient
ON product_ingredient_recipes_v2(ingredient_id);
