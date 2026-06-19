CREATE POLICY "super_admin_read_agenciamentos"
ON public.agenciamentos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);