-- ─────────────────────────────────────────────────────────────────────
-- 003: Fix node_id column types + create public schema functions
-- ─────────────────────────────────────────────────────────────────────

-- 1. Fix servers.node_id: drop NOT NULL + FK, change to UUID, re-add FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'servers'
      AND column_name  = 'node_id'
      AND data_type   <> 'uuid'
  ) THEN
    -- Drop FK and NOT NULL, then retype
    ALTER TABLE public.servers DROP CONSTRAINT IF EXISTS servers_node_id_fkey;
    ALTER TABLE public.servers ALTER COLUMN node_id DROP NOT NULL;
    ALTER TABLE public.servers ALTER COLUMN node_id TYPE uuid USING NULL;
    ALTER TABLE public.servers
      ADD CONSTRAINT servers_node_id_fkey
      FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Fix allocations.server_id: same treatment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'allocations'
      AND column_name  = 'server_id'
      AND data_type   <> 'uuid'
  ) THEN
    ALTER TABLE public.allocations DROP CONSTRAINT IF EXISTS allocations_server_id_fkey;
    ALTER TABLE public.allocations ALTER COLUMN server_id DROP NOT NULL;
    ALTER TABLE public.allocations ALTER COLUMN server_id TYPE uuid USING NULL;
    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_server_id_fkey
      FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. node_stock view (public schema version of mcloud.node_stock)
CREATE OR REPLACE VIEW public.node_stock AS
SELECT
  n.id, n.name, n.region_id,
  n.total_ram_mb, n.total_cpu, n.total_disk_mb, n.overallocation_percent,
  (n.total_ram_mb  * n.overallocation_percent) / 100 AS allowed_ram_mb,
  (n.total_cpu     * n.overallocation_percent) / 100 AS allowed_cpu,
  (n.total_disk_mb * n.overallocation_percent) / 100 AS allowed_disk_mb,
  COALESCE(SUM(s.ram_mb)      FILTER (WHERE s.status::text <> 'hibernated'), 0)::int AS used_ram_mb,
  COALESCE(SUM(s.cpu_percent) FILTER (WHERE s.status::text <> 'hibernated'), 0)::int AS used_cpu,
  COALESCE(SUM(s.disk_mb)     FILTER (WHERE s.status::text <> 'hibernated'), 0)::int AS used_disk_mb,
  GREATEST(0, ((n.total_ram_mb  * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.ram_mb)      FILTER (WHERE s.status::text <> 'hibernated'), 0))::int AS free_ram_mb,
  GREATEST(0, ((n.total_cpu     * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.cpu_percent) FILTER (WHERE s.status::text <> 'hibernated'), 0))::int AS free_cpu,
  GREATEST(0, ((n.total_disk_mb * n.overallocation_percent) / 100)
              - COALESCE(SUM(s.disk_mb)     FILTER (WHERE s.status::text <> 'hibernated'), 0))::int AS free_disk_mb,
  n.status, n.last_seen_at, n.running_count
FROM public.nodes n
LEFT JOIN public.servers s ON s.node_id = n.id
GROUP BY n.id;

-- 4. pick_node_with_stock RPC (public schema)
CREATE OR REPLACE FUNCTION public.pick_node_with_stock(
  want_region UUID, want_ram_mb INT, want_cpu INT, want_disk_mb INT
) RETURNS UUID AS $$
DECLARE picked UUID;
BEGIN
  SELECT id INTO picked
  FROM public.node_stock
  WHERE (want_region IS NULL OR region_id = want_region)
    AND status::text = 'online'
    AND free_ram_mb  >= want_ram_mb
    AND free_cpu     >= want_cpu
    AND free_disk_mb >= want_disk_mb
  ORDER BY free_ram_mb DESC
  LIMIT 1;
  RETURN picked;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.pick_node_with_stock(UUID, INT, INT, INT)
  TO anon, authenticated, service_role;

-- 5. Realtime for public schema tables (idempotent)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.console_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.server_backups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
