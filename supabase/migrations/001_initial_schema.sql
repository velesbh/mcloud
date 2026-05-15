-- MCloud Initial Schema
-- Run this in your Supabase SQL editor or via supabase db push

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE server_status AS ENUM (
  'creating', 'offline', 'starting', 'running',
  'stopping', 'restarting', 'error', 'suspended'
);

CREATE TYPE node_status AS ENUM (
  'online', 'offline', 'maintenance', 'unknown'
);

CREATE TYPE server_loader AS ENUM (
  'vanilla', 'paper', 'spigot', 'fabric',
  'forge', 'neoforge', 'quilt', 'bedrock'
);

CREATE TYPE backup_status AS ENUM (
  'creating', 'available', 'restoring', 'failed'
);

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE game_edition AS ENUM ('java', 'bedrock');

-- ============================================================
-- REGIONS
-- ============================================================
CREATE TABLE regions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  flag_emoji  TEXT DEFAULT '🌐',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NODES
-- ============================================================
CREATE TABLE nodes (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id                 UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  name                      TEXT NOT NULL,
  fqdn                      TEXT NOT NULL,
  ip                        INET NOT NULL,
  total_ram_mb              INTEGER NOT NULL DEFAULT 8192,
  total_cpu                 INTEGER NOT NULL DEFAULT 400,
  total_disk_mb             BIGINT NOT NULL DEFAULT 102400,
  status                    node_status NOT NULL DEFAULT 'unknown',
  is_public                 BOOLEAN NOT NULL DEFAULT TRUE,
  memory_overcommit_percent INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PUBLIC IPs
-- ============================================================
CREATE TABLE public_ips (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id    UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ip         INET NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ALLOCATIONS
-- ============================================================
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

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          user_role NOT NULL DEFAULT 'user',
  max_servers   INTEGER NOT NULL DEFAULT 1,
  max_ram_mb    INTEGER NOT NULL DEFAULT 1024,
  max_disk_mb   BIGINT NOT NULL DEFAULT 5120,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SERVERS
-- ============================================================
CREATE TABLE servers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clerk_user_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  edition         game_edition NOT NULL DEFAULT 'java',
  game_version    TEXT NOT NULL DEFAULT '1.21.4',
  loader          server_loader NOT NULL DEFAULT 'paper',
  loader_version  TEXT,
  ram_mb          INTEGER NOT NULL DEFAULT 1024,
  cpu_percent     INTEGER NOT NULL DEFAULT 100,
  disk_mb         BIGINT NOT NULL DEFAULT 5120,
  status          server_status NOT NULL DEFAULT 'offline',
  node_id         UUID REFERENCES nodes(id) ON DELETE SET NULL,
  allocation_id   UUID REFERENCES allocations(id) ON DELETE SET NULL,
  region_id       UUID REFERENCES regions(id) ON DELETE SET NULL,
  motd            TEXT DEFAULT 'A Minecraft Server',
  max_players     INTEGER NOT NULL DEFAULT 20,
  java_flags      TEXT,
  env_vars        JSONB NOT NULL DEFAULT '{}',
  installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_started_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE allocations
  ADD CONSTRAINT allocations_server_id_fkey
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL;

-- ============================================================
-- SERVER BACKUPS
-- ============================================================
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

-- ============================================================
-- MOD INSTALLATIONS
-- ============================================================
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

-- ============================================================
-- CONSOLE EVENTS
-- ============================================================
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

-- ============================================================
-- SERVER FILES
-- ============================================================
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

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_servers_clerk_user_id ON servers(clerk_user_id);
CREATE INDEX idx_servers_node_id ON servers(node_id);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_allocations_node_id ON allocations(node_id);
CREATE INDEX idx_allocations_server_id ON allocations(server_id);
CREATE INDEX idx_server_backups_server_id ON server_backups(server_id);
CREATE INDEX idx_mod_installations_server_id ON mod_installations(server_id);
CREATE INDEX idx_console_events_server_id ON console_events(server_id, created_at DESC);
CREATE INDEX idx_server_files_server_id_path ON server_files(server_id, path);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_regions_updated_at
  BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_nodes_updated_at
  BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_servers_updated_at
  BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_server_files_updated_at
  BEFORE UPDATE ON server_files FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS — ENABLE
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE console_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_ips ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION auth.clerk_user_id() RETURNS TEXT AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'sub');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE clerk_user_id = auth.clerk_user_id()
      AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- RLS — PROFILES
-- ============================================================
CREATE POLICY "users_read_own_profile"
  ON profiles FOR SELECT
  USING (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "admins_read_all_profiles"
  ON profiles FOR SELECT
  USING (auth.is_admin());

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "service_role_insert_profiles"
  ON profiles FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- RLS — SERVERS
-- ============================================================
CREATE POLICY "users_read_own_servers"
  ON servers FOR SELECT
  USING (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "admins_read_all_servers"
  ON servers FOR SELECT
  USING (auth.is_admin());

CREATE POLICY "users_insert_own_servers"
  ON servers FOR INSERT
  WITH CHECK (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "users_update_own_servers"
  ON servers FOR UPDATE
  USING (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "admins_update_any_server"
  ON servers FOR UPDATE
  USING (auth.is_admin());

CREATE POLICY "users_delete_own_servers"
  ON servers FOR DELETE
  USING (clerk_user_id = auth.clerk_user_id());

-- ============================================================
-- RLS — SERVER_BACKUPS
-- ============================================================
CREATE POLICY "users_access_own_backups"
  ON server_backups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_backups.server_id
        AND servers.clerk_user_id = auth.clerk_user_id()
    )
  );

CREATE POLICY "admins_access_all_backups"
  ON server_backups FOR ALL
  USING (auth.is_admin());

-- ============================================================
-- RLS — MOD_INSTALLATIONS
-- ============================================================
CREATE POLICY "users_access_own_mods"
  ON mod_installations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = mod_installations.server_id
        AND servers.clerk_user_id = auth.clerk_user_id()
    )
  );

-- ============================================================
-- RLS — CONSOLE_EVENTS
-- ============================================================
CREATE POLICY "users_access_own_console"
  ON console_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = console_events.server_id
        AND servers.clerk_user_id = auth.clerk_user_id()
    )
  );

