DROP POLICY IF EXISTS "Auth users can add options" ON public.system_options;
CREATE POLICY "Auth users can add options" ON public.system_options
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND ativo = true);