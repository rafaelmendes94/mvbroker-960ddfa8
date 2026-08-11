ALTER TABLE public.solicitacoes_cadastro
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'corretor',
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text;

ALTER TABLE public.solicitacoes_cadastro
  ADD CONSTRAINT solicitacoes_cadastro_tipo_check CHECK (tipo IN ('corretor','imobiliaria'));