-- Just create clean tables in public schema - don't try to copy anything
-- The mcloud schema structure doesn't match, so just start fresh

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  plan_tier TEXT NOT NULL DEFAULT 'free',
  max_servers INTEGER NOT NULL DEFAULT 1,
  max_ram_mb INTEGER NOT NULL DEFAULT 1024,
  max_disk_mb BIGINT NOT NULL DEFAULT 5120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  flag_emoji TEXT DEFAULT '🌐',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  fqdn TEXT NOT NULL,
  ip INET NOT NULL,
  total_ram_mb INTEGER NOT NULL DEFAULT 8192,
  total_cpu INTEGER NOT NULL DEFAULT 400,
  total_disk_mb BIGINT NOT NULL DEFAULT 102400,
  status TEXT NOT NULL DEFAULT 'unknown',
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  memory_overcommit_percent INTEGER NOT NULL DEFAULT 0,
  overallocation_percent INTEGER NOT NULL DEFAULT 100,
  last_seen_at TIMESTAMPTZ,
  running_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  ip INET NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  ip INET NOT NULL,
  port INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
  server_id UUID,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ip, port)
);

CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT 'java',
  game_version TEXT NOT NULL DEFAULT '1.21.4',
  loader TEXT NOT NULL DEFAULT 'paper',
  loader_version TEXT,
  ram_mb INTEGER NOT NULL DEFAULT 1024,
  cpu_percent INTEGER NOT NULL DEFAULT 100,
  disk_mb BIGINT NOT NULL DEFAULT 5120,
  status TEXT NOT NULL DEFAULT 'offline',
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  allocation_id UUID REFERENCES public.allocations(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  motd TEXT DEFAULT 'A Minecraft Server',
  max_players INTEGER NOT NULL DEFAULT 20,
  java_flags TEXT,
  env_vars JSONB NOT NULL DEFAULT '{}',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_started_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hibernated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.allocations ADD CONSTRAINT allocations_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.server_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'creating',
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.mod_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  modrinth_project_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  type TEXT NOT NULL DEFAULT 'mod',
  loader TEXT,
  game_version TEXT,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, modrinth_project_id)
);

CREATE TABLE IF NOT EXISTS public.console_events (
  id BIGSERIAL PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  line TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'server',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.server_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  is_directory BOOLEAN NOT NULL DEFAULT FALSE,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, path)
);

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_usd NUMERIC(10, 2),
  max_servers INT NOT NULL DEFAULT 1,
  max_ram_mb INT NOT NULL DEFAULT 1024,
  max_disk_mb INT NOT NULL DEFAULT 5120,
  max_cpu_percent INT NOT NULL DEFAULT 100,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
