PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS raffle_ticket_adjustments_v2 (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  participant_key TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  participant_phone_masked TEXT NOT NULL,
  tickets_delta INTEGER NOT NULL CHECK (tickets_delta > 0),
  reason TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'internal-v2',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reverted')),
  reverted_at TEXT,
  reverted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES raffle_campaigns_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_raffle_ticket_adjustments_campaign
ON raffle_ticket_adjustments_v2(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raffle_ticket_adjustments_participant
ON raffle_ticket_adjustments_v2(campaign_id, participant_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raffle_ticket_adjustments_status
ON raffle_ticket_adjustments_v2(campaign_id, status, created_at DESC);
