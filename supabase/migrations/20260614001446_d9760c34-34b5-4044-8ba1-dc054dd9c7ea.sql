
-- Fix agenciamentos policy: restrict to authenticated role
DROP POLICY IF EXISTS "Users manage own agenciamentos" ON public.agenciamentos;
CREATE POLICY "Users manage own agenciamentos" ON public.agenciamentos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Revoke sensitive column SELECTs from corretores
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM authenticated, anon;

-- Revoke sensitive column SELECTs from imobiliarias
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM authenticated, anon;

-- Revoke sensitive column SELECTs from imoveis
REVOKE SELECT (
  observacoes_internas,
  local_chaves,
  responsavel_nome,
  responsavel_telefone,
  responsavel_whatsapp,
  responsavel_email,
  comissao_percentual,
  valor_comissao,
  termo_exclusividade_path,
  pdf_comercial_path
) ON public.imoveis FROM authenticated, anon;
