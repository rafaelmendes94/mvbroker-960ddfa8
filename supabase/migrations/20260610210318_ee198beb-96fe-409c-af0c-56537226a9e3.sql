CREATE TABLE IF NOT EXISTS public.exportacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, imovel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exportacao_itens TO authenticated;
GRANT ALL ON public.exportacao_itens TO service_role;
ALTER TABLE public.exportacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exportacao: usuario gerencia seus itens"
  ON public.exportacao_itens FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_exportacao_itens_usuario ON public.exportacao_itens(usuario_id);