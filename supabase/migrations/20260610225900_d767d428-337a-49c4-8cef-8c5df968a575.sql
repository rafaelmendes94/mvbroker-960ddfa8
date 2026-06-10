
CREATE OR REPLACE FUNCTION public.get_oportunidades_resumo()
RETURNS TABLE(
  novos_hoje int,
  novos_7d int,
  novos_30d int,
  atualizados_7d int,
  exclusivos int,
  com_bonus int,
  destaque int,
  vista_mar int,
  alto_padrao int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.imoveis WHERE created_at::date = CURRENT_DATE AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE created_at >= now() - interval '7 days' AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE created_at >= now() - interval '30 days' AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE updated_at >= now() - interval '7 days' AND updated_at <> created_at AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE (exclusividade = true OR exclusivo = true) AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE bonus IS NOT NULL AND bonus <> '' AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE destaque_home = true AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE vista_mar = true AND COALESCE(arquivado, false) = false),
    (SELECT COUNT(*)::int FROM public.imoveis WHERE padrao ILIKE 'alto%' AND COALESCE(arquivado, false) = false);
$$;

REVOKE EXECUTE ON FUNCTION public.get_oportunidades_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_oportunidades_resumo() TO authenticated;
