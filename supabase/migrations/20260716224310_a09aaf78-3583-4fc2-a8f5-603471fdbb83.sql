
ALTER TABLE public.edificios      ADD COLUMN IF NOT EXISTS mapa_pdf_path text, ADD COLUMN IF NOT EXISTS material_completo_url text;
ALTER TABLE public.condominios    ADD COLUMN IF NOT EXISTS mapa_pdf_path text, ADD COLUMN IF NOT EXISTS material_completo_url text;
ALTER TABLE public.empreendimentos ADD COLUMN IF NOT EXISTS mapa_pdf_path text, ADD COLUMN IF NOT EXISTS material_completo_url text;
ALTER TABLE public.loteamentos    ADD COLUMN IF NOT EXISTS mapa_pdf_path text, ADD COLUMN IF NOT EXISTS material_completo_url text;
