
-- Categorias
CREATE TABLE public.banco_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  sistema boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banco_categorias TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banco_categorias TO authenticated;
GRANT ALL ON public.banco_categorias TO service_role;
ALTER TABLE public.banco_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banco_cat_select" ON public.banco_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "banco_cat_insert_admin" ON public.banco_categorias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "banco_cat_update_admin" ON public.banco_categorias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "banco_cat_delete_admin" ON public.banco_categorias FOR DELETE TO authenticated
  USING ((public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')) AND sistema = false);

-- Galerias
CREATE TABLE public.banco_galerias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria_id uuid REFERENCES public.banco_categorias(id) ON DELETE SET NULL,
  drive_url text,
  capa_arquivo_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX banco_galerias_categoria_idx ON public.banco_galerias(categoria_id);
CREATE INDEX banco_galerias_nome_idx ON public.banco_galerias USING gin (to_tsvector('simple', nome));
GRANT SELECT ON public.banco_galerias TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banco_galerias TO authenticated;
GRANT ALL ON public.banco_galerias TO service_role;
ALTER TABLE public.banco_galerias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banco_gal_select" ON public.banco_galerias FOR SELECT TO authenticated USING (true);
CREATE POLICY "banco_gal_insert_admin" ON public.banco_galerias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "banco_gal_update_admin" ON public.banco_galerias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "banco_gal_delete_admin" ON public.banco_galerias FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE TRIGGER banco_galerias_updated_at BEFORE UPDATE ON public.banco_galerias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Arquivos da galeria (file metadata + storage path)
CREATE TABLE public.banco_galeria_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  galeria_id uuid NOT NULL REFERENCES public.banco_galerias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'banco-imagens',
  mime_type text,
  tamanho bigint,
  ordem int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX banco_galeria_arquivos_gal_idx ON public.banco_galeria_arquivos(galeria_id, ordem);
GRANT SELECT ON public.banco_galeria_arquivos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banco_galeria_arquivos TO authenticated;
GRANT ALL ON public.banco_galeria_arquivos TO service_role;
ALTER TABLE public.banco_galeria_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banco_arq_select" ON public.banco_galeria_arquivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "banco_arq_insert_admin" ON public.banco_galeria_arquivos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "banco_arq_update_admin" ON public.banco_galeria_arquivos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "banco_arq_delete_admin" ON public.banco_galeria_arquivos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

-- Seed categorias
INSERT INTO public.banco_categorias (slug, nome, ordem, sistema) VALUES
  ('cidade', 'Cidade', 1, true),
  ('pracas', 'Praças', 2, true),
  ('praia', 'Praia', 3, true),
  ('pontos-turisticos', 'Pontos Turísticos', 4, true),
  ('lagoas', 'Lagoas', 5, true),
  ('parque', 'Parque', 6, true);
