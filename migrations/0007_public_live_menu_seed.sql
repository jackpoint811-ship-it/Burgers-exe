PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO menu_categories (id, key, name, sort_order, updated_at) VALUES
  ('cat-burgers', 'burgers', 'Burgers', 1, CURRENT_TIMESTAMP),
  ('cat-guarniciones', 'guarniciones', 'Guarniciones', 2, CURRENT_TIMESTAMP),
  ('cat-extras', 'extras', 'Extras', 3, CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO menu_items (
  id, sku, category_key, name, description, price_cents, tags_json, badge, promo_label,
  is_available, is_featured, sort_order, image_url, image_key, combo_links_json,
  upsell_items_json, updated_at
) VALUES
  ('menu-og', 'OG', 'burgers', 'OG', 'Carne "Especial" 250g aprox, tocino, queso americano, queso manchego, jitomate, lechuga, pepinillos, catsup, mostaza y mayonesa.', 8500, '["burger"]', NULL, NULL, 1, 1, 1, NULL, 'menu/OG.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-bbq', 'BBQ', 'burgers', 'BBQ', 'Carne "Especial" 250g aprox, tocino, queso americano, queso manchego, aros de cebolla, pepinillos y salsa BBQ.', 8500, '["burger"]', NULL, NULL, 1, 1, 2, NULL, 'menu/BBQ.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-papas-og', 'PAPAS_OG', 'guarniciones', 'Papas a la francesa OG', 'Papas clásicas, sal y crunch.', 2000, '["side"]', NULL, NULL, 1, 0, 10, NULL, 'menu/PAPAS_OG.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-papas-especiales', 'PAPAS_ESPECIALES', 'guarniciones', 'Papas a la francesa Especiales', 'Papas con sazón especial de la casa.', 2500, '["side"]', NULL, NULL, 1, 0, 11, NULL, 'menu/PAPAS_ESPECIALES.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-papas-lemon-pepper', 'PAPAS_LEMON_PEPPER', 'guarniciones', 'Papas a la francesa Lemon&Pepper', 'Papas con toque cítrico y pimienta.', 2500, '["side"]', NULL, NULL, 1, 0, 12, NULL, 'menu/PAPAS_LEMON_PEPPER.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-aros-cebolla', 'AROS_CEBOLLA', 'guarniciones', 'Aros de Cebolla', 'Aros crujientes estilo burger joint.', 3000, '["side"]', NULL, NULL, 1, 0, 13, NULL, 'menu/AROS_CEBOLLA.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-pepinillos', 'EXTRA_PEPINILLOS', 'extras', 'Pepinillos', 'Toque ácido/crunch.', 500, '["extra"]', NULL, NULL, 1, 0, 20, NULL, 'menu/EXTRA_PEPINILLOS.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-queso-americano', 'EXTRA_QUESO_AMERICANO', 'extras', 'Queso americano', 'Extra cremoso clásico.', 500, '["extra"]', NULL, NULL, 1, 0, 21, NULL, 'menu/EXTRA_QUESO_AMERICANO.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-queso-manchego', 'EXTRA_QUESO_MANCHEGO', 'extras', 'Queso manchego', 'Extra fundido intenso.', 500, '["extra"]', NULL, NULL, 1, 0, 22, NULL, 'menu/EXTRA_QUESO_MANCHEGO.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-tocino', 'EXTRA_TOCINO', 'extras', 'Tocino', 'Crunch ahumado.', 500, '["extra"]', NULL, NULL, 1, 0, 23, NULL, 'menu/EXTRA_TOCINO.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-catsup', 'EXTRA_CATSUP', 'extras', 'Catsup', 'Dulce clásica.', 500, '["extra"]', NULL, NULL, 1, 0, 24, NULL, 'menu/EXTRA_CATSUP.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-mostaza', 'EXTRA_MOSTAZA', 'extras', 'Mostaza', 'Punch ácido.', 500, '["extra"]', NULL, NULL, 1, 0, 25, NULL, 'menu/EXTRA_MOSTAZA.png', '[]', '[]', CURRENT_TIMESTAMP),
  ('menu-extra-tomate', 'EXTRA_TOMATE', 'extras', 'Tomate', 'Frescura extra.', 500, '["extra"]', NULL, NULL, 1, 0, 26, NULL, 'menu/EXTRA_TOMATE.png', '[]', '[]', CURRENT_TIMESTAMP);
