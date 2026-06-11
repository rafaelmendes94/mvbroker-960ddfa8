
-- Add capacity fields to the three empreendimento types
ALTER TABLE public.edificios   ADD COLUMN IF NOT EXISTS espelho_grupos integer, ADD COLUMN IF NOT EXISTS espelho_por_grupo integer;
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS espelho_grupos integer, ADD COLUMN IF NOT EXISTS espelho_por_grupo integer;
ALTER TABLE public.loteamentos ADD COLUMN IF NOT EXISTS espelho_grupos integer, ADD COLUMN IF NOT EXISTS espelho_por_grupo integer;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.espelho_status AS ENUM ('disponivel','reservado','vendido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.espelho_tipo AS ENUM ('edificio','condominio','loteamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.espelho_unidades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empreendimento_tipo public.espelho_tipo NOT NULL,
  empreendimento_id uuid NOT NULL,
  grupo integer NOT NULL,
  numero text NOT NULL,
  status public.espelho_status NOT NULL DEFAULT 'disponivel',
  valor numeric,
  area numeric,
  tipologia text,
  vagas integer,
  suites integer,
  nascente boolean DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empreendimento_tipo, empreendimento_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_espelho_emp ON public.espelho_unidades (empreendimento_tipo, empreendimento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.espelho_unidades TO authenticated;
GRANT ALL ON public.espelho_unidades TO service_role;

ALTER TABLE public.espelho_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Espelho: leitura autenticada"
  ON public.espelho_unidades FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Espelho: insert admin"
  ON public.espelho_unidades FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'));

CREATE POLICY "Espelho: update admin"
  ON public.espelho_unidades FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'));

CREATE POLICY "Espelho: delete admin"
  ON public.espelho_unidades FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'));

CREATE TRIGGER trg_espelho_updated_at
  BEFORE UPDATE ON public.espelho_unidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
