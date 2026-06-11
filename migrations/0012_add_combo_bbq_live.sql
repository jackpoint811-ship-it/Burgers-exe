PRAGMA foreign_keys = ON;

INSERT INTO menu_categories (id, key, name, sort_order, updated_at)
VALUES ('cat-combos', 'combos', 'Combos', 2, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = CURRENT_TIMESTAMP;

INSERT OR REPLACE INTO menu_items (
  id,
  sku,
  category_key,
  name,
  description,
  price_cents,
  tags_json,
  badge,
  promo_label,
  is_available,
  is_featured,
  sort_order,
  image_url,
  image_key,
  combo_links_json,
  upsell_items_json,
  updated_at
)
SELECT
  'menu-combo-bbq',
  'COMBO-BBQ',
  'combos',
  'Combo BBQ',
  REPLACE(REPLACE(description, 'OG', 'BBQ'), 'og', 'BBQ'),
  price_cents,
  '["combo"]',
  badge,
  promo_label,
  1,
  is_featured,
  sort_order + 1,
  NULL,
  NULL,
  REPLACE(REPLACE(combo_links_json, '"OG"', '"BBQ"'), '"BRG-OG"', '"BBQ"'),
  upsell_items_json,
  CURRENT_TIMESTAMP
FROM menu_items
WHERE sku <> 'COMBO-BBQ'
  AND (category_key = 'combos' OR LOWER(name) LIKE '%combo%')
ORDER BY sort_order
LIMIT 1;

-- Fallback for fresh/local D1 copies that do not yet contain the live OG combo.
-- Price and included garnish match the production combo observed before this migration.
INSERT OR IGNORE INTO menu_items (
  id,
  sku,
  category_key,
  name,
  description,
  price_cents,
  tags_json,
  badge,
  promo_label,
  is_available,
  is_featured,
  sort_order,
  image_url,
  image_key,
  combo_links_json,
  upsell_items_json,
  updated_at
)
VALUES (
  'menu-combo-bbq',
  'COMBO-BBQ',
  'combos',
  'Combo BBQ',
  'Burger BBQ + guarnicion incluida.',
  9900,
  '["combo"]',
  'Hack',
  'Hack Price',
  1,
  1,
  2,
  NULL,
  NULL,
  '["PAPAS_OG","BBQ"]',
  '[]',
  CURRENT_TIMESTAMP
);
