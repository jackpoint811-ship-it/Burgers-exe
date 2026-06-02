PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS raffle_campaigns_v2 (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  rules_text TEXT,
  banner_image_key TEXT,
  banner_image_url TEXT,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  ticket_per_burger INTEGER NOT NULL DEFAULT 1,
  ticket_per_referral INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raffle_campaigns_active
ON raffle_campaigns_v2(is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_raffle_campaigns_dates
ON raffle_campaigns_v2(starts_at, ends_at);
