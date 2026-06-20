ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS data_venda timestamptz,
  ADD COLUMN IF NOT EXISTS plataforma_venda text;
CREATE INDEX IF NOT EXISTS idx_imoveis_data_venda ON public.imoveis(data_venda);