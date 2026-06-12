DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

-- Tabelas que precisam ser legíveis publicamente (landing page / feeds públicos)
GRANT SELECT ON public.planos TO anon;
GRANT SELECT ON public.system_options TO anon;
GRANT SELECT ON public.imoveis TO anon;
GRANT SELECT ON public.imovel_imagens TO anon;
GRANT SELECT ON public.portais TO anon;
GRANT SELECT ON public.carteira_portais TO anon;
GRANT SELECT ON public.carteira_imoveis TO anon;
GRANT SELECT ON public.carteiras TO anon;
GRANT SELECT ON public.profiles TO anon;

-- Sequences (para INSERTs em tabelas com serial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Funções (RPC)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contato_publico(text) TO anon;