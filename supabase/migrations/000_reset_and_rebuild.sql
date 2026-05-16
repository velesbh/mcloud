-- =====================================================================
-- MCloud — Consolidated reset + rebuild migration
--
-- Why this exists:
--   Earlier migrations (001/002/003) left the database in an inconsistent
--   partial state — tables without expected columns, helpers in the wrong
--   schema, etc. The previous "IF NOT EXISTS"-everywhere approach made
--   things worse: it silently skipped existing-but-wrong tables, so later
--   statements that referenced new columns died with "column does not
--   exist" errors. This file is the single source of truth — paste the
--   whole thing into the Supabase SQL editor and run it. It will wipe
--   any prior MCloud schema and recreate it cleanly.
--
-- Auth model:
--   Clerk validates the JWT; Supabase trusts it via Third-Party Auth.
--   The Clerk user-id is the JWT `sub` claim. Supabase's `auth.uid()`
--   doesn't work because Clerk IDs aren't UUIDs, so RLS policies read
--   the sub claim directly via `auth.jwt() ->> 'sub'`.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 0. NUKE — drop everything we might have left behind (dev/staging only)
-- ─────────────────────────────────────────────────────────────────────
DROP VIEW     IF EXISTS node_stock CASCADE;

DROP TABLE    IF EXISTS server_files       CASCADE;
DROP TABLE    IF EXISTS console_events     CASCADE;
DROP TABLE    IF EXISTS mod_installations  CASCADE;
DROP TABLE    IF EXISTS server_backups     CASCADE;
DROP TABLE    IF EXISTS servers            CASCADE;
DROP TABLE    IF EXISTS allocations        CASCADE;
DROP TABLE    IF EXISTS public_ips         CASCADE;
DROP TABLE    IF EXISTS nodes              CASCADE;
DROP TABLE    IF EXISTS profiles           CASCADE;
DROP TABLE    IF EXISTS regions            CASCADE;
DROP TABLE    IF EXISTS billing_plans      CASCADE;

DROP FUNCTION IF EXISTS pick_node_with_stock(uuid, int, int, int) CASCADE;
DROP FUNCTION IF EXISTS servers_touch_active()        CASCADE;
DROP FUNCTION IF EXISTS check_server_limit()          CASCADE;
DROP FUNCTION IF EXISTS delete_old_console_events()   CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()              CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()             CASCADE;
DROP FUNCTION IF EXISTS public.clerk_uid()            CASCADE;
DROP FUNCTION IF EXISTS auth.is_admin()               CASCADE;
DROP FUNCTION IF EXISTS auth.clerk_user_id()          CASCADE;

DROP TYPE     IF EXISTS game_edition  CASCADE;
DROP TYPE     IF EXISTS user_role     CASCADE;
DROP TYPE     IF EXISTS backup_status CASCADE;
DROP TYPE     IF EXISTS server_loader CASCADE;
DROP TYPE     IF EXISTS node_status   CASCADE;
DROP TYPE     IF EXISTS server_status CASCADE;

-- ─────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────
-- 2. ENUMS  (hibernated is part of the initial set this time)
-- ─────────────────────────────────────────────────────────────────────
CREATE TYPE server_status AS ENUM (
  'creating', 'offline', 'starting', 'running',
  'stopping', 'restarting', 'error', 'suspended', 'hibernated'
);
CREATE TYPE node_status   AS ENUM ('online', 'offline', 'maintenance', 'unknown');
CREATE TYPE server_loader AS ENUM (
  'vanilla', 'paper', 'spigot', 'fabric',
  'forge', 'neoforge', 'quilt', 'bedrock'
);
CREATE TYPE backup_status AS ENUM ('creating', 'available', 'restoring', 'failed');
CREATE TYPE user_role     AS ENUM ('user', 'admin');
CREATE TYPE game_edition  AS ENUM ('java', 'bedrock');

-- ─────────────────────────────────────────────────────────────────────
-- 3. UTILITY: updated_at trigger function (used by every mutable table)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────
-- 4. AUTH HELPERS  (public schema — auth schema is restricted in Supabase)
--    clerk_uid()  reads the validated JWT's sub claim.
--    is_admin()   asks the profiles table; runs as SECURITY DEFINER so
--                 it bypasses its own RLS while we evaluate it.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clerk_uid() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────────────
-- 5. TABLES (created in dependency order; no IF NOT EXISTS — we just
--    dropped everything above, so they must not exist)
-- ─────────────────────────────────────────────────────────────────────

