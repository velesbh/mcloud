-- Ultra-simple: just insert data column-by-column to avoid structure mismatch

INSERT INTO public.profiles (id, clerk_user_id, email, display_name, avatar_url, role, plan_tier, max_servers, max_ram_mb, max_disk_mb, created_at, updated_at)
SELECT id, clerk_user_id, email, display_name, avatar_url, role, plan_tier, max_servers, max_ram_mb, max_disk_mb, created_at, updated_at FROM mcloud.profiles
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.regions (id, name, slug, description, flag_emoji, created_at, updated_at)
SELECT id, name, slug, description, flag_emoji, created_at, updated_at FROM mcloud.regions
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nodes (id, region_id, name, fqdn, ip, total_ram_mb, total_cpu, total_disk_mb, status, is_public, memory_overcommit_percent, overallocation_percent, last_seen_at, running_count, created_at, updated_at)
SELECT id, region_id, name, fqdn, ip, total_ram_mb, total_cpu, total_disk_mb, status, is_public, memory_overcommit_percent, overallocation_percent, last_seen_at, running_count, created_at, updated_at FROM mcloud.nodes
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.public_ips (id, node_id, ip, is_active, created_at)
SELECT id, node_id, ip, is_active, created_at FROM mcloud.public_ips
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.allocations (id, node_id, ip, port, server_id, assigned_at, created_at)
SELECT id, node_id, ip, port, server_id, assigned_at, created_at FROM mcloud.allocations
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.servers (id, user_id, clerk_user_id, name, edition, game_version, loader, loader_version, ram_mb, cpu_percent, disk_mb, status, node_id, allocation_id, region_id, motd, max_players, java_flags, env_vars, installed_at, last_started_at, last_active_at, hibernated_at, created_at, updated_at)
SELECT id, user_id, clerk_user_id, name, edition, game_version, loader, loader_version, ram_mb, cpu_percent, disk_mb, status, node_id, allocation_id, region_id, motd, max_players, java_flags, env_vars, installed_at, last_started_at, last_active_at, hibernated_at, created_at, updated_at FROM mcloud.servers
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.server_backups (id, server_id, name, size_bytes, status, storage_path, created_at, completed_at)
SELECT id, server_id, name, size_bytes, status, storage_path, created_at, completed_at FROM mcloud.server_backups
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mod_installations (id, server_id, modrinth_project_id, version_id, name, icon_url, type, loader, game_version, installed_at)
SELECT id, server_id, modrinth_project_id, version_id, name, icon_url, type, loader, game_version, installed_at FROM mcloud.mod_installations
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.console_events (id, server_id, line, source, created_at)
SELECT id, server_id, line, source, created_at FROM mcloud.console_events
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.server_files (id, server_id, path, name, is_directory, size_bytes, mime_type, storage_path, created_at, updated_at)
SELECT id, server_id, path, name, is_directory, size_bytes, mime_type, storage_path, created_at, updated_at FROM mcloud.server_files
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.billing_plans (id, plan_key, name, description, monthly_price_usd, max_servers, max_ram_mb, max_disk_mb, max_cpu_percent, features, sort_order, is_visible, is_highlighted, created_at, updated_at)
SELECT id, plan_key, name, description, monthly_price_usd, max_servers, max_ram_mb, max_disk_mb, max_cpu_percent, features, sort_order, is_visible, is_highlighted, created_at, updated_at FROM mcloud.billing_plans
ON CONFLICT (id) DO NOTHING;
