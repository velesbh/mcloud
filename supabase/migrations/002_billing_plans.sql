-- Billing plans: maps Clerk plan keys to MCloud resource quotas.
-- Admin manages this table. Only rows with is_visible=true appear on the user upgrade page.

CREATE TABLE IF NOT EXISTS billing_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  monthly_price_usd NUMERIC(10, 2),
  max_servers   INT  NOT NULL DEFAULT 1,
  max_ram_mb    INT  NOT NULL DEFAULT 1024,
  max_disk_mb   INT  NOT NULL DEFAULT 5120,
  max_cpu_percent INT NOT NULL DEFAULT 100,
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order    INT  NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_visible_sort
  ON billing_plans (is_visible, sort_order);

DROP TRIGGER IF EXISTS set_billing_plans_updated_at ON billing_plans;
CREATE TRIGGER set_billing_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read visible plans
CREATE POLICY billing_plans_public_read
  ON billing_plans FOR SELECT
  USING (is_visible = true);

-- Admins can do everything
CREATE POLICY billing_plans_admin_all
  ON billing_plans FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
