-- 012: Treat CPU as unlimited stock + require free allocation on picked node
--
-- Change 1: CPU stock
--   With per-server Docker containers each running with `--cpus N`, the host
--   scheduler shares CPU time across containers via CFS. There is no hard
--   partitioning of cores between servers — overcommit on CPU has minimal
--   impact unless the host is genuinely saturated, in which case all servers
--   slow down proportionally rather than failing to start.
--   So we stop blocking server creation on CPU stock. RAM (hard limit, OOM
--   enforced by docker --memory) and disk (physical) remain hard caps.
--
-- Change 2: Require free allocation on picked node
--   The old function selected the node with the most free RAM regardless of
--   whether that node had any unassigned IP:port allocations. The API then did
--   a second query for a free allocation and could get `noAllocations` even
--   when another node had plenty of allocations. Now the function only picks
--   nodes that have at least one free allocation, so the two conditions are
--   checked atomically and `noAllocations` after a successful pick is
--   impossible (barring a concurrent race, which is acceptable).

CREATE OR REPLACE FUNCTION mcloud.pick_node_with_stock(
  want_region UUID, want_ram_mb INT, want_cpu INT, want_disk_mb INT
) RETURNS UUID AS $$
DECLARE picked UUID;
BEGIN
  -- want_cpu intentionally ignored — CPU is shared, not partitioned
  SELECT ns.id INTO picked
  FROM mcloud.node_stock ns
  WHERE (want_region IS NULL OR ns.region_id = want_region)
    AND ns.status = 'online'
    AND ns.free_ram_mb  >= want_ram_mb
    AND ns.free_disk_mb >= want_disk_mb
    -- Only consider nodes that have at least one free allocation
    AND EXISTS (
      SELECT 1 FROM mcloud.allocations a
      WHERE a.node_id = ns.id AND a.server_id IS NULL
    )
  ORDER BY ns.free_ram_mb DESC
  LIMIT 1;
  RETURN picked;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mcloud.pick_node_with_stock(UUID, INT, INT, INT)
  TO anon, authenticated, service_role;
