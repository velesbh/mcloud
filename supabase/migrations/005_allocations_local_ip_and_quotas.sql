-- 005_allocations_local_ip_and_quotas.sql
-- Adds local_ip (bind address) to allocations and per-profile max_allocations quota.

ALTER TABLE mcloud.allocations
  ADD COLUMN IF NOT EXISTS local_ip INET NOT NULL DEFAULT '0.0.0.0';

ALTER TABLE mcloud.profiles
  ADD COLUMN IF NOT EXISTS max_allocations INTEGER NOT NULL DEFAULT 1;

-- max_cpu_percent may not exist yet on older installs
ALTER TABLE mcloud.profiles
  ADD COLUMN IF NOT EXISTS max_cpu_percent INTEGER NOT NULL DEFAULT 100;

-- Grant existing admins higher quotas
UPDATE mcloud.profiles
SET
  max_allocations = 10,
  max_servers     = GREATEST(max_servers, 10),
  max_ram_mb      = GREATEST(max_ram_mb, 16384),
  max_disk_mb     = GREATEST(max_disk_mb, 102400),
  max_cpu_percent = GREATEST(max_cpu_percent, 400)
WHERE role = 'admin';
