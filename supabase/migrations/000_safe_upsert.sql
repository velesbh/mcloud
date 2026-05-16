-- =====================================================================
-- MCloud — schema-isolated migration
--
-- Other apps share this database AND have colliding table names (e.g. a
-- different `servers` table with integer PKs). The only safe answer is
-- to put every MCloud object in its own Postgres schema: `mcloud`.
--
-- After running this:
--   In Supabase Dashboard → Project Settings → API → "Exposed schemas",
--   add `mcloud` alongside `public`. The JS clients are already configured
--   with { db: { schema: 'mcloud' } } so .from("servers") resolves to
--   mcloud.servers automatically.
--
-- This script is safe to re-run. It never touches `public.*` tables that
-- belong to other apps.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS + SCHEMA
-- ─────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS mcloud;
GRANT USAGE ON SCHEMA mcloud TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mcloud
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mcloud
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mcloud
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 2. ENUMS (in mcloud schema)
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE mcloud.server_status AS ENUM (
  'creating','offline','starting','running','stopping','restarting',
  'error','suspended','hibernated'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE mcloud.server_status ADD VALUE IF NOT EXISTS 'hibernated';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE mcloud.node_status AS ENUM (
  'online','offline','maintenance','unknown'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE mcloud.server_loader AS ENUM (
  'vanilla','paper','spigot','fabric','forge','neoforge','quilt','bedrock'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE mcloud.backup_status AS ENUM (
  'creating','available','restoring','failed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE mcloud.user_role AS ENUM ('user','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE mcloud.game_edition AS ENUM ('java','bedrock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. updated_at trigger function
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mcloud.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────
-- 4. clerk_uid()  — reads JWT sub (Clerk user ID).
--    NOTE: Supabase locks the `auth` schema; we keep helpers in mcloud.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mcloud.clerk_uid() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────────────
-- 5. TABLES
-- ─────────────────────────────────────────────────────────────────────

-- regions ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.regions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  flag_emoji  TEXT DEFAULT '🌐',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- nodes -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.nodes (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id                 UUID NOT NULL REFERENCES mcloud.regions(id) ON DELETE RESTRICT,
  name                      TEXT NOT NULL,
  fqdn                      TEXT NOT NULL,
  ip                        INET NOT NULL,
  total_ram_mb              INTEGER NOT NULL DEFAULT 8192,
  total_cpu                 INTEGER NOT NULL DEFAULT 400,
  total_disk_mb             BIGINT  NOT NULL DEFAULT 102400,
  status                    mcloud.node_status NOT NULL DEFAULT 'unknown',
  is_public                 BOOLEAN NOT NULL DEFAULT TRUE,
  memory_overcommit_percent INTEGER NOT NULL DEFAULT 0,
  overallocation_percent    INTEGER NOT NULL DEFAULT 100,
  last_seen_at              TIMESTAMPTZ,
  running_count             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN mcloud.nodes.overallocation_percent IS
  'Allow allocating up to this %% of physical RAM/CPU/disk. 100 = no overalloc.';

-- public_ips ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.public_ips (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id    UUID NOT NULL REFERENCES mcloud.nodes(id) ON DELETE CASCADE,
  ip         INET NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          mcloud.user_role NOT NULL DEFAULT 'user',
  plan_tier     TEXT NOT NULL DEFAULT 'free',
  max_servers   INTEGER NOT NULL DEFAULT 1,
  max_ram_mb    INTEGER NOT NULL DEFAULT 1024,
  max_disk_mb   BIGINT  NOT NULL DEFAULT 5120,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- allocations -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.allocations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id     UUID NOT NULL REFERENCES mcloud.nodes(id) ON DELETE CASCADE,
  ip          INET NOT NULL,
  port        INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
  server_id   UUID,
  assigned_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ip, port)
);

-- servers ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.servers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES mcloud.profiles(id) ON DELETE CASCADE,
  clerk_user_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  edition         mcloud.game_edition  NOT NULL DEFAULT 'java',
  game_version    TEXT NOT NULL DEFAULT '1.21.4',
  loader          mcloud.server_loader NOT NULL DEFAULT 'paper',
  loader_version  TEXT,
  ram_mb          INTEGER NOT NULL DEFAULT 1024,
  cpu_percent     INTEGER NOT NULL DEFAULT 100,
  disk_mb         BIGINT  NOT NULL DEFAULT 5120,
  status          mcloud.server_status NOT NULL DEFAULT 'offline',
  node_id         UUID REFERENCES mcloud.nodes(id)       ON DELETE SET NULL,
  allocation_id   UUID REFERENCES mcloud.allocations(id) ON DELETE SET NULL,
  region_id       UUID REFERENCES mcloud.regions(id)     ON DELETE SET NULL,
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

-- Deferred FK: allocations.server_id → mcloud.servers.id
DO $$ BEGIN
  ALTER TABLE mcloud.allocations
    ADD CONSTRAINT allocations_server_id_fkey
    FOREIGN KEY (server_id) REFERENCES mcloud.servers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- server_backups --------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.server_backups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id    UUID NOT NULL REFERENCES mcloud.servers(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  status       mcloud.backup_status NOT NULL DEFAULT 'creating',
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- mod_installations -----------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.mod_installations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id           UUID NOT NULL REFERENCES mcloud.servers(id) ON DELETE CASCADE,
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

-- console_events --------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.console_events (
  id         BIGSERIAL PRIMARY KEY,
  server_id  UUID NOT NULL REFERENCES mcloud.servers(id) ON DELETE CASCADE,
  line       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'server',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- server_files ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.server_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id    UUID NOT NULL REFERENCES mcloud.servers(id) ON DELETE CASCADE,
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

-- billing_plans ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcloud.billing_plans (
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

-- ─────────────────────────────────────────────────────────────────────
-- 6. INDEXES
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mcloud_servers_clerk_user_id  ON mcloud.servers(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_mcloud_servers_node_id        ON mcloud.servers(node_id);
CREATE INDEX IF NOT EXISTS idx_mcloud_servers_status         ON mcloud.servers(status);
CREATE INDEX IF NOT EXISTS idx_mcloud_servers_last_active_at ON mcloud.servers(last_active_at);
CREATE INDEX IF NOT EXISTS idx_mcloud_allocations_node_id    ON mcloud.allocations(node_id);
CREATE INDEX IF NOT EXISTS idx_mcloud_allocations_server_id  ON mcloud.allocations(server_id);
CREATE INDEX IF NOT EXISTS idx_mcloud_server_backups_server_id   ON mcloud.server_backups(server_id);
CREATE INDEX IF NOT EXISTS idx_mcloud_mod_installations_server_id ON mcloud.mod_installations(server_id);
CREATE INDEX IF NOT EXISTS idx_mcloud_console_events_server_id   ON mcloud.console_events(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcloud_server_files_server_id_path ON mcloud.server_files(server_id, path);
CREATE INDEX IF NOT EXISTS idx_mcloud_billing_plans_visible_sort  ON mcloud.billing_plans(is_visible, sort_order);

-- ─────────────────────────────────────────────────────────────────────
-- 7. UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_regions_updated_at        ON mcloud.regions;
CREATE TRIGGER trg_regions_updated_at        BEFORE UPDATE ON mcloud.regions       FOR EACH ROW EXECUTE FUNCTION mcloud.set_updated_at();

DROP TRIGGER IF EXISTS trg_nodes_updated_at          ON mcloud.nodes;
CREATE TRIGGER trg_nodes_updated_at          BEFORE UPDATE ON mcloud.nodes         FOR EACH ROW EXECUTE FUNCTION mcloud.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at       ON mcloud.profiles;
CREATE TRIGGER trg_profiles_updated_at       BEFORE UPDATE ON mcloud.profiles      FOR EACH ROW EXECUTE FUNCTION mcloud.set_updated_at();

DROP TRIGGER IF EXISTS trg_servers_updated_at        ON mcloud.servers;
CREATE TRIGGER trg_servers_updated_at        BEFORE UPDATE ON mcloud.servers       FOR EACH ROW EXECUTE FUNCTION mcloud.set_updated_at();

DROP TRIGGER IF EXISTS trg_server_files_updated_at   ON mcloud.server_files;
CREATE TRIGGER trg_server_files_updated_at   BEFORE UPDATE ON mcloud.server_files  FOR EACH ROW EXECUTE FUNCTION mcloud.set_updated_at();

DROP TRIGGER IF EXISTS trg_billing_plans_updated_at  ON mcloud.billing_plans;
CREATE TRIGGER trg_billing_plans_updated_at  BEFORE UPDATE ON mcloud.billing_plans FOR EACH ROW EXECUTE FUNCTION mcloud.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 8. is_admin() — needs mcloud.profiles to exist first
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mcloud.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM mcloud.profiles
    WHERE clerk_user_id = mcloud.clerk_uid()
      AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mcloud.delete_old_console_events() RETURNS void AS $$
  DELETE FROM mcloud.console_events WHERE created_at < NOW() - INTERVAL '24 hours';
$$ LANGUAGE SQL;

-- ─────────────────────────────────────────────────────────────────────
-- 9. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE mcloud.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.servers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.server_backups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.mod_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.console_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.server_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.nodes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.regions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.allocations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.public_ips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.billing_plans     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 10. POLICIES
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_self_read       ON mcloud.profiles;
DROP POLICY IF EXISTS profiles_admin_read_all  ON mcloud.profiles;
DROP POLICY IF EXISTS profiles_self_update     ON mcloud.profiles;
DROP POLICY IF EXISTS profiles_service_insert  ON mcloud.profiles;
CREATE POLICY profiles_self_read      ON mcloud.profiles FOR SELECT USING (clerk_user_id = mcloud.clerk_uid());
CREATE POLICY profiles_admin_read_all ON mcloud.profiles FOR SELECT USING (mcloud.is_admin());
CREATE POLICY profiles_self_update    ON mcloud.profiles FOR UPDATE USING (clerk_user_id = mcloud.clerk_uid());
CREATE POLICY profiles_service_insert ON mcloud.profiles FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS servers_self_read      ON mcloud.servers;
DROP POLICY IF EXISTS servers_admin_read_all ON mcloud.servers;
DROP POLICY IF EXISTS servers_self_insert    ON mcloud.servers;
DROP POLICY IF EXISTS servers_self_update    ON mcloud.servers;
DROP POLICY IF EXISTS servers_admin_update   ON mcloud.servers;
DROP POLICY IF EXISTS servers_self_delete    ON mcloud.servers;
CREATE POLICY servers_self_read      ON mcloud.servers FOR SELECT USING (clerk_user_id = mcloud.clerk_uid());
CREATE POLICY servers_admin_read_all ON mcloud.servers FOR SELECT USING (mcloud.is_admin());
CREATE POLICY servers_self_insert    ON mcloud.servers FOR INSERT WITH CHECK (clerk_user_id = mcloud.clerk_uid());
CREATE POLICY servers_self_update    ON mcloud.servers FOR UPDATE USING (clerk_user_id = mcloud.clerk_uid());
CREATE POLICY servers_admin_update   ON mcloud.servers FOR UPDATE USING (mcloud.is_admin());
CREATE POLICY servers_self_delete    ON mcloud.servers FOR DELETE USING (clerk_user_id = mcloud.clerk_uid());

DROP POLICY IF EXISTS backups_self_all  ON mcloud.server_backups;
DROP POLICY IF EXISTS backups_admin_all ON mcloud.server_backups;
CREATE POLICY backups_self_all  ON mcloud.server_backups FOR ALL USING (
  EXISTS (SELECT 1 FROM mcloud.servers s WHERE s.id = server_backups.server_id AND s.clerk_user_id = mcloud.clerk_uid())
);
CREATE POLICY backups_admin_all ON mcloud.server_backups FOR ALL USING (mcloud.is_admin());

DROP POLICY IF EXISTS mods_self_all ON mcloud.mod_installations;
CREATE POLICY mods_self_all ON mcloud.mod_installations FOR ALL USING (
  EXISTS (SELECT 1 FROM mcloud.servers s WHERE s.id = mod_installations.server_id AND s.clerk_user_id = mcloud.clerk_uid())
);

DROP POLICY IF EXISTS console_self_all ON mcloud.console_events;
CREATE POLICY console_self_all ON mcloud.console_events FOR ALL USING (
  EXISTS (SELECT 1 FROM mcloud.servers s WHERE s.id = console_events.server_id AND s.clerk_user_id = mcloud.clerk_uid())
);

DROP POLICY IF EXISTS files_self_all ON mcloud.server_files;
CREATE POLICY files_self_all ON mcloud.server_files FOR ALL USING (
  EXISTS (SELECT 1 FROM mcloud.servers s WHERE s.id = server_files.server_id AND s.clerk_user_id = mcloud.clerk_uid())
);

DROP POLICY IF EXISTS nodes_public_read ON mcloud.nodes;
DROP POLICY IF EXISTS nodes_admin_all   ON mcloud.nodes;
CREATE POLICY nodes_public_read ON mcloud.nodes FOR SELECT USING (TRUE);
CREATE POLICY nodes_admin_all   ON mcloud.nodes FOR ALL    USING (mcloud.is_admin());

DROP POLICY IF EXISTS regions_public_read ON mcloud.regions;
DROP POLICY IF EXISTS regions_admin_all   ON mcloud.regions;
CREATE POLICY regions_public_read ON mcloud.regions FOR SELECT USING (TRUE);
CREATE POLICY regions_admin_all   ON mcloud.regions FOR ALL    USING (mcloud.is_admin());

DROP POLICY IF EXISTS allocations_self_read ON mcloud.allocations;
DROP POLICY IF EXISTS allocations_admin_all ON mcloud.allocations;
CREATE POLICY allocations_self_read ON mcloud.allocations FOR SELECT USING (
  server_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM mcloud.servers s WHERE s.id = allocations.server_id AND s.clerk_user_id = mcloud.clerk_uid()
  )
);
CREATE POLICY allocations_admin_all ON mcloud.allocations FOR ALL USING (mcloud.is_admin());

DROP POLICY IF EXISTS public_ips_admin_all ON mcloud.public_ips;
CREATE POLICY public_ips_admin_all ON mcloud.public_ips FOR ALL USING (mcloud.is_admin());

DROP POLICY IF EXISTS billing_public_read ON mcloud.billing_plans;
DROP POLICY IF EXISTS billing_admin_all   ON mcloud.billing_plans;
CREATE POLICY billing_public_read ON mcloud.billing_plans FOR SELECT USING (is_visible = TRUE);
CREATE POLICY billing_admin_all   ON mcloud.billing_plans FOR ALL    USING (mcloud.is_admin()) WITH CHECK (mcloud.is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 11. Free-tier server-limit trigger
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mcloud.check_server_limit()
RETURNS TRIGGER AS $$
DECLARE
  profile_record mcloud.profiles%ROWTYPE;
  current_count  INTEGER;
BEGIN
  SELECT * INTO profile_record FROM mcloud.profiles WHERE clerk_user_id = NEW.clerk_user_id;
  SELECT COUNT(*) INTO current_count  FROM mcloud.servers  WHERE clerk_user_id = NEW.clerk_user_id;
  IF current_count >= profile_record.max_servers THEN
    RAISE EXCEPTION 'SERVER_LIMIT_REACHED: max % servers allowed', profile_record.max_servers;
  END IF;
  IF NEW.ram_mb  > profile_record.max_ram_mb  THEN
    RAISE EXCEPTION 'RAM_LIMIT_EXCEEDED: max % MB RAM allowed',  profile_record.max_ram_mb;
  END IF;
  IF NEW.disk_mb > profile_record.max_disk_mb THEN
    RAISE EXCEPTION 'DISK_LIMIT_EXCEEDED: max % MB disk allowed', profile_record.max_disk_mb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_server_limit ON mcloud.servers;
CREATE TRIGGER trg_check_server_limit
  BEFORE INSERT ON mcloud.servers FOR EACH ROW EXECUTE FUNCTION mcloud.check_server_limit();

-- ─────────────────────────────────────────────────────────────────────
-- 12. Hibernation lifecycle — touch last_active_at on wake-up
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mcloud.servers_touch_active() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('running','starting','restarting')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_active_at := NOW();
    IF OLD.status = 'hibernated' THEN NEW.hibernated_at := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS servers_touch_active_trg ON mcloud.servers;
CREATE TRIGGER servers_touch_active_trg
  BEFORE UPDATE ON mcloud.servers FOR EACH ROW EXECUTE FUNCTION mcloud.servers_touch_active();

-- ─────────────────────────────────────────────────────────────────────
-- 13. node_stock view + pick_node_with_stock RPC
-- ─────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────
-- 14. REALTIME — wrap ADD TABLE in DO blocks (PG has no IF NOT EXISTS form)
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.servers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.console_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mcloud.server_backups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 15. STORAGE — buckets + per-server access policies
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('mcloud-server-files',   'mcloud-server-files',   FALSE),
  ('mcloud-server-backups', 'mcloud-server-backups', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS mcloud_users_access_own_server_files   ON storage.objects;
DROP POLICY IF EXISTS mcloud_users_access_own_server_backups ON storage.objects;

CREATE POLICY mcloud_users_access_own_server_files
  ON storage.objects FOR ALL USING (
    bucket_id = 'mcloud-server-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM mcloud.servers WHERE clerk_user_id = mcloud.clerk_uid()
    )
  );

CREATE POLICY mcloud_users_access_own_server_backups
  ON storage.objects FOR ALL USING (
    bucket_id = 'mcloud-server-backups'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM mcloud.servers WHERE clerk_user_id = mcloud.clerk_uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 16. SEED
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO mcloud.regions (name, slug, description, flag_emoji)
VALUES ('US East', 'us-east', 'United States — East Coast', '🇺🇸')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO mcloud.billing_plans (plan_key, name, description, monthly_price_usd,
                           max_servers, max_ram_mb, max_disk_mb, max_cpu_percent,
                           sort_order, is_visible, is_highlighted)
VALUES
  ('free',    'Free',    'For trying things out',  0.00, 1, 1024,  5120,  100, 0, TRUE, FALSE),
  ('starter', 'Starter', 'For small communities', 5.00, 2, 4096, 20480,  200, 1, TRUE, FALSE),
  ('pro',     'Pro',     'For serious worlds',    15.00, 5, 8192, 51200, 400, 2, TRUE, TRUE)
ON CONFLICT (plan_key) DO NOTHING;