-- ============================================================
-- RLS — SERVER_FILES
-- ============================================================
CREATE POLICY "users_access_own_files"
  ON server_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_files.server_id
        AND servers.clerk_user_id = auth.clerk_user_id()
    )
  );

-- ============================================================
-- RLS — NODES
-- ============================================================
CREATE POLICY "anyone_read_nodes"
  ON nodes FOR SELECT
  USING (TRUE);

CREATE POLICY "admins_manage_nodes"
  ON nodes FOR ALL
  USING (auth.is_admin());

-- ============================================================
-- RLS — REGIONS
-- ============================================================
CREATE POLICY "anyone_read_regions"
  ON regions FOR SELECT
  USING (TRUE);

CREATE POLICY "admins_manage_regions"
  ON regions FOR ALL
  USING (auth.is_admin());

-- ============================================================
-- RLS — ALLOCATIONS
-- ============================================================
CREATE POLICY "users_read_own_allocation"
  ON allocations FOR SELECT
  USING (
    server_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = allocations.server_id
        AND servers.clerk_user_id = auth.clerk_user_id()
    )
  );

CREATE POLICY "admins_manage_allocations"
  ON allocations FOR ALL
  USING (auth.is_admin());

-- ============================================================
-- RLS — PUBLIC_IPS
-- ============================================================
CREATE POLICY "admins_manage_public_ips"
  ON public_ips FOR ALL
  USING (auth.is_admin());

-- ============================================================
-- FREE TIER ENFORCEMENT TRIGGER
-- ============================================================
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
    RAISE EXCEPTION 'RAM_LIMIT_EXCEEDED: max % MB RAM allowed', profile_record.max_ram_mb;
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

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE servers;
ALTER PUBLICATION supabase_realtime ADD TABLE console_events;
ALTER PUBLICATION supabase_realtime ADD TABLE server_backups;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('server-files', 'server-files', FALSE),
  ('server-backups', 'server-backups', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users_access_own_server_files_storage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'server-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM servers WHERE clerk_user_id = auth.clerk_user_id()
    )
  );

CREATE POLICY "users_access_own_server_backups_storage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'server-backups' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM servers WHERE clerk_user_id = auth.clerk_user_id()
    )
  );

-- ============================================================
-- SEED: Default region
-- ============================================================
INSERT INTO regions (name, slug, description, flag_emoji)
VALUES ('US East', 'us-east', 'United States — East Coast', '🇺🇸')
ON CONFLICT (slug) DO NOTHING;
