PRAGMA foreign_keys = ON;

ALTER TABLE orders_v2 ADD COLUMN archived_at TEXT NULL;
ALTER TABLE raffle_campaigns_v2 ADD COLUMN deleted_at TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_v2_archived_status_created
ON orders_v2(archived_at, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raffle_campaigns_deleted_active
ON raffle_campaigns_v2(deleted_at, is_active, updated_at DESC);
