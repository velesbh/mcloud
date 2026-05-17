CREATE TABLE IF NOT EXISTS mcloud.invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 12),
  created_by TEXT NOT NULL,  -- clerk_user_id of admin
  max_uses INT NOT NULL DEFAULT 1,
  uses INT NOT NULL DEFAULT 0,
  max_servers INT NOT NULL DEFAULT 1,
  max_ram_mb INT NOT NULL DEFAULT 1024,
  max_disk_mb INT NOT NULL DEFAULT 5120,
  max_cpu_percent INT NOT NULL DEFAULT 100,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