-- regions ----------------------------------------------------------------
CREATE TABLE regions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  flag_emoji  TEXT DEFAULT '🌐',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_regions_updated_at
  BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- nodes ------------------------------------------------------------------
CREATE TABLE nodes (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id                 UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  name                      TEXT NOT NULL,
  fqdn                      TEXT NOT NULL,
  ip                        INET NOT NULL,
  total_ram_mb              INTEGER NOT NULL DEFAULT 8192,
  total_cpu                 INTEGER NOT NULL DEFAULT 400,
  total_disk_mb             BIGINT  NOT NULL DEFAULT 102400,
  status                    node_status NOT NULL DEFAULT 'unknown',
  is_public                 BOOLEAN NOT NULL DEFAULT TRUE,
  memory_overcommit_percent INTEGER NOT NULL DEFAULT 0,
  overallocation_percent    INTEGER NOT NULL DEFAULT 100,
  last_seen_at              TIMESTAMPTZ,
  running_count             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_nodes_updated_at
  BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON COLUMN nodes.overallocation_percent IS
  'Allow allocating up to this %% of physical RAM/CPU/disk. 100 = no overalloc, 150 = 1.5x.';

-- public_ips -------------------------------------------------------------
CREATE TABLE public_ips (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id    UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ip         INET NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles ---------------------------------------------------------------
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          user_role NOT NULL DEFAULT 'user',
  plan_tier     TEXT NOT NULL DEFAULT 'free',
  max_servers   INTEGER NOT NULL DEFAULT 1,
  max_ram_mb    INTEGER NOT NULL DEFAULT 1024,
  max_disk_mb   BIGINT  NOT NULL DEFAULT 5120,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON COLUMN profiles.plan_tier IS
  'free | starter | pro — synced from Clerk billing plan slug.';

-- allocations ------------------------------------------------------------
-- server_id FK is added AFTER servers exists.
CREATE TABLE allocations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id     UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ip          INET NOT NULL,
  port        INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
  server_id   UUID,
  assigned_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ip, port)
);

-- servers ----------------------------------------------------------------
CREATE TABLE servers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clerk_user_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  edition         game_edition  NOT NULL DEFAULT 'java',
  game_version    TEXT NOT NULL DEFAULT '1.21.4',
  loader          server_loader NOT NULL DEFAULT 'paper',
  loader_version  TEXT,
  ram_mb          INTEGER NOT NULL DEFAULT 1024,
  cpu_percent     INTEGER NOT NULL DEFAULT 100,
  disk_mb         BIGINT  NOT NULL DEFAULT 5120,
  status          server_status NOT NULL DEFAULT 'offline',
  node_id         UUID REFERENCES nodes(id)       ON DELETE SET NULL,
  allocation_id   UUID REFERENCES allocations(id) ON DELETE SET NULL,
  region_id       UUID REFERENCES regions(id)     ON DELETE SET NULL,
  motd            TEXT DEFAULT 'A Minecraft Server',
  max_players     INTEGER NOT NULL DEFAULT 20,
  java_flags      TEXT,
  env_vars        JSONB NOT NULL DEFAULT '{}',
  installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_started_at TIMESTAMPTZ,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hibernated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_servers_updated_at
  BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- back-fill the FK we deferred earlier
ALTER TABLE allocations
  ADD CONSTRAINT allocations_server_id_fkey
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL;

-- server_backups ---------------------------------------------------------
CREATE TABLE server_backups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id    UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  status       backup_status NOT NULL DEFAULT 'creating',
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- mod_installations ------------------------------------------------------
CREATE TABLE mod_installations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  modrinth_project_id TEXT NOT NULL,
  version_id          TEXT NOT NULL,
  name                TEXT NOT NULL,
  icon_url            TEXT,
  type                TEXT NOT NULL DEFAULT 'mod',
  loader              TEXT,
  game_version        TEXT,
  installed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, modrinth_project_id)
);

-- console_events ---------------------------------------------------------
CREATE TABLE console_events (
  id         BIGSERIAL PRIMARY KEY,
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  line       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'server',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION delete_old_console_events() RETURNS void AS $$
  DELETE FROM console_events WHERE created_at < NOW() - INTERVAL '24 hours';
$$ LANGUAGE SQL;

-- server_files -----------------------------------------------------------
CREATE TABLE server_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id    UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  name         TEXT NOT NULL,
  is_directory BOOLEAN NOT NULL DEFAULT FALSE,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  mime_type    TEXT,
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, path)
);
CREATE TRIGGER trg_server_files_updated_at
  BEFORE UPDATE ON server_files FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- billing_plans ----------------------------------------------------------
