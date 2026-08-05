CREATE OR REPLACE FUNCTION public.get_imoveis_chaves()
RETURNS TABLE(id uuid, local_chaves text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'secretaria'::app_role)
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT i.id, i.local_chaves FROM public.imoveis i WHERE i.local_chaves IS NOT NULL AND i.local_chaves <> '';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_imoveis_chaves() TO authenticated;