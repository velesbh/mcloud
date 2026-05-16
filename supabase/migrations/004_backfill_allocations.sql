-- 004: Backfill missing allocations for servers that have a node but no allocation.
--
-- For each server missing an allocation_id, we:
--   1. Find or create an allocation on the server's node using the node's IP
--      and the next free port (starting at 25565).
--   2. Set servers.allocation_id to point at it.
--   3. Set allocations.server_id to point back.

DO $$
DECLARE
  rec        RECORD;
  node_ip    INET;
  next_port  INTEGER;
  new_alloc  UUID;
BEGIN
  FOR rec IN
    SELECT s.id AS server_id, s.node_id
    FROM   mcloud.servers s
    WHERE  s.node_id IS NOT NULL
      AND  s.allocation_id IS NULL
  LOOP
    -- Get node IP
    SELECT ip INTO node_ip
    FROM   mcloud.nodes
    WHERE  id = rec.node_id;

    IF node_ip IS NULL THEN
      CONTINUE;
    END IF;

    -- Try to grab an existing free allocation on this node
    SELECT id INTO new_alloc
    FROM   mcloud.allocations
    WHERE  node_id  = rec.node_id
      AND  server_id IS NULL
    ORDER  BY port
    LIMIT  1;

    -- No free allocation — create one with the next available port
    IF new_alloc IS NULL THEN
      SELECT COALESCE(MAX(port), 25564) + 1 INTO next_port
      FROM   mcloud.allocations
      WHERE  node_id = rec.node_id;

      INSERT INTO mcloud.allocations (node_id, ip, port)
      VALUES (rec.node_id, node_ip, next_port)
      RETURNING id INTO new_alloc;
    END IF;

    -- Link allocation ↔ server
    UPDATE mcloud.allocations SET server_id = rec.server_id, assigned_at = NOW()
    WHERE  id = new_alloc;

    UPDATE mcloud.servers SET allocation_id = new_alloc
    WHERE  id = rec.server_id;

    RAISE NOTICE 'Assigned allocation % to server %', new_alloc, rec.server_id;
  END LOOP;
END $$;