CREATE TABLE billing_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key          TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  monthly_price_usd NUMERIC(10, 2),
  max_servers       INT  NOT NULL DEFAULT 1,
  max_ram_mb        INT  NOT NULL DEFAULT 1024,
  max_disk_mb       INT  NOT NULL DEFAULT 5120,
  max_cpu_percent   INT  NOT NULL DEFAULT 100,
  features          JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order        INT  NOT NULL DEFAULT 0,
  is_visible        BOOLEAN NOT NULL DEFAULT TRUE,
  is_highlighted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_billing_plans_updated_at
  BEFORE UPDATE ON billing_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 6. INDEXES
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX idx_servers_clerk_user_id    ON servers(clerk_user_id);
CREATE INDEX idx_servers_node_id          ON servers(node_id);
CREATE INDEX idx_servers_status           ON servers(status);
CREATE INDEX idx_servers_last_active_at   ON servers(last_active_at);
CREATE INDEX idx_allocations_node_id      ON allocations(node_id);
CREATE INDEX idx_allocations_server_id    ON allocations(server_id);
CREATE INDEX idx_server_backups_server_id ON server_backups(server_id);
CREATE INDEX idx_mod_installations_server_id ON mod_installations(server_id);
CREATE INDEX idx_console_events_server_id ON console_events(server_id, created_at DESC);
CREATE INDEX idx_server_files_server_id_path ON server_files(server_id, path);
CREATE INDEX idx_billing_plans_visible_sort  ON billing_plans(is_visible, sort_order);

-- ─────────────────────────────────────────────────────────────────────
-- 7. is_admin() — defined AFTER profiles exists so the body can reference it
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE clerk_user_id = public.clerk_uid()
      AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────
-- 8. RLS — enable on every user-facing table
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_backups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE console_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_ips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_plans     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 9. RLS POLICIES — use clerk_uid() which wraps auth.jwt() ->> 'sub'
-- ─────────────────────────────────────────────────────────────────────

-- profiles
CREATE POLICY profiles_self_read       ON profiles FOR SELECT USING (clerk_user_id = clerk_uid());
CREATE POLICY profiles_admin_read_all  ON profiles FOR SELECT USING (is_admin());
CREATE POLICY profiles_self_update     ON profiles FOR UPDATE USING (clerk_user_id = clerk_uid());
CREATE POLICY profiles_service_insert  ON profiles FOR INSERT WITH CHECK (TRUE);

-- servers
CREATE POLICY servers_self_read        ON servers FOR SELECT USING (clerk_user_id = clerk_uid());
CREATE POLICY servers_admin_read_all   ON servers FOR SELECT USING (is_admin());
CREATE POLICY servers_self_insert      ON servers FOR INSERT WITH CHECK (clerk_user_id = clerk_uid());
CREATE POLICY servers_self_update      ON servers FOR UPDATE USING (clerk_user_id = clerk_uid());
CREATE POLICY servers_admin_update     ON servers FOR UPDATE USING (is_admin());
CREATE POLICY servers_self_delete      ON servers FOR DELETE USING (clerk_user_id = clerk_uid());

-- server_backups
CREATE POLICY backups_self_all  ON server_backups FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = server_backups.server_id AND s.clerk_user_id = clerk_uid())
);
CREATE POLICY backups_admin_all ON server_backups FOR ALL USING (is_admin());

-- mod_installations
CREATE POLICY mods_self_all ON mod_installations FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = mod_installations.server_id AND s.clerk_user_id = clerk_uid())
);

-- console_events
CREATE POLICY console_self_all ON console_events FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = console_events.server_id AND s.clerk_user_id = clerk_uid())
);

-- server_files
CREATE POLICY files_self_all ON server_files FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = server_files.server_id AND s.clerk_user_id = clerk_uid())
);

-- nodes / regions — public read, admin write
CREATE POLICY nodes_public_read   ON nodes   FOR SELECT USING (TRUE);
CREATE POLICY nodes_admin_all     ON nodes   FOR ALL    USING (is_admin());
CREATE POLICY regions_public_read ON regions FOR SELECT USING (TRUE);
CREATE POLICY regions_admin_all   ON regions FOR ALL    USING (is_admin());

-- allocations — users see their own, admins manage
CREATE POLICY allocations_self_read ON allocations FOR SELECT USING (
  server_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM servers s WHERE s.id = allocations.server_id AND s.clerk_user_id = clerk_uid()
  )
);
CREATE POLICY allocations_admin_all ON allocations FOR ALL USING (is_admin());

