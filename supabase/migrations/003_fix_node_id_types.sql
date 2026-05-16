-- servers.node_id may have been created as integer in an earlier schema.
-- Cast it to UUID to match the nodes.id primary key.
DO $$
BEGIN
  -- Only alter if the column is NOT already uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'servers'
      AND column_name  = 'node_id'
      AND data_type   <> 'uuid'
  ) THEN
    -- Drop the FK first (name may vary – drop by column instead)
    ALTER TABLE public.servers
      DROP CONSTRAINT IF EXISTS servers_node_id_fkey;

    -- Re-create as UUID (nullable – servers can be unassigned)
    ALTER TABLE public.servers
      ALTER COLUMN node_id TYPE uuid USING NULL;

    -- Re-add FK
    ALTER TABLE public.servers
      ADD CONSTRAINT servers_node_id_fkey
      FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Same fix for allocations.server_id if it's integer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'allocations'
      AND column_name  = 'server_id'
      AND data_type   <> 'uuid'
  ) THEN
    ALTER TABLE public.allocations
      DROP CONSTRAINT IF EXISTS allocations_server_id_fkey;

    ALTER TABLE public.allocations
      ALTER COLUMN server_id TYPE uuid USING NULL;

    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_server_id_fkey
      FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE SET NULL;
  END IF;
END $$;
