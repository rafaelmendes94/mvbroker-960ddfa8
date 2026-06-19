ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS gateway_id text;
CREATE INDEX IF NOT EXISTS pagamentos_gateway_id_idx ON public.pagamentos(gateway_id) WHERE gateway_id IS NOT NULL;