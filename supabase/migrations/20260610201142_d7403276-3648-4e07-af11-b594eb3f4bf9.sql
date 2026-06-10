
-- Add new role values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'imobiliaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'corretor_imobiliaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'corretor_autonomo';
