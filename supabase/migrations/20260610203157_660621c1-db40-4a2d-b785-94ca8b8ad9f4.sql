
CREATE POLICY "biblioteca read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('imoveis','documentos','exclusividades','materiais'));
CREATE POLICY "biblioteca insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('imoveis','documentos','exclusividades','materiais')
    AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria')));
CREATE POLICY "biblioteca update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('imoveis','documentos','exclusividades','materiais')
    AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria')));
CREATE POLICY "biblioteca delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('imoveis','documentos','exclusividades','materiais')
    AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria')));
