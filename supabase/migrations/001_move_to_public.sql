-- Move all MCloud tables from mcloud schema to public schema
-- This is a pragmatic workaround for Supabase projects that don't expose custom schemas

-- Drop all RLS policies first
DROP POLICY IF EXISTS profiles_self_read       ON mcloud.profiles;
DROP POLICY IF EXISTS profiles_admin_read_all  ON mcloud.profiles;
DROP POLICY IF EXISTS profiles_self_update     ON mcloud.profiles;
DROP POLICY IF EXISTS profiles_service_insert  ON mcloud.profiles;
DROP POLICY IF EXISTS servers_self_read        ON mcloud.servers;
DROP POLICY IF EXISTS servers_admin_read_all   ON mcloud.servers;
DROP POLICY IF EXISTS servers_self_insert      ON mcloud.servers;
DROP POLICY IF EXISTS servers_self_update      ON mcloud.servers;
DROP POLICY IF EXISTS servers_admin_update     ON mcloud.servers;
DROP POLICY IF EXISTS servers_self_delete      ON mcloud.servers;
DROP POLICY IF EXISTS backups_self_all         ON mcloud.server_backups;
DROP POLICY IF EXISTS backups_admin_all        ON mcloud.server_backups;
DROP POLICY IF EXISTS mods_self_all            ON mcloud.mod_installations;
DROP POLICY IF EXISTS console_self_all         ON mcloud.console_events;
DROP POLICY IF EXISTS files_self_all           ON mcloud.server_files;
DROP POLICY IF EXISTS nodes_public_read        ON mcloud.nodes;
DROP POLICY IF EXISTS nodes_admin_all          ON mcloud.nodes;
DROP POLICY IF EXISTS regions_public_read      ON mcloud.regions;
DROP POLICY IF EXISTS regions_admin_all        ON mcloud.regions;
DROP POLICY IF EXISTS allocations_self_read    ON mcloud.allocations;
DROP POLICY IF EXISTS allocations_admin_all    ON mcloud.allocations;
DROP POLICY IF EXISTS public_ips_admin_all     ON mcloud.public_ips;
DROP POLICY IF EXISTS billing_public_read      ON mcloud.billing_plans;
DROP POLICY IF EXISTS billing_admin_all        ON mcloud.billing_plans;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_regions_updated_at        ON mcloud.regions;
DROP TRIGGER IF EXISTS trg_nodes_updated_at          ON mcloud.nodes;
DROP TRIGGER IF EXISTS trg_profiles_updated_at       ON mcloud.profiles;
DROP TRIGGER IF EXISTS trg_servers_updated_at        ON mcloud.servers;
DROP TRIGGER IF EXISTS trg_server_files_updated_at   ON mcloud.server_files;
DROP TRIGGER IF EXISTS trg_billing_plans_updated_at  ON mcloud.billing_plans;
DROP TRIGGER IF EXISTS trg_check_server_limit        ON mcloud.servers;
DROP TRIGGER IF EXISTS servers_touch_active_trg      ON mcloud.servers;

-- Disable RLS on all tables
ALTER TABLE mcloud.profiles          DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.servers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.server_backups    DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.mod_installations DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.console_events    DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.server_files      DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.nodes             DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.regions           DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.allocations       DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.public_ips        DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcloud.billing_plans     DISABLE ROW LEVEL SECURITY;

-- Rename tables to public schema by recreating them
CREATE TABLE IF NOT EXISTS public.profiles AS SELECT * FROM mcloud.profiles;
CREATE TABLE IF NOT EXISTS public.regions AS SELECT * FROM mcloud.regions;
CREATE TABLE IF NOT EXISTS public.nodes AS SELECT * FROM mcloud.nodes;
CREATE TABLE IF NOT EXISTS public.public_ips AS SELECT * FROM mcloud.public_ips;
CREATE TABLE IF NOT EXISTS public.allocations AS SELECT * FROM mcloud.allocations;
CREATE TABLE IF NOT EXISTS public.servers AS SELECT * FROM mcloud.servers;
CREATE TABLE IF NOT EXISTS public.server_backups AS SELECT * FROM mcloud.server_backups;
CREATE TABLE IF NOT EXISTS public.mod_installations AS SELECT * FROM mcloud.mod_installations;
CREATE TABLE IF NOT EXISTS public.console_events AS SELECT * FROM mcloud.console_events;
CREATE TABLE IF NOT EXISTS public.server_files AS SELECT * FROM mcloud.server_files;
CREATE TABLE IF NOT EXISTS public.billing_plans AS SELECT * FROM mcloud.billing_plans;

