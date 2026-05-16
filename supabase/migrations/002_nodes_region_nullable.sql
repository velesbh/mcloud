-- Allow nodes to register without a region (admin assigns it later via the UI)
ALTER TABLE public.nodes ALTER COLUMN region_id DROP NOT NULL;
