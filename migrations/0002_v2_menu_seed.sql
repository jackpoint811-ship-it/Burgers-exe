PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO menu_categories (id, key, name, sort_order, updated_at) VALUES
  ('c1', 'burgers', 'Burgers', 1, CURRENT_TIMESTAMP),
  ('c2', 'extras', 'Extras', 2, CURRENT_TIMESTAMP),
  ('c3', 'guarniciones', 'Guarniciones', 3, CURRENT_TIMESTAMP),
  ('c4', 'drinks', 'Bebidas', 4, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO menu_items (id, sku, category_key, name, description, price_cents, tags_json, badge, promo_label, is_available, is_featured, sort_order, image_url, image_key, combo_links_json, upsell_items_json, updated_at) VALUES
  ('i1', 'BRG-OG', 'burgers', 'Burger OG', 'Doble carne, queso y salsa de la casa.', 149, '["signature"]', 'Best Seller', 'Hot', 1, 1, 1, '/placeholders/burger-og.jpg', 'menu/burger-og.jpg', '["PROMO-COMBO-OG"]', '["EXT-BACON"]', CURRENT_TIMESTAMP),
  ('i2', 'BRG-SPICY', 'burgers', 'Burger Spicy', 'Chile crunch y mayo picante.', 159, '["spicy"]', NULL, NULL, 1, 1, 2, '/placeholders/burger-spicy.jpg', 'menu/burger-spicy.jpg', '["PROMO-SPICY-NIGHT"]', '["EXT-DIP"]', CURRENT_TIMESTAMP),
  ('i3', 'EXT-BACON', 'extras', 'Extra Bacon', 'Tiras crocantes.', 29, '["addon"]', NULL, NULL, 1, 0, 10, '/placeholders/extra-bacon.jpg', 'menu/extra-bacon.jpg', '[]', '[]', CURRENT_TIMESTAMP),
  ('i4', 'DRK-COLA', 'drinks', 'Cola Pixel', 'Refresco helado 355ml.', 39, '["drink"]', NULL, NULL, 0, 0, 15, '/placeholders/cola.jpg', 'menu/cola.jpg', '[]', '[]', CURRENT_TIMESTAMP),
  ('i5', 'GUA-FRIES', 'guarniciones', 'Fries OG', 'Papas doradas con sal especial.', 59, '["side"]', NULL, NULL, 1, 1, 20, '/placeholders/fries.jpg', 'menu/fries.jpg', '["PROMO-COMBO-OG"]', '["EXT-DIP"]', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO promo_cards (id, title, description, badge, promo_label, is_featured, is_available, sort_order, tags_json, combo_links_json, asset_alt, asset_placeholder, asset_image_url, asset_image_key, updated_at) VALUES
  ('PROMO-COMBO-OG', 'Combo OG', 'Burger OG + Fries + Drink.', 'Ahorra 20%', 'Limited', 1, 1, 1, '["combo"]', '["BRG-OG","GUA-FRIES"]', 'Promo combo OG', 'combo-placeholder', '/placeholders/promo-combo.jpg', 'promos/promo-combo.jpg', CURRENT_TIMESTAMP),
  ('PROMO-SPICY-NIGHT', 'Spicy Night', 'Burger Spicy con dip especial.', NULL, NULL, 1, 1, 2, '["night"]', '["BRG-SPICY"]', 'Promo spicy', 'spicy-placeholder', '/placeholders/promo-spicy.jpg', 'promos/promo-spicy.jpg', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO site_config (id, brand_name, currency, order_modes_json, support_phone, hero_cta, notice, updated_at) VALUES
  ('default', 'Burgers.exe', 'MXN', '["pickup","delivery"]', '+52 55 0000 0000', 'Pedir ahora', 'V2 mock mode: catálogo local sin conexión a backend.', CURRENT_TIMESTAMP);