-- Drop old tables
DROP TABLE IF EXISTS mcloud.allocations CASCADE;
DROP TABLE IF EXISTS mcloud.servers CASCADE;
DROP TABLE IF EXISTS mcloud.server_backups CASCADE;
DROP TABLE IF EXISTS mcloud.mod_installations CASCADE;
DROP TABLE IF EXISTS mcloud.console_events CASCADE;
DROP TABLE IF EXISTS mcloud.server_files CASCADE;
DROP TABLE IF EXISTS mcloud.billing_plans CASCADE;
DROP TABLE IF EXISTS mcloud.nodes CASCADE;
DROP TABLE IF EXISTS mcloud.public_ips CASCADE;
DROP TABLE IF EXISTS mcloud.profiles CASCADE;
DROP TABLE IF EXISTS mcloud.regions CASCADE;

-- Recreate helper functions in public schema if they don't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.clerk_uid() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE clerk_user_id = public.clerk_uid()
      AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_server_limit()
RETURNS TRIGGER AS $$
DECLARE
  profile_record public.profiles%ROWTYPE;
  current_count  INTEGER;
BEGIN
  SELECT * INTO profile_record FROM public.profiles WHERE clerk_user_id = NEW.clerk_user_id;
  SELECT COUNT(*) INTO current_count  FROM public.servers  WHERE clerk_user_id = NEW.clerk_user_id;
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

CREATE OR REPLACE FUNCTION public.servers_touch_active() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('running','starting','restarting')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_active_at := NOW();
    IF OLD.status = 'hibernated' THEN NEW.hibernated_at := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers on public tables
CREATE TRIGGER trg_regions_updated_at        BEFORE UPDATE ON public.regions       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_nodes_updated_at          BEFORE UPDATE ON public.nodes         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated_at       BEFORE UPDATE ON public.profiles      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_servers_updated_at        BEFORE UPDATE ON public.servers       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_server_files_updated_at   BEFORE UPDATE ON public.server_files  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_billing_plans_updated_at  BEFORE UPDATE ON public.billing_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recreate check_server_limit trigger
CREATE TRIGGER trg_check_server_limit
  BEFORE INSERT ON public.servers FOR EACH ROW EXECUTE FUNCTION public.check_server_limit();

-- Recreate servers_touch_active trigger
CREATE TRIGGER servers_touch_active_trg
  BEFORE UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.servers_touch_active();

-- Enable RLS and recreate policies
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_backups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mod_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.console_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_ips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans     ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_read      ON public.profiles FOR SELECT USING (clerk_user_id = public.clerk_uid());
CREATE POLICY profiles_admin_read_all ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY profiles_self_update    ON public.profiles FOR UPDATE USING (clerk_user_id = public.clerk_uid());
CREATE POLICY profiles_service_insert ON public.profiles FOR INSERT WITH CHECK (TRUE);

CREATE POLICY servers_self_read      ON public.servers FOR SELECT USING (clerk_user_id = public.clerk_uid());
CREATE POLICY servers_admin_read_all ON public.servers FOR SELECT USING (public.is_admin());
CREATE POLICY servers_self_insert    ON public.servers FOR INSERT WITH CHECK (clerk_user_id = public.clerk_uid());
CREATE POLICY servers_self_update    ON public.servers FOR UPDATE USING (clerk_user_id = public.clerk_uid());
CREATE POLICY servers_admin_update   ON public.servers FOR UPDATE USING (public.is_admin());
CREATE POLICY servers_self_delete    ON public.servers FOR DELETE USING (clerk_user_id = public.clerk_uid());

CREATE POLICY backups_self_all  ON public.server_backups FOR ALL USING (
  EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_backups.server_id AND s.clerk_user_id = public.clerk_uid())
);
CREATE POLICY backups_admin_all ON public.server_backups FOR ALL USING (public.is_admin());

CREATE POLICY mods_self_all ON public.mod_installations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.servers s WHERE s.id = mod_installations.server_id AND s.clerk_user_id = public.clerk_uid())
);

CREATE POLICY console_self_all ON public.console_events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.servers s WHERE s.id = console_events.server_id AND s.clerk_user_id = public.clerk_uid())
);

CREATE POLICY files_self_all ON public.server_files FOR ALL USING (
  EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_files.server_id AND s.clerk_user_id = public.clerk_uid())
);

CREATE POLICY nodes_public_read ON public.nodes FOR SELECT USING (TRUE);
CREATE POLICY nodes_admin_all   ON public.nodes FOR ALL    USING (public.is_admin());

CREATE POLICY regions_public_read ON public.regions FOR SELECT USING (TRUE);
CREATE POLICY regions_admin_all   ON public.regions FOR ALL    USING (public.is_admin());

CREATE POLICY allocations_self_read ON public.allocations FOR SELECT USING (
  server_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.servers s WHERE s.id = allocations.server_id AND s.clerk_user_id = public.clerk_uid()
  )
);
CREATE POLICY allocations_admin_all ON public.allocations FOR ALL USING (public.is_admin());

CREATE POLICY public_ips_admin_all ON public.public_ips FOR ALL USING (public.is_admin());

CREATE POLICY billing_public_read ON public.billing_plans FOR SELECT USING (is_visible = TRUE);
CREATE POLICY billing_admin_all   ON public.billing_plans FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Drop mcloud schema if empty
DROP SCHEMA IF EXISTS mcloud CASCADE;
