-- ── 015: premium servers — exempt from hibernation ─────────────────────────
ALTER TABLE mcloud.servers
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_servers_is_premium ON mcloud.servers (is_premium) WHERE is_premium = TRUE;
