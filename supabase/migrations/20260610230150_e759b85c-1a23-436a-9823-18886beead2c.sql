
REVOKE EXECUTE ON FUNCTION public.get_ranking_imoveis(text, text, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ranking_corretores(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_imoveis(text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_corretores(text, text, int) TO authenticated;
