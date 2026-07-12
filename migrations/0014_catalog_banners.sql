-- PR 9-A: Catalog banners — tabla independiente de banners para Modo Catálogo
-- Non-destructive. No altera tablas existentes.

CREATE TABLE IF NOT EXISTS catalog_banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  cta_label TEXT NULL,
  image_key TEXT NULL,
  image_url TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_banners_active ON catalog_banners(is_active, sort_order);
