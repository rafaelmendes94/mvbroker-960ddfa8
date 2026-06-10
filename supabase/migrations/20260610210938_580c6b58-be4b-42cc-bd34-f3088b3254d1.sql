CREATE TABLE IF NOT EXISTS public.buscas_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  filtros_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buscas_salvas TO authenticated;
GRANT ALL ON public.buscas_salvas TO service_role;
ALTER TABLE public.buscas_salvas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buscas: dono" ON public.buscas_salvas FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_buscas_usuario ON public.buscas_salvas(usuario_id);

CREATE TABLE IF NOT EXISTS public.imoveis_favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, imovel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis_favoritos TO authenticated;
GRANT ALL ON public.imoveis_favoritos TO service_role;
ALTER TABLE public.imoveis_favoritos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Favoritos: dono" ON public.imoveis_favoritos FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON public.imoveis_favoritos(usuario_id);