-- 006: server-level modpack URL so the daemon can install on first start
ALTER TABLE mcloud.servers
  ADD COLUMN IF NOT EXISTS modpack_url    TEXT,
  ADD COLUMN IF NOT EXISTS modpack_name   TEXT,
  ADD COLUMN IF NOT EXISTS modpack_installed BOOLEAN NOT NULL DEFAULT FALSE;
