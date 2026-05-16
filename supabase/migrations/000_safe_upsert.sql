-- =====================================================================
-- MCloud — Safe additive migration (NON-DESTRUCTIVE)
--
-- Other apps share this database, so we never DROP TABLE. Instead we:
--   1. CREATE TABLE IF NOT EXISTS  (won't touch existing tables)
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS for each column we expect
--      (this fixes the "partial schema" problem from earlier broken runs
--      — tables that exist but are missing newer columns get patched)
--   3. CREATE OR REPLACE for every function (safe — no data lives there)
--   4. DROP POLICY IF EXISTS + CREATE for each policy (so we can repoint
--      them at the new clerk_uid() helper without leaking the old broken
--      auth.clerk_user_id() references)
--   5. Idempotent guards (DO blocks, IF NOT EXISTS) on everything else
--
-- Paste the whole file into Supabase SQL Editor and run. Safe to re-run.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────
-- 2. ENUMS (DO blocks — won't error if already exists)
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE server_status AS ENUM (
  'creating','offline','starting','running','stopping','restarting',
  'error','suspended','hibernated'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- If server_status already exists from a prior run without 'hibernated',
-- add the missing value. ADD VALUE IF NOT EXISTS is non-destructive.
DO $$ BEGIN
  ALTER TYPE server_status ADD VALUE IF NOT EXISTS 'hibernated';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE node_status AS ENUM (
  'online','offline','maintenance','unknown'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE server_loader AS ENUM (
  'vanilla','paper','spigot','fabric','forge','neoforge','quilt','bedrock'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE backup_status AS ENUM (
  'creating','available','restoring','failed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE game_edition AS ENUM ('java','bedrock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. set_updated_at() — must exist before any trigger references it
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────
-- 4. clerk_uid()  — reads JWT sub claim. public schema (auth is locked)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clerk_uid() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────────────
-- 5. TABLES — CREATE IF NOT EXISTS, then ALTER ADD COLUMN IF NOT EXISTS
--    The second step patches existing-but-incomplete tables from earlier
--    failed migration attempts.
-- ─────────────────────────────────────────────────────────────────────

-- regions ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  flag_emoji  TEXT DEFAULT '🌐',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE regions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS flag_emoji  TEXT DEFAULT '🌐';

-- nodes -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
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
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_public                 BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS memory_overcommit_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS overallocation_percent    INTEGER NOT NULL DEFAULT 100;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_seen_at              TIMESTAMPTZ;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS running_count             INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN nodes.overallocation_percent IS
  'Allow allocating up to this %% of physical RAM/CPU/disk. 100 = no overalloc, 150 = 1.5x.';

-- public_ips ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_ips (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id    UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ip         INET NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
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
-- Patch any partial profiles table: critical for the "column clerk_user_id
-- does not exist" error if a prior run created profiles without it.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role          user_role NOT NULL DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier     TEXT NOT NULL DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_servers   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_ram_mb    INTEGER NOT NULL DEFAULT 1024;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_disk_mb   BIGINT  NOT NULL DEFAULT 5120;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Ensure clerk_user_id is unique (silently no-ops if constraint exists)
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_clerk_user_id_key UNIQUE (clerk_user_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- allocations -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id     UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ip          INET NOT NULL,
  port        INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
  server_id   UUID,
  assigned_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ip, port)
);

-- servers ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servers (
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
-- Patch any partial servers table
ALTER TABLE servers ADD COLUMN IF NOT EXISTS clerk_user_id   TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS edition         game_edition  NOT NULL DEFAULT 'java';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS game_version    TEXT NOT NULL DEFAULT '1.21.4';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS loader          server_loader NOT NULL DEFAULT 'paper';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS loader_version  TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ram_mb          INTEGER NOT NULL DEFAULT 1024;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS cpu_percent     INTEGER NOT NULL DEFAULT 100;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS disk_mb         BIGINT  NOT NULL DEFAULT 5120;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS status          server_status NOT NULL DEFAULT 'offline';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS node_id         UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS allocation_id   UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS region_id       UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS motd            TEXT DEFAULT 'A Minecraft Server';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS max_players     INTEGER NOT NULL DEFAULT 20;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS java_flags      TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS env_vars        JSONB NOT NULL DEFAULT '{}';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMPTZ;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE servers ADD COLUMN IF NOT EXISTS hibernated_at   TIMESTAMPTZ;

-- Deferred FK: allocations.server_id → servers.id
DO $$ BEGIN
  ALTER TABLE allocations
    ADD CONSTRAINT allocations_server_id_fkey
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- server_backups --------------------------------------------------------
CREATE TABLE IF NOT EXISTS server_backups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id    UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  status       backup_status NOT NULL DEFAULT 'creating',
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- mod_installations -----------------------------------------------------
CREATE TABLE IF NOT EXISTS mod_installations (
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

-- console_events --------------------------------------------------------
CREATE TABLE IF NOT EXISTS console_events (
  id         BIGSERIAL PRIMARY KEY,
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  line       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'server',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- server_files ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS server_files (
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

-- billing_plans ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_plans (
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
-- 6. INDEXES (CREATE IF NOT EXISTS) — only valid after columns exist
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_servers_clerk_user_id    ON servers(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_servers_node_id          ON servers(node_id);
CREATE INDEX IF NOT EXISTS idx_servers_status           ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_last_active_at   ON servers(last_active_at);
CREATE INDEX IF NOT EXISTS idx_allocations_node_id      ON allocations(node_id);
CREATE INDEX IF NOT EXISTS idx_allocations_server_id    ON allocations(server_id);
CREATE INDEX IF NOT EXISTS idx_server_backups_server_id ON server_backups(server_id);
CREATE INDEX IF NOT EXISTS idx_mod_installations_server_id ON mod_installations(server_id);
CREATE INDEX IF NOT EXISTS idx_console_events_server_id ON console_events(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_files_server_id_path ON server_files(server_id, path);
CREATE INDEX IF NOT EXISTS idx_billing_plans_visible_sort  ON billing_plans(is_visible, sort_order);

-- ─────────────────────────────────────────────────────────────────────
-- 7. UPDATED_AT TRIGGERS — drop-and-recreate is safe (no data)
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_regions_updated_at        ON regions;
CREATE TRIGGER trg_regions_updated_at        BEFORE UPDATE ON regions       FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_nodes_updated_at          ON nodes;
CREATE TRIGGER trg_nodes_updated_at          BEFORE UPDATE ON nodes         FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at       ON profiles;
CREATE TRIGGER trg_profiles_updated_at       BEFORE UPDATE ON profiles      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_servers_updated_at        ON servers;
CREATE TRIGGER trg_servers_updated_at        BEFORE UPDATE ON servers       FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_server_files_updated_at   ON server_files;
CREATE TRIGGER trg_server_files_updated_at   BEFORE UPDATE ON server_files  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_billing_plans_updated_at  ON billing_plans;
CREATE TRIGGER trg_billing_plans_updated_at  BEFORE UPDATE ON billing_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 8. is_admin()  — must come AFTER profiles exists with clerk_user_id
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE clerk_user_id = public.clerk_uid()
      AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_old_console_events() RETURNS void AS $$
  DELETE FROM console_events WHERE created_at < NOW() - INTERVAL '24 hours';
$$ LANGUAGE SQL;

-- ─────────────────────────────────────────────────────────────────────
-- 9. ENABLE RLS  (no-op if already enabled)
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
-- 10. POLICIES — drop any stale ones (might reference old function names)
--     then create fresh against clerk_uid() / is_admin()
-- ─────────────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS users_read_own_profile        ON profiles;
DROP POLICY IF EXISTS admins_read_all_profiles      ON profiles;
DROP POLICY IF EXISTS users_update_own_profile      ON profiles;
DROP POLICY IF EXISTS service_role_insert_profiles  ON profiles;
DROP POLICY IF EXISTS profiles_self_read            ON profiles;
DROP POLICY IF EXISTS profiles_admin_read_all       ON profiles;
DROP POLICY IF EXISTS profiles_self_update          ON profiles;
DROP POLICY IF EXISTS profiles_service_insert       ON profiles;
CREATE POLICY profiles_self_read      ON profiles FOR SELECT USING (clerk_user_id = clerk_uid());
CREATE POLICY profiles_admin_read_all ON profiles FOR SELECT USING (is_admin());
CREATE POLICY profiles_self_update    ON profiles FOR UPDATE USING (clerk_user_id = clerk_uid());
CREATE POLICY profiles_service_insert ON profiles FOR INSERT WITH CHECK (TRUE);

-- servers
DROP POLICY IF EXISTS users_read_own_servers    ON servers;
DROP POLICY IF EXISTS admins_read_all_servers   ON servers;
DROP POLICY IF EXISTS users_insert_own_servers  ON servers;
DROP POLICY IF EXISTS users_update_own_servers  ON servers;
DROP POLICY IF EXISTS admins_update_any_server  ON servers;
DROP POLICY IF EXISTS users_delete_own_servers  ON servers;
DROP POLICY IF EXISTS servers_self_read         ON servers;
DROP POLICY IF EXISTS servers_admin_read_all    ON servers;
DROP POLICY IF EXISTS servers_self_insert       ON servers;
DROP POLICY IF EXISTS servers_self_update       ON servers;
DROP POLICY IF EXISTS servers_admin_update      ON servers;
DROP POLICY IF EXISTS servers_self_delete       ON servers;
CREATE POLICY servers_self_read      ON servers FOR SELECT USING (clerk_user_id = clerk_uid());
CREATE POLICY servers_admin_read_all ON servers FOR SELECT USING (is_admin());
CREATE POLICY servers_self_insert    ON servers FOR INSERT WITH CHECK (clerk_user_id = clerk_uid());
CREATE POLICY servers_self_update    ON servers FOR UPDATE USING (clerk_user_id = clerk_uid());
CREATE POLICY servers_admin_update   ON servers FOR UPDATE USING (is_admin());
CREATE POLICY servers_self_delete    ON servers FOR DELETE USING (clerk_user_id = clerk_uid());

-- server_backups
DROP POLICY IF EXISTS users_access_own_backups  ON server_backups;
DROP POLICY IF EXISTS admins_access_all_backups ON server_backups;
DROP POLICY IF EXISTS backups_self_all          ON server_backups;
DROP POLICY IF EXISTS backups_admin_all         ON server_backups;
CREATE POLICY backups_self_all  ON server_backups FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = server_backups.server_id AND s.clerk_user_id = clerk_uid())
);
CREATE POLICY backups_admin_all ON server_backups FOR ALL USING (is_admin());

-- mod_installations
DROP POLICY IF EXISTS users_access_own_mods ON mod_installations;
DROP POLICY IF EXISTS mods_self_all         ON mod_installations;
CREATE POLICY mods_self_all ON mod_installations FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = mod_installations.server_id AND s.clerk_user_id = clerk_uid())
);

-- console_events
DROP POLICY IF EXISTS users_access_own_console ON console_events;
DROP POLICY IF EXISTS console_self_all         ON console_events;
CREATE POLICY console_self_all ON console_events FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = console_events.server_id AND s.clerk_user_id = clerk_uid())
);

-- server_files
DROP POLICY IF EXISTS users_access_own_files ON server_files;
DROP POLICY IF EXISTS files_self_all         ON server_files;
CREATE POLICY files_self_all ON server_files FOR ALL USING (
  EXISTS (SELECT 1 FROM servers s WHERE s.id = server_files.server_id AND s.clerk_user_id = clerk_uid())
);

-- nodes
DROP POLICY IF EXISTS anyone_read_nodes  ON nodes;
DROP POLICY IF EXISTS admins_manage_nodes ON nodes;
DROP POLICY IF EXISTS nodes_public_read  ON nodes;
DROP POLICY IF EXISTS nodes_admin_all    ON nodes;
CREATE POLICY nodes_public_read ON nodes FOR SELECT USING (TRUE);
CREATE POLICY nodes_admin_all   ON nodes FOR ALL    USING (is_admin());

-- regions
DROP POLICY IF EXISTS anyone_read_regions  ON regions;
DROP POLICY IF EXISTS admins_manage_regions ON regions;
DROP POLICY IF EXISTS regions_public_read  ON regions;
DROP POLICY IF EXISTS regions_admin_all    ON regions;
CREATE POLICY regions_public_read ON regions FOR SELECT USING (TRUE);
CREATE POLICY regions_admin_all   ON regions FOR ALL    USING (is_admin());

-- allocations
DROP POLICY IF EXISTS users_read_own_allocation  ON allocations;
DROP POLICY IF EXISTS admins_manage_allocations  ON allocations;
DROP POLICY IF EXISTS allocations_self_read      ON allocations;
DROP POLICY IF EXISTS allocations_admin_all      ON allocations;
CREATE POLICY allocations_self_read ON allocations FOR SELECT USING (
  server_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM servers s WHERE s.id = allocations.server_id AND s.clerk_user_id = clerk_uid()
  )
);
CREATE POLICY allocations_admin_all ON allocations FOR ALL USING (is_admin());

-- public_ips
DROP POLICY IF EXISTS admins_manage_public_ips ON public_ips;
DROP POLICY IF EXISTS public_ips_admin_all     ON public_ips;
CREATE POLICY public_ips_admin_all ON public_ips FOR ALL USING (is_admin());

-- billing_plans
DROP POLICY IF EXISTS billing_plans_public_read ON billing_plans;
DROP POLICY IF EXISTS billing_plans_admin_all   ON billing_plans;
DROP POLICY IF EXISTS billing_public_read       ON billing_plans;
DROP POLICY IF EXISTS billing_admin_all         ON billing_plans;
CREATE POLICY billing_public_read ON billing_plans FOR SELECT USING (is_visible = TRUE);
CREATE POLICY billing_admin_all   ON billing_plans FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 11. Free-tier limit trigger
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_server_limit()
RETURNS TRIGGER AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  current_count  INTEGER;
BEGIN
  SELECT * INTO profile_record FROM profiles WHERE clerk_user_id = NEW.clerk_user_id;
  SELECT COUNT(*) INTO current_count  FROM servers  WHERE clerk_user_id = NEW.clerk_user_id;
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

DROP TRIGGER IF EXISTS trg_check_server_limit ON servers;
CREATE TRIGGER trg_check_server_limit
  BEFORE INSERT ON servers FOR EACH ROW EXECUTE FUNCTION check_server_limit();

-- ─────────────────────────────────────────────────────────────────────
-- 12. Hibernation: touch last_active_at on wake-up
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION servers_touch_active() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('running','starting','restarting')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_active_at := NOW();
    IF OLD.status = 'hibernated' THEN NEW.hibernated_at := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS servers_touch_active_trg ON servers;
CREATE TRIGGER servers_touch_active_trg
  BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION servers_touch_active();

-- ─────────────────────────────────────────────────────────────────────
-- 13. node_stock view + pick_node_with_stock RPC
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW node_stock AS
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
FROM nodes n
LEFT JOIN servers s ON s.node_id = n.id
GROUP BY n.id;

CREATE OR REPLACE FUNCTION pick_node_with_stock(
  want_region UUID, want_ram_mb INT, want_cpu INT, want_disk_mb INT
) RETURNS UUID AS $$
DECLARE picked UUID;
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

-- ─────────────────────────────────────────────────────────────────────
-- 14. REALTIME — ADD TABLE IF NOT EXISTS isn't valid syntax; use DO blocks
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE servers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE console_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE server_backups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 15. STORAGE — buckets + policies
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('server-files',   'server-files',   FALSE),
  ('server-backups', 'server-backups', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS users_access_own_server_files_storage   ON storage.objects;
DROP POLICY IF EXISTS users_access_own_server_backups_storage ON storage.objects;

CREATE POLICY users_access_own_server_files_storage
  ON storage.objects FOR ALL USING (
    bucket_id = 'server-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM servers WHERE clerk_user_id = clerk_uid()
    )
  );

CREATE POLICY users_access_own_server_backups_storage
  ON storage.objects FOR ALL USING (
    bucket_id = 'server-backups'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM servers WHERE clerk_user_id = clerk_uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 16. SEED — default region + billing plan rows (idempotent via ON CONFLICT)
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
