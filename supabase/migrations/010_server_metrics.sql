CREATE TABLE IF NOT EXISTS mcloud.server_metrics (
  id          BIGSERIAL PRIMARY KEY,
  server_id   UUID NOT NULL REFERENCES mcloud.servers(id) ON DELETE CASCADE,
  sampled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ram_used_mb INT NOT NULL DEFAULT 0,
  cpu_percent INT NOT NULL DEFAULT 0,
  player_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS server_metrics_server_sampled
  ON mcloud.server_metrics (server_id, sampled_at DESC);
-- Auto-purge rows older than 7 days
CREATE OR REPLACE FUNCTION mcloud.purge_old_metrics() RETURNS void
  LANGUAGE sql AS $$
    DELETE FROM mcloud.server_metrics WHERE sampled_at < now() - INTERVAL '7 days';
  $$;
