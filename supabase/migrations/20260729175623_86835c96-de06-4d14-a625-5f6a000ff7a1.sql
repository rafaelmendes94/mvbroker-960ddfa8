CREATE POLICY "Secretaria manages options"
ON public.system_options
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));