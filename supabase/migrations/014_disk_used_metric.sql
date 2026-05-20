-- ── 014: add disk_used_mb to server_metrics ──────────────────────────────────
ALTER TABLE mcloud.server_metrics
  ADD COLUMN IF NOT EXISTS disk_used_mb INT NOT NULL DEFAULT 0;
