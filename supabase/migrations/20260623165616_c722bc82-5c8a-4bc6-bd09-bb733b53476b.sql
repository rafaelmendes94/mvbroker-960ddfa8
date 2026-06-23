
-- Revoke column-level SELECT on sensitive fields; access only via SECURITY DEFINER RPCs.
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM anon, authenticated;
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM anon, authenticated;
REVOKE SELECT (
  observacoes_internas, local_chaves,
  responsavel_nome, responsavel_telefone, responsavel_whatsapp, responsavel_email,
  comissao_percentual, valor_comissao,
  termo_exclusividade_path, pdf_comercial_path
) ON public.imoveis FROM anon, authenticated;

-- Restringe leitura de tabela_atual a admin/secretaria (mesma regra do storage).
DROP POLICY IF EXISTS "Autenticados podem ler tabela atual" ON public.tabela_atual;
CREATE POLICY "Admin/secretaria leem tabela atual"
ON public.tabela_atual
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'secretaria'::app_role));

-- Permite corretor atribuído atualizar o próprio imóvel.
DROP POLICY IF EXISTS imoveis_update_corretor_assigned ON public.imoveis;
CREATE POLICY imoveis_update_corretor_assigned
ON public.imoveis
FOR UPDATE
TO authenticated
USING (
  corretor_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.corretores c WHERE c.id = imoveis.corretor_id AND c.user_id = auth.uid())
)
WITH CHECK (
  corretor_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.corretores c WHERE c.id = imoveis.corretor_id AND c.user_id = auth.uid())
);
