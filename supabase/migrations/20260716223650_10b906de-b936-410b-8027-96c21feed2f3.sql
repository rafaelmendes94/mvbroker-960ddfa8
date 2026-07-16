-- Add PDF de implantação nas 4 tabelas de estruturas
ALTER TABLE public.edificios      ADD COLUMN IF NOT EXISTS implantacao_pdf_path text;
ALTER TABLE public.condominios    ADD COLUMN IF NOT EXISTS implantacao_pdf_path text;
ALTER TABLE public.empreendimentos ADD COLUMN IF NOT EXISTS implantacao_pdf_path text;
ALTER TABLE public.loteamentos    ADD COLUMN IF NOT EXISTS implantacao_pdf_path text;