-- public_ips — admin only
CREATE POLICY public_ips_admin_all ON public_ips FOR ALL USING (is_admin());

-- billing_plans — anyone can read visible plans, admins manage
CREATE POLICY billing_public_read ON billing_plans FOR SELECT USING (is_visible = TRUE);
CREATE POLICY billing_admin_all   ON billing_plans FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 10. Free-tier server-limit trigger
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_server_limit()
RETURNS TRIGGER AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  current_count  INTEGER;
BEGIN
  SELECT * INTO profile_record FROM profiles
   WHERE clerk_user_id = NEW.clerk_user_id;

  SELECT COUNT(*) INTO current_count FROM servers
   WHERE clerk_user_id = NEW.clerk_user_id;

  IF current_count >= profile_record.max_servers THEN
    RAISE EXCEPTION 'SERVER_LIMIT_REACHED: max % servers allowed', profile_record.max_servers;
  END IF;
  IF NEW.ram_mb > profile_record.max_ram_mb THEN
    RAISE EXCEPTION 'RAM_LIMIT_EXCEEDED: max % MB RAM allowed',   profile_record.max_ram_mb;
  END IF;
  IF NEW.disk_mb > profile_record.max_disk_mb THEN
    RAISE EXCEPTION 'DISK_LIMIT_EXCEEDED: max % MB disk allowed', profile_record.max_disk_mb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_server_limit
  BEFORE INSERT ON servers
  FOR EACH ROW EXECUTE FUNCTION check_server_limit();

-- ─────────────────────────────────────────────────────────────────────
-- 11. Hibernation lifecycle — bump last_active_at when waking up
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION servers_touch_active() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('running','starting','restarting')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_active_at := NOW();
    IF OLD.status = 'hibernated' THEN
      NEW.hibernated_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER servers_touch_active_trg
  BEFORE UPDATE ON servers
  FOR EACH ROW EXECUTE FUNCTION servers_touch_active();

-- ─────────────────────────────────────────────────────────────────────
-- 12. node_stock view — capacity ledger for stock-aware placement
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW node_stock AS
SELECT
  n.id,
  n.name,
  n.region_id,
  n.total_ram_mb,
  n.total_cpu,
  n.total_disk_mb,
  n.overallocation_percent,
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
  n.status,
  n.last_seen_at,
  n.running_count
FROM nodes n
LEFT JOIN servers s ON s.node_id = n.id
GROUP BY n.id;

-- ─────────────────────────────────────────────────────────────────────
-- 13. pick_node_with_stock — atomic stock-aware placement RPC
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pick_node_with_stock(
  want_region  UUID,
  want_ram_mb  INT,
  want_cpu     INT,
  want_disk_mb INT
) RETURNS UUID AS $$
DECLARE
  picked UUID;
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

-- ─────────────────────────────────────────────────────────────────────
-- 14. REALTIME — register tables for client subscriptions
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE servers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE console_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE server_backups;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 15. STORAGE — buckets + per-server access policies
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('server-files',   'server-files',   FALSE),
  ('server-backups', 'server-backups', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS users_access_own_server_files_storage   ON storage.objects;
DROP POLICY IF EXISTS users_access_own_server_backups_storage ON storage.objects;

CREATE POLICY users_access_own_server_files_storage
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'server-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM servers WHERE clerk_user_id = clerk_uid()
    )
  );

CREATE POLICY users_access_own_server_backups_storage
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'server-backups'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM servers WHERE clerk_user_id = clerk_uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 16. SEED
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO regions (name, slug, description, flag_emoji)
VALUES ('US East', 'us-east', 'United States — East Coast', '🇺🇸')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO billing_plans (plan_key, name, description, monthly_price_usd,
                           max_servers, max_ram_mb, max_disk_mb, max_cpu_percent,
                           sort_order, is_visible, is_highlighted)
VALUES
  ('free',    'Free',    'For trying things out',  0.00, 1, 1024,  5120,  100, 0, TRUE, FALSE),
  ('starter', 'Starter', 'For small communities', 5.00, 2, 4096, 20480,  200, 1, TRUE, FALSE),
  ('pro',     'Pro',     'For serious worlds',    15.00, 5, 8192, 51200, 400, 2, TRUE, TRUE)
ON CONFLICT (plan_key) DO NOTHING;

-- =====================================================================
-- Done. Verify with:
--   SELECT proname, pronamespace::regnamespace FROM pg_proc
--    WHERE proname IN ('clerk_uid', 'is_admin', 'set_updated_at',
--                      'pick_node_with_stock');
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- =====================================================================
