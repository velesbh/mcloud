-- ─── 1. Default allocation flag ─────────────────────────────────────────────
ALTER TABLE mcloud.allocations
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- ─── 2. Server collaborators ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcloud.server_collaborators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       uuid NOT NULL REFERENCES mcloud.servers(id) ON DELETE CASCADE,
  clerk_user_id   text NOT NULL,
  email           text NOT NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, clerk_user_id)
);

ALTER TABLE mcloud.server_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can see & manage their server's collaborators
CREATE POLICY "collaborators_owner_all" ON mcloud.server_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mcloud.servers s
      WHERE s.id = server_id
        AND s.clerk_user_id = auth.clerk_user_id()
    )
  );

-- Collaborators can see the row so they know they have access
CREATE POLICY "collaborators_self_select" ON mcloud.server_collaborators
  FOR SELECT USING (clerk_user_id = auth.clerk_user_id());

-- Expose in realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.server_collaborators;
