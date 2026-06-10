
-- 1. Revoke column-level SELECT on sensitive columns
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM authenticated, anon;
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM authenticated, anon;
REVOKE SELECT (
  observacoes_internas, local_chaves,
  responsavel_nome, responsavel_telefone, responsavel_whatsapp, responsavel_email,
  comissao_percentual, valor_comissao,
  termo_exclusividade_path, pdf_comercial_path
) ON public.imoveis FROM authenticated, anon;

-- 2. Restrict imovel_logs SELECT to super_admin / secretaria
DROP POLICY IF EXISTS imovel_logs_select_auth ON public.imovel_logs;
CREATE POLICY imovel_logs_select_admin ON public.imovel_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'secretaria'::app_role));

-- 3. Remove duplicate public-role policies (superseded by authenticated-scoped policies)
DROP POLICY IF EXISTS "Usuários gerenciam suas próprias carteiras" ON public.carteiras;
DROP POLICY IF EXISTS "Usuários gerenciam itens das suas carteiras" ON public.carteira_imoveis;
DROP POLICY IF EXISTS "Donos da carteira veem seus logs" ON public.feed_logs;

-- 4. Realtime broadcast/presence: explicit deny policy on realtime.messages
--    (postgres_changes events still respect each table's own RLS)
DROP POLICY IF EXISTS "deny_all_realtime_messages" ON realtime.messages;
CREATE POLICY "deny_all_realtime_messages" ON realtime.messages
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
