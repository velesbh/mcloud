CREATE TABLE IF NOT EXISTS mcloud.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO mcloud.admin_settings (key, value) VALUES
  ('premium_allocation_percent', '0')
ON CONFLICT (key) DO NOTHING;
