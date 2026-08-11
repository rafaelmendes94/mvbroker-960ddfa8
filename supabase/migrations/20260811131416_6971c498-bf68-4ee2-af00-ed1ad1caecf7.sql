CREATE TABLE public.imovel_feeds_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  slug text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (imovel_id, slug)
);

GRANT SELECT ON public.imovel_feeds_sistema TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imovel_feeds_sistema TO authenticated;
GRANT ALL ON public.imovel_feeds_sistema TO service_role;

ALTER TABLE public.imovel_feeds_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feeds sistema leitura publica" ON public.imovel_feeds_sistema FOR SELECT USING (true);
CREATE POLICY "Autenticados marcam feeds sistema" ON public.imovel_feeds_sistema FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados desmarcam feeds sistema" ON public.imovel_feeds_sistema FOR DELETE TO authenticated USING (true);
CREATE POLICY "Autenticados atualizam feeds sistema" ON public.imovel_feeds_sistema FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_imovel_feeds_sistema_slug ON public.imovel_feeds_sistema (slug);

CREATE TRIGGER update_imovel_feeds_sistema_updated_at
BEFORE UPDATE ON public.imovel_feeds_sistema
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();