CREATE TABLE public.agenciamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imovel text NOT NULL DEFAULT '',
  tipo text DEFAULT '',
  padrao text DEFAULT '',
  apto_quadra_lote text DEFAULT '',
  box text DEFAULT '',
  dormitorios text DEFAULT '',
  metragem numeric DEFAULT 0,
  ano_construcao_iptu text DEFAULT '',
  posicao text DEFAULT '',
  mobiliado text DEFAULT '',
  destaque text DEFAULT '',
  bairro text DEFAULT '',
  rua text DEFAULT '',
  valor numeric DEFAULT 0,
  fin_bancario text DEFAULT '',
  entrada text DEFAULT '',
  prazo_direto text DEFAULT '',
  condicao_pagamento text DEFAULT '',
  observacoes text DEFAULT '',
  cond_iptu text DEFAULT '',
  chaves_obra text DEFAULT '',
  proprietario text DEFAULT '',
  telefone text DEFAULT '',
  cidade text DEFAULT '',
  data_inclusao date,
  data_atualizacao date,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenciamentos TO authenticated;
GRANT ALL ON public.agenciamentos TO service_role;

ALTER TABLE public.agenciamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agenciamentos"
  ON public.agenciamentos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX agenciamentos_user_idx ON public.agenciamentos(user_id);
CREATE INDEX agenciamentos_status_idx ON public.agenciamentos(status);

CREATE TRIGGER agenciamentos_updated_at
  BEFORE UPDATE ON public.agenciamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();