
CREATE POLICY "banco_img_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'banco-imagens');
CREATE POLICY "banco_img_write_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banco-imagens' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')));
CREATE POLICY "banco_img_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'banco-imagens' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')));
CREATE POLICY "banco_img_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banco-imagens' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')));
