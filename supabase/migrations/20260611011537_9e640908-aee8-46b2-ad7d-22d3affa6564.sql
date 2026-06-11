-- Criar tabela loteamentos (espelha condominios) e vínculo em imoveis
CREATE TABLE IF NOT EXISTS public.loteamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  latitude numeric,
  longitude numeric,
  infraestrutura jsonb DEFAULT '[]'::jsonb,
  area_total_m2 numeric,
  total_lotes integer,
  lotes_disponiveis integer,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loteamentos TO authenticated;
GRANT ALL ON public.loteamentos TO service_role;

ALTER TABLE public.loteamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loteamentos visíveis a todos autenticados"
  ON public.loteamentos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Loteamentos gerenciados por super_admin e secretaria"
  ON public.loteamentos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

CREATE TRIGGER update_loteamentos_updated_at
  BEFORE UPDATE ON public.loteamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar vínculo opcional em imoveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS loteamento_id uuid REFERENCES public.loteamentos(id) ON DELETE SET NULL;
