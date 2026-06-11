
CREATE TABLE public.tabela_atual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tabela_atual TO authenticated;
GRANT ALL ON public.tabela_atual TO service_role;

ALTER TABLE public.tabela_atual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler tabela atual"
  ON public.tabela_atual FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/secretaria gerenciam tabela atual"
  ON public.tabela_atual FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

-- Storage policies para bucket 'tabela'
CREATE POLICY "Admin/secretaria upload tabela"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tabela'
    AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  );

CREATE POLICY "Admin/secretaria update tabela"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tabela'
    AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  );

CREATE POLICY "Admin/secretaria delete tabela"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tabela'
    AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  );

CREATE POLICY "Admin/secretaria read tabela"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tabela'
    AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  );
