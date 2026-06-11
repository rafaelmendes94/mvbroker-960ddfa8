ALTER TABLE public.loteamentos
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;