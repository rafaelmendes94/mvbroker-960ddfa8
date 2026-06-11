
ALTER TABLE public.edificios   ADD COLUMN IF NOT EXISTS valor_condominio numeric, ADD COLUMN IF NOT EXISTS valor_iptu numeric;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS valor_condominio numeric, ADD COLUMN IF NOT EXISTS valor_iptu numeric;
ALTER TABLE public.loteamentos ADD COLUMN IF NOT EXISTS valor_condominio numeric, ADD COLUMN IF NOT EXISTS valor_iptu numeric;
