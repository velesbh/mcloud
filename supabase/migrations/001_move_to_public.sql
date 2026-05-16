-- Simple migration to move tables from mcloud to public schema
-- First, just create empty tables in public with the same structure

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles AS TABLE mcloud.profiles WITH NO DATA;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create regions table
CREATE TABLE IF NOT EXISTS public.regions AS TABLE mcloud.regions WITH NO DATA;
ALTER TABLE public.regions ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create nodes table
CREATE TABLE IF NOT EXISTS public.nodes AS TABLE mcloud.nodes WITH NO DATA;
ALTER TABLE public.nodes ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create public_ips table
CREATE TABLE IF NOT EXISTS public.public_ips AS TABLE mcloud.public_ips WITH NO DATA;
ALTER TABLE public.public_ips ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create allocations table
CREATE TABLE IF NOT EXISTS public.allocations AS TABLE mcloud.allocations WITH NO DATA;
ALTER TABLE public.allocations ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create servers table
CREATE TABLE IF NOT EXISTS public.servers AS TABLE mcloud.servers WITH NO DATA;
ALTER TABLE public.servers ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create server_backups table
CREATE TABLE IF NOT EXISTS public.server_backups AS TABLE mcloud.server_backups WITH NO DATA;
ALTER TABLE public.server_backups ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create mod_installations table
CREATE TABLE IF NOT EXISTS public.mod_installations AS TABLE mcloud.mod_installations WITH NO DATA;
ALTER TABLE public.mod_installations ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create console_events table
CREATE TABLE IF NOT EXISTS public.console_events AS TABLE mcloud.console_events WITH NO DATA;

-- Create server_files table
CREATE TABLE IF NOT EXISTS public.server_files AS TABLE mcloud.server_files WITH NO DATA;
ALTER TABLE public.server_files ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Create billing_plans table
CREATE TABLE IF NOT EXISTS public.billing_plans AS TABLE mcloud.billing_plans WITH NO DATA;
ALTER TABLE public.billing_plans ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Now copy all data
INSERT INTO public.profiles SELECT * FROM mcloud.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.regions SELECT * FROM mcloud.regions ON CONFLICT DO NOTHING;
INSERT INTO public.nodes SELECT * FROM mcloud.nodes ON CONFLICT DO NOTHING;
INSERT INTO public.public_ips SELECT * FROM mcloud.public_ips ON CONFLICT DO NOTHING;
INSERT INTO public.allocations SELECT * FROM mcloud.allocations ON CONFLICT DO NOTHING;
INSERT INTO public.servers SELECT * FROM mcloud.servers ON CONFLICT DO NOTHING;
INSERT INTO public.server_backups SELECT * FROM mcloud.server_backups ON CONFLICT DO NOTHING;
INSERT INTO public.mod_installations SELECT * FROM mcloud.mod_installations ON CONFLICT DO NOTHING;
INSERT INTO public.console_events SELECT * FROM mcloud.console_events ON CONFLICT DO NOTHING;
INSERT INTO public.server_files SELECT * FROM mcloud.server_files ON CONFLICT DO NOTHING;
INSERT INTO public.billing_plans SELECT * FROM mcloud.billing_plans ON CONFLICT DO NOTHING;
