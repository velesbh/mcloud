-- ─────────────────────────────────────────────────────────────────────
-- 003: Create node_stock view + pick_node_with_stock RPC in mcloud schema
--
-- public.servers belongs to another co-tenant app — our data is in mcloud.*
-- The pick_node_with_stock RPC needs to be in a schema accessible to the
-- service-role client (mcloud works fine with service-role; no need to expose).
-- ─────────────────────────────────────────────────────────────────────

-- Make region_id nullable so nodes can register before being assigned
ALTER TABLE mcloud.nodes ALTER COLUMN region_id DROP NOT NULL;

-- node_stock view
CREATE OR REPLACE VIEW mcloud.node_stock AS
SELECT
  n.id, n.name, n.region_id,
  n.total_ram_mb, n.total_cpu, n.total_disk_mb, n.overallocation_percent,
  (n.total_ram_mb  * n.overallocation_percent) / 100 AS allowed_ram_mb,
  (n.total_cpu     * n.overallocation_percent) / 100 AS allowed_cpu,
  (n.total_disk_mb * n.overallocation_percent) / 100 AS allowed_disk_mb,
  COALESCE(SUM(s.ram_mb)      FILTER (WHERE s.status <> 'hibernated'), 0)::int AS used_ram_mb,
  COALESCE(SUM(s.cpu_percent) FILTER (WHERE s.status <> 'hibernated'), 0)::int AS used_cpu,
  COALESCE(SUM(s.disk_mb)     FILTER (WHERE s.status <> 'hibernated'), 0)::int AS used_disk_mb,
  GREATEST(0, ((n.total_ram_mb  * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.ram_mb)      FILTER (WHERE s.status <> 'hibernated'), 0))::int AS free_ram_mb,
  GREATEST(0, ((n.total_cpu     * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.cpu_percent) FILTER (WHERE s.status <> 'hibernated'), 0))::int AS free_cpu,
  GREATEST(0, ((n.total_disk_mb * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.disk_mb)     FILTER (WHERE s.status <> 'hibernated'), 0))::int AS free_disk_mb,
  n.status, n.last_seen_at, n.running_count
FROM mcloud.nodes n
LEFT JOIN mcloud.servers s ON s.node_id = n.id
GROUP BY n.id;

-- pick_node_with_stock RPC
CREATE OR REPLACE FUNCTION mcloud.pick_node_with_stock(
  want_region UUID, want_ram_mb INT, want_cpu INT, want_disk_mb INT
) RETURNS UUID AS $$
DECLARE picked UUID;
BEGIN
  SELECT id INTO picked
  FROM mcloud.node_stock
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

GRANT EXECUTE ON FUNCTION mcloud.pick_node_with_stock(UUID, INT, INT, INT)
  TO anon, authenticated, service_role;

-- Realtime on mcloud tables
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.servers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.console_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.server_backups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
