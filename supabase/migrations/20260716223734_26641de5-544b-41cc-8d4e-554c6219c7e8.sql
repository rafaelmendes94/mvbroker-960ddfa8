CREATE POLICY "estrutura_arquivos read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'estrutura-arquivos');

CREATE POLICY "estrutura_arquivos insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estrutura-arquivos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'secretaria'::app_role)));

CREATE POLICY "estrutura_arquivos update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'estrutura-arquivos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'secretaria'::app_role)));

CREATE POLICY "estrutura_arquivos delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'estrutura-arquivos' AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'secretaria'::app_role)));