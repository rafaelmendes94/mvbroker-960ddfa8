REVOKE ALL ON FUNCTION public.sync_unit_from_imovel(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_imoveis_sync_unit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_unit_from_imovel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_imoveis_sync_unit() TO service_role;