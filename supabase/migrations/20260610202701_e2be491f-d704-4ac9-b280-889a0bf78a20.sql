
CREATE POLICY "estrutura_imagens read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'estrutura-imagens');
CREATE POLICY "estrutura_imagens insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estrutura-imagens' AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria')));
CREATE POLICY "estrutura_imagens update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'estrutura-imagens' AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria')));
CREATE POLICY "estrutura_imagens delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'estrutura-imagens' AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria')));
