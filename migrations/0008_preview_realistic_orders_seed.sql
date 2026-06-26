-- 0008_preview_realistic_orders_seed.sql
-- Seed realista de 16 órdenes para Burgers.exe preview.
-- Todas con source = public-v2-preview y folio PVW-*

-- 1. Limpieza idempotente
DELETE FROM order_events_v2
WHERE order_id IN (
  SELECT id FROM orders_v2
  WHERE id LIKE 'ord_preview_fixture_%'
     OR notes LIKE '%[FIXTURE:PREVIEW_REALISTIC_ORDERS]%'
);

DELETE FROM order_items_v2
WHERE order_id IN (
  SELECT id FROM orders_v2
  WHERE id LIKE 'ord_preview_fixture_%'
     OR notes LIKE '%[FIXTURE:PREVIEW_REALISTIC_ORDERS]%'
);

DELETE FROM orders_v2
WHERE id LIKE 'ord_preview_fixture_%'
   OR notes LIKE '%[FIXTURE:PREVIEW_REALISTIC_ORDERS]%';

-- 2. Insert Orders
INSERT INTO orders_v2 (
  id, folio, idempotency_key, customer_name, customer_phone, order_mode, payment_method, payment_status, notes, subtotal_cents, total_cents, status, source, created_at, updated_at
) VALUES
-- Orden 1
('ord_preview_fixture_01', 'PVW-0H40AB7K9X', 'idem_pvw_01', 'Andrea López', '2221234567', 'pickup', 'cash', 'pending', 'Ubicación: Torre Valcob | Cliente recoge en lobby. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 12000, 12000, 'new', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 2
('ord_preview_fixture_02', 'PVW-0H40AC3M2Q', 'idem_pvw_02', 'Carlos Ramírez', '2214567890', 'delivery', 'transfer', 'paid', 'Ubicación: Torre GGA | Piso 5, entregar en recepción. Transferencia confirmada. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 28000, 28000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 3
('ord_preview_fixture_03', 'PVW-0H40AD8P1R', 'idem_pvw_03', 'Mariana Torres', '2229876543', 'pickup', 'transfer', 'paid', 'Ubicación: Torre Valcob | Pedido listo para entrega. Cliente baja al lobby. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 38000, 38000, 'ready', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 4
('ord_preview_fixture_04', 'PVW-0H40AE4L6T', 'idem_pvw_04', 'Diego Hernández', '2225551100', 'delivery', 'cash', 'pending', 'Ubicación: Torre GGA | Piso 5. Cliente paga en efectivo al recibir. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 22000, 22000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 5
('ord_preview_fixture_05', 'PVW-0H40AF9N3V', 'idem_pvw_05', 'Sofía Martínez', '2223334455', 'delivery', 'transfer', 'paid', 'Ubicación: Torre Valcob | Pedido para dos personas. Transferencia pagada. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 34000, 34000, 'new', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 6
('ord_preview_fixture_06', 'PVW-0H40AG2Q8W', 'idem_pvw_06', 'Luis Fernández', '2224446677', 'delivery', 'transfer', 'paid', 'Ubicación: Torre GGA | Pedido de grupo. Separar si es posible. Entregar en recepción. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 86000, 86000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 7
('ord_preview_fixture_07', 'PVW-0H40AH5R7X', 'idem_pvw_07', 'Valeria Cruz', '2212223344', 'delivery', 'cash', 'pending', 'Ubicación: Torre GGA | Piso 5. Nota larga del cliente. Llamar al llegar y esperar confirmación antes de subir. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 12000, 12000, 'new', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 8
('ord_preview_fixture_08', 'PVW-0H40AJ1S4Y', 'idem_pvw_08', 'Rodrigo Sánchez', '2227778899', 'pickup', 'cash', 'pending', 'Ubicación: Torre Valcob | Solo guarniciones. Cliente recoge en lobby. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 9000, 9000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 9
('ord_preview_fixture_09', 'PVW-0H40AK6T2Z', 'idem_pvw_09', 'Fernanda Ruiz', '2228889900', 'delivery', 'transfer', 'paid', 'Ubicación: Torre GGA | Pedido pagado. Entregar junto, no separar. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 52000, 52000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 10
('ord_preview_fixture_10', 'PVW-0H40AL9V5M', 'idem_pvw_10', 'Jorge Castillo', '2219091122', 'pickup', 'cash', 'paid', 'Ubicación: Torre Valcob | Pedido listo. Pago marcado como pagado en caja. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 46000, 46000, 'ready', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 11
('ord_preview_fixture_11', 'PVW-0H40AM3W8N', 'idem_pvw_11', 'Paola Mendoza', '2221012020', 'delivery', 'transfer', 'pending', 'Ubicación: Torre GGA | Falta confirmar transferencia. No entregar hasta validar pago. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 18000, 18000, 'new', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 12
('ord_preview_fixture_12', 'PVW-0H40AN7X1P', 'idem_pvw_12', 'Miguel Ortega', '2223034040', 'pickup', 'cash', 'paid', 'Ubicación: Torre Valcob | Pedido entregado. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 17000, 17000, 'delivered', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 13
('ord_preview_fixture_13', 'PVW-0H40AP8Y4Q', 'idem_pvw_13', 'Natalia Herrera', '2225056060', 'delivery', 'transfer', 'cancelled', 'Ubicación: Torre GGA | Cliente canceló antes de preparar. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 12000, 12000, 'cancelled', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 14
('ord_preview_fixture_14', 'PVW-0H40AQ2Z6R', 'idem_pvw_14', 'Héctor Salinas', '2227078080', 'delivery', 'transfer', 'paid', 'Ubicación: Torre Valcob | Pedido con varios cambios. Revisar bien MOD y UPGRADE antes de marcar hecha. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 35000, 35000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 15
('ord_preview_fixture_15', 'PVW-0H40AR5B9S', 'idem_pvw_15', 'Daniela Morales', '2213131414', 'delivery', 'transfer', 'paid', 'Ubicación: Torre GGA | Pedido familiar. Entregar todo junto en recepción. Transferencia confirmada. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 56000, 56000, 'new', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Orden 16
('ord_preview_fixture_16', 'PVW-0H40AS1C3T', 'idem_pvw_16', 'Roberto Aguilar', '2229192939', 'pickup', 'card', 'paid', 'Ubicación: Torre Valcob | Cliente espera en lobby. Pago con tarjeta registrado. [FIXTURE:PREVIEW_REALISTIC_ORDERS]', 42000, 42000, 'preparing', 'public-v2-preview', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Insert Items
INSERT INTO order_items_v2 (
  id, order_id, sku, name, qty, unit_price_cents, line_total_cents, snapshot_json, created_at
) VALUES
-- Orden 1
('oi_preview_01_01', 'ord_preview_fixture_01', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_01_01",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 2
('oi_preview_02_01', 'ord_preview_fixture_02', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_02_01",
  "itemKind": "burger",
  "removedIngredients": ["Cebolla morada"],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),
('oi_preview_02_02', 'ord_preview_fixture_02', 'BBQ', 'Burger BBQ', 1, 14000, 16000, '{
  "lineKey": "line_02_02",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [{"sku": "EXT-TOCINO", "name": "Tocino", "price": 2000}],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 3
('oi_preview_03_01', 'ord_preview_fixture_03', 'OG', 'Burger OG', 2, 12000, 24000, '{
  "lineKey": "line_03_01",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),
('oi_preview_03_02', 'ord_preview_fixture_03', 'BBQ', 'Burger BBQ', 1, 14000, 14000, '{
  "lineKey": "line_03_02",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),

-- Orden 4
('oi_preview_04_01', 'ord_preview_fixture_04', 'COMBO-BBQ', 'Combo BBQ', 1, 20000, 22000, '{
  "lineKey": "line_04_01",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "AROS", "name": "Aros de cebolla", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "BBQ",
    "name": "Burger BBQ",
    "removedIngredients": ["Pepinillos"],
    "extras": [{"sku": "EXT-QUESO", "name": "Queso manchego", "price": 2000}],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 5
('oi_preview_05_01', 'ord_preview_fixture_05', 'COMBO-OG', 'Combo OG', 1, 18000, 18000, '{
  "lineKey": "line_05_01",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "PAPAS", "name": "Papas", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "OG",
    "name": "Burger OG",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_05_02', 'ord_preview_fixture_05', 'BBQ', 'Burger BBQ', 1, 14000, 16000, '{
  "lineKey": "line_05_02",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [{"sku": "EXT-TOCINO", "name": "Tocino", "price": 2000}],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 6
('oi_preview_06_01', 'ord_preview_fixture_06', 'OG', 'Burger OG', 2, 12000, 24000, '{
  "lineKey": "line_06_01",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),
('oi_preview_06_02', 'ord_preview_fixture_06', 'BBQ', 'Burger BBQ', 2, 14000, 28000, '{
  "lineKey": "line_06_02",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_06_03', 'ord_preview_fixture_06', 'COMBO-BBQ', 'Combo BBQ', 1, 20000, 20000, '{
  "lineKey": "line_06_03",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "AROS", "name": "Aros de cebolla", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "BBQ",
    "name": "Burger BBQ",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_06_04', 'ord_preview_fixture_06', 'PAPAS', 'Papas', 1, 5000, 5000, '{
  "lineKey": "line_06_04",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_06_05', 'ord_preview_fixture_06', 'AROS', 'Aros de cebolla', 1, 9000, 9000, '{
  "lineKey": "line_06_05",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 7
('oi_preview_07_01', 'ord_preview_fixture_07', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_07_01",
  "itemKind": "burger",
  "removedIngredients": ["Cebolla morada"],
  "extras": [],
  "burgerNote": "Por favor separar la salsa, sin mucha cebolla, entregar en recepción, llamar al llegar.",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 8
('oi_preview_08_01', 'ord_preview_fixture_08', 'PAPAS', 'Papas', 1, 5000, 5000, '{
  "lineKey": "line_08_01",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_08_02', 'ord_preview_fixture_08', 'AROS', 'Aros de cebolla', 1, 4000, 4000, '{
  "lineKey": "line_08_02",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 9
('oi_preview_09_01', 'ord_preview_fixture_09', 'COMBO-OG', 'Combo OG', 1, 18000, 18000, '{
  "lineKey": "line_09_01",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "PAPAS", "name": "Papas", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "OG",
    "name": "Burger OG",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_09_02', 'ord_preview_fixture_09', 'COMBO-BBQ', 'Combo BBQ', 1, 22000, 22000, '{
  "lineKey": "line_09_02",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "AROS", "name": "Aros de cebolla", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "BBQ",
    "name": "Burger BBQ",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_09_03', 'ord_preview_fixture_09', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_09_03",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 10
('oi_preview_10_01', 'ord_preview_fixture_10', 'COMBO-BBQ', 'Combo BBQ', 1, 20000, 20000, '{
  "lineKey": "line_10_01",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "PAPAS", "name": "Papas", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "BBQ",
    "name": "Burger BBQ",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),
('oi_preview_10_02', 'ord_preview_fixture_10', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_10_02",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),
('oi_preview_10_03', 'ord_preview_fixture_10', 'BBQ', 'Burger BBQ', 1, 14000, 14000, '{
  "lineKey": "line_10_03",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),

-- Orden 11
('oi_preview_11_01', 'ord_preview_fixture_11', 'BBQ', 'Burger BBQ', 1, 14000, 14000, '{
  "lineKey": "line_11_01",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_11_02', 'ord_preview_fixture_11', 'PAPAS', 'Papas', 1, 4000, 4000, '{
  "lineKey": "line_11_02",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 12
('oi_preview_12_01', 'ord_preview_fixture_12', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_12_01",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),
('oi_preview_12_02', 'ord_preview_fixture_12', 'PAPAS', 'Papas', 1, 5000, 5000, '{
  "lineKey": "line_12_02",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": true
}', CURRENT_TIMESTAMP),

-- Orden 13
('oi_preview_13_01', 'ord_preview_fixture_13', 'OG', 'Burger OG', 1, 12000, 12000, '{
  "lineKey": "line_13_01",
  "itemKind": "burger",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 14
('oi_preview_14_01', 'ord_preview_fixture_14', 'OG', 'Burger OG', 1, 12000, 16000, '{
  "lineKey": "line_14_01",
  "itemKind": "burger",
  "removedIngredients": ["Cebolla morada"],
  "extras": [{"sku": "EXT-TOCINO", "name": "Tocino", "price": 2000}, {"sku": "EXT-QUESO", "name": "Queso manchego", "price": 2000}],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_14_02', 'ord_preview_fixture_14', 'BBQ', 'Burger BBQ', 1, 14000, 16000, '{
  "lineKey": "line_14_02",
  "itemKind": "burger",
  "removedIngredients": ["Pepinillos"],
  "extras": [{"sku": "EXT-TOCINO", "name": "Tocino", "price": 2000}],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_14_03', 'ord_preview_fixture_14', 'AROS', 'Aros de cebolla', 1, 3000, 3000, '{
  "lineKey": "line_14_03",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 15
('oi_preview_15_01', 'ord_preview_fixture_15', 'COMBO-OG', 'Combo OG', 2, 18000, 36000, '{
  "lineKey": "line_15_01",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "PAPAS", "name": "Papas", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "OG",
    "name": "Burger OG",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_15_02', 'ord_preview_fixture_15', 'BBQ', 'Burger BBQ', 1, 14000, 20000, '{
  "lineKey": "line_15_02",
  "itemKind": "burger",
  "removedIngredients": ["Cebolla morada"],
  "extras": [{"sku": "EXT-QUESO", "name": "Queso manchego", "price": 2000}],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),

-- Orden 16
('oi_preview_16_01', 'ord_preview_fixture_16', 'BBQ', 'Burger BBQ', 1, 14000, 14000, '{
  "lineKey": "line_16_01",
  "itemKind": "burger",
  "removedIngredients": ["Pepinillos"],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_16_02', 'ord_preview_fixture_16', 'COMBO-OG', 'Combo OG', 1, 18000, 18000, '{
  "lineKey": "line_16_02",
  "itemKind": "combo",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": {"sku": "PAPAS", "name": "Papas", "upcharge": 0},
  "includedDrink": {"sku": "REFRESCO", "name": "Refresco"},
  "sideQuestExtras": [],
  "comboBurgers": [{
    "sku": "OG",
    "name": "Burger OG",
    "removedIngredients": [],
    "extras": [],
    "burgerNote": ""
  }],
  "kitchenDone": false
}', CURRENT_TIMESTAMP),
('oi_preview_16_03', 'ord_preview_fixture_16', 'PAPAS', 'Papas', 1, 10000, 10000, '{
  "lineKey": "line_16_03",
  "itemKind": "garnish",
  "removedIngredients": [],
  "extras": [],
  "burgerNote": "",
  "garnish": null,
  "includedDrink": null,
  "sideQuestExtras": [],
  "comboBurgers": [],
  "kitchenDone": false
}', CURRENT_TIMESTAMP);
