CREATE OR REPLACE FUNCTION public.is_admin_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','super_admin','secretaria')
  )
$$;

CREATE POLICY "Staff read equipe carteiras"
ON public.carteiras FOR SELECT TO authenticated
USING (visibilidade = 'equipe' AND public.is_admin_staff(auth.uid()));

CREATE POLICY "Staff update equipe carteiras"
ON public.carteiras FOR UPDATE TO authenticated
USING (visibilidade = 'equipe' AND public.is_admin_staff(auth.uid()))
WITH CHECK (visibilidade = 'equipe' AND public.is_admin_staff(auth.uid()));

CREATE POLICY "Staff delete equipe carteiras"
ON public.carteiras FOR DELETE TO authenticated
USING (visibilidade = 'equipe' AND public.is_admin_staff(auth.uid()));

CREATE POLICY "Staff manage equipe carteira_imoveis"
ON public.carteira_imoveis FOR ALL TO authenticated
USING (
  public.is_admin_staff(auth.uid())
  AND EXISTS (SELECT 1 FROM public.carteiras c WHERE c.id = carteira_id AND c.visibilidade = 'equipe')
)
WITH CHECK (
  public.is_admin_staff(auth.uid())
  AND EXISTS (SELECT 1 FROM public.carteiras c WHERE c.id = carteira_id AND c.visibilidade = 'equipe')
);