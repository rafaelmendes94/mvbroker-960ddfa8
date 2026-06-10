
-- Re-apply column-level REVOKEs on sensitive columns and add audit_logs INSERT policy

-- corretores: sensitive contact columns
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM authenticated;
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM anon;

-- imobiliarias: sensitive fields
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM authenticated;
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM anon;

-- imoveis: internal/sensitive columns
REVOKE SELECT (
  observacoes_internas, local_chaves,
  responsavel_nome, responsavel_telefone, responsavel_whatsapp, responsavel_email,
  comissao_percentual, valor_comissao,
  termo_exclusividade_path, pdf_comercial_path
) ON public.imoveis FROM authenticated;
REVOKE SELECT (
  observacoes_internas, local_chaves,
  responsavel_nome, responsavel_telefone, responsavel_whatsapp, responsavel_email,
  comissao_percentual, valor_comissao,
  termo_exclusividade_path, pdf_comercial_path
) ON public.imoveis FROM anon;

-- audit_logs: allow authenticated users (and triggers running as them) to insert their own audit rows
DROP POLICY IF EXISTS "audit_logs_insert_self" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_self"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR usuario_id IS NULL);
