-- =====================================================================
-- 003_stock_and_hibernation.sql
--
-- Adds:
--   1. Node stock / overallocation system
--   2. Server hibernation lifecycle (last_active_at, hibernated_at)
--   3. plan_tier on profiles so the daemon knows free vs paid
--   4. last_seen_at + running_count on nodes (daemon heartbeat)
--   5. A view `node_stock` exposing remaining stock per node
-- =====================================================================

-- ---- 1. Nodes: overallocation + heartbeat ----
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS overallocation_percent integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS running_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN nodes.overallocation_percent IS
  'Allow allocating up to this %% of physical RAM. 100 = no overallocation, 150 = 1.5x.';

-- ---- 2. Servers: hibernation columns + 'hibernated' status ----

-- Add the enum value if missing. (Postgres won''t error if it already exists
-- thanks to the DO block.)
DO $$ BEGIN
  ALTER TYPE server_status ADD VALUE IF NOT EXISTS 'hibernated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS hibernated_at timestamptz;

-- Backfill so existing rows aren''t immediately considered idle
UPDATE servers SET last_active_at = COALESCE(last_active_at, now());

-- ---- 3. Profiles: plan_tier so daemon can identify free users ----
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

COMMENT ON COLUMN profiles.plan_tier IS
  'free | starter | pro | etc. — synced from Clerk billing plan slug.';

-- ---- 4. Node-stock view ----
CREATE OR REPLACE VIEW node_stock AS
SELECT
  n.id,
  n.name,
  n.region_id,
  n.total_ram_mb,
  n.total_cpu,
  n.total_disk_mb,
  n.overallocation_percent,
  -- physical capacity × overallocation factor
  (n.total_ram_mb  * n.overallocation_percent) / 100 AS allowed_ram_mb,
  (n.total_cpu     * n.overallocation_percent) / 100 AS allowed_cpu,
  (n.total_disk_mb * n.overallocation_percent) / 100 AS allowed_disk_mb,
  -- currently allocated to non-hibernated servers
  COALESCE(SUM(s.ram_mb)      FILTER (WHERE s.status <> 'hibernated'), 0)::int AS used_ram_mb,
  COALESCE(SUM(s.cpu_percent) FILTER (WHERE s.status <> 'hibernated'), 0)::int AS used_cpu,
  COALESCE(SUM(s.disk_mb)     FILTER (WHERE s.status <> 'hibernated'), 0)::int AS used_disk_mb,
  -- remaining stock
  GREATEST(0, ((n.total_ram_mb  * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.ram_mb)      FILTER (WHERE s.status <> 'hibernated'), 0))::int AS free_ram_mb,
  GREATEST(0, ((n.total_cpu     * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.cpu_percent) FILTER (WHERE s.status <> 'hibernated'), 0))::int AS free_cpu,
  GREATEST(0, ((n.total_disk_mb * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.disk_mb)     FILTER (WHERE s.status <> 'hibernated'), 0))::int AS free_disk_mb,
  n.status,
  n.last_seen_at,
  n.running_count
FROM nodes n
LEFT JOIN servers s ON s.node_id = n.id
GROUP BY n.id;

-- ---- 5. Stock-check RPC the API can call ----
CREATE OR REPLACE FUNCTION pick_node_with_stock(
  want_region uuid,
  want_ram_mb int,
  want_cpu int,
  want_disk_mb int
) RETURNS uuid AS $$
DECLARE
  picked uuid;
BEGIN
  SELECT id INTO picked
  FROM node_stock
  WHERE (want_region IS NULL OR region_id = want_region)
    AND status = 'online'
    AND free_ram_mb  >= want_ram_mb
    AND free_cpu     >= want_cpu
    AND free_disk_mb >= want_disk_mb
  ORDER BY free_ram_mb DESC
  LIMIT 1;
  RETURN picked;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION pick_node_with_stock IS
  'Return the best node that satisfies the resource request, or NULL if out of stock.';

-- ---- 6. Trigger to bump last_active_at when status changes to running ----
CREATE OR REPLACE FUNCTION servers_touch_active() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('running','starting','restarting') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_active_at := now();
    -- Coming out of hibernation: clear hibernated_at
    IF OLD.status = 'hibernated' THEN
      NEW.hibernated_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS servers_touch_active_trg ON servers;
CREATE TRIGGER servers_touch_active_trg
  BEFORE UPDATE ON servers
  FOR EACH ROW
  EXECUTE FUNCTION servers_touch_active();

-- node_stock view should also be visible for admin stock page
-- (no Realtime changes needed here; server_backups is already added in 001)
