-- Add Clerk's internal plan ID to billing_plans so the checkout drawer works.
-- Clerk uses its own opaque plan ID (e.g. cplan_xxx), not our plan_key slug.
ALTER TABLE mcloud.billing_plans
  ADD COLUMN IF NOT EXISTS clerk_plan_id TEXT;

COMMENT ON COLUMN mcloud.billing_plans.clerk_plan_id IS
  'The opaque plan ID assigned by Clerk Billing (e.g. cplan_2abc…). Required for __internal_openCheckout.';
