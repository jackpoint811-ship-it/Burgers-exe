PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS raffle_referral_codes_v2 (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  code TEXT NOT NULL,
  label_text TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES raffle_campaigns_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_campaign
ON raffle_referral_codes_v2(campaign_id);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code
ON raffle_referral_codes_v2(code);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner
ON raffle_referral_codes_v2(owner_phone);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_codes_campaign_code
ON raffle_referral_codes_v2(campaign_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_codes_campaign_owner
ON raffle_referral_codes_v2(campaign_id, owner_phone);

CREATE TABLE IF NOT EXISTS raffle_referrals_v2 (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  referral_code_id TEXT NOT NULL,
  referrer_phone TEXT NOT NULL,
  referrer_name TEXT NOT NULL,
  referred_order_id TEXT NOT NULL,
  referred_customer_phone TEXT NOT NULL,
  referred_customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'invalid')),
  tickets_awarded INTEGER NOT NULL DEFAULT 2,
  invalid_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES raffle_campaigns_v2(id),
  FOREIGN KEY (referral_code_id) REFERENCES raffle_referral_codes_v2(id),
  FOREIGN KEY (referred_order_id) REFERENCES orders_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_campaign
ON raffle_referrals_v2(campaign_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
ON raffle_referrals_v2(referrer_phone);

CREATE INDEX IF NOT EXISTS idx_referrals_order
ON raffle_referrals_v2(referred_order_id);

CREATE INDEX IF NOT EXISTS idx_referrals_status
ON raffle_referrals_v2(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referrals_referred_order
ON raffle_referrals_v2(referred_order_id);
