-- 013: Fix node_stock view Cartesian product bug
--
-- The previous view joined both `servers` and `allocations` directly on the
-- node, which multiplied every server row by the number of allocations on that
-- node. For a node with 9 allocations and 1 server, SUM(s.ram_mb) was
-- computed 9× instead of 1×, making free_ram_mb and free_disk_mb always 0
-- regardless of overallocation_percent.
--
-- Fix: aggregate servers and allocations in separate subqueries, then join
-- the pre-aggregated results to the nodes table. The view now also exposes
-- total_allocations / used_allocations / free_allocations columns so the
-- pick_node_with_stock function can use free_allocations > 0 directly.

CREATE OR REPLACE VIEW mcloud.node_stock AS
SELECT
  n.id, n.name, n.region_id,
  n.total_ram_mb, n.total_cpu, n.total_disk_mb, n.overallocation_percent,
  n.total_ram_mb  * n.overallocation_percent / 100 AS allowed_ram_mb,
  n.total_cpu     * n.overallocation_percent / 100 AS allowed_cpu,
  n.total_disk_mb * n.overallocation_percent / 100 AS allowed_disk_mb,
  COALESCE(srv.used_ram_mb,  0)::int AS used_ram_mb,
  COALESCE(srv.used_cpu,     0)::int AS used_cpu,
  COALESCE(srv.used_disk_mb, 0)::int AS used_disk_mb,
  GREATEST(0, n.total_ram_mb  * n.overallocation_percent / 100 - COALESCE(srv.used_ram_mb,  0))::int AS free_ram_mb,
  GREATEST(0, n.total_cpu     * n.overallocation_percent / 100 - COALESCE(srv.used_cpu,     0))::int AS free_cpu,
  GREATEST(0, n.total_disk_mb * n.overallocation_percent / 100 - COALESCE(srv.used_disk_mb, 0))::int AS free_disk_mb,
  COALESCE(alloc.total_allocations, 0)::int AS total_allocations,
  COALESCE(alloc.used_allocations,  0)::int AS used_allocations,
  COALESCE(alloc.free_allocations,  0)::int AS free_allocations,
  n.status, n.last_seen_at, n.running_count
FROM mcloud.nodes n
LEFT JOIN (
  SELECT
    node_id,
    COALESCE(SUM(ram_mb)      FILTER (WHERE status <> 'hibernated'), 0) AS used_ram_mb,
    COALESCE(SUM(cpu_percent) FILTER (WHERE status <> 'hibernated'), 0) AS used_cpu,
    COALESCE(SUM(disk_mb)     FILTER (WHERE status <> 'hibernated'), 0) AS used_disk_mb
  FROM mcloud.servers
  GROUP BY node_id
) srv ON srv.node_id = n.id
LEFT JOIN (
  SELECT
    node_id,
    COUNT(*)                                      AS total_allocations,
    COUNT(*) FILTER (WHERE server_id IS NOT NULL) AS used_allocations,
    COUNT(*) FILTER (WHERE server_id IS NULL)     AS free_allocations
  FROM mcloud.allocations
  GROUP BY node_id
) alloc ON alloc.node_id = n.id;

-- Also update pick_node_with_stock to use the view's free_allocations column
-- directly (simpler than an EXISTS subquery, and the view is already computing it).
-- CPU remains ignored — Docker CFS shares it, it is not partitioned.
CREATE OR REPLACE FUNCTION mcloud.pick_node_with_stock(
  want_region UUID, want_ram_mb INT, want_cpu INT, want_disk_mb INT
) RETURNS UUID AS $$
DECLARE picked UUID;
BEGIN
  SELECT id INTO picked
  FROM mcloud.node_stock
  WHERE (want_region IS NULL OR region_id = want_region)
    AND status        = 'online'
    AND free_ram_mb  >= want_ram_mb
    AND free_disk_mb >= want_disk_mb
    AND free_allocations > 0
  ORDER BY free_ram_mb DESC
  LIMIT 1;
  RETURN picked;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mcloud.pick_node_with_stock(UUID, INT, INT, INT)
  TO anon, authenticated, service_role;
