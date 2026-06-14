
-- 1) Revoke column-level SELECT on sensitive columns from anon/authenticated.
--    Sensitive data continues to be reachable only via SECURITY DEFINER RPCs.

REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM anon, authenticated;
REVOKE SELECT (cnpj, email, telefone)     ON public.imobiliarias FROM anon, authenticated;
REVOKE SELECT (
  observacoes_internas, local_chaves,
  responsavel_nome, responsavel_telefone, responsavel_whatsapp, responsavel_email,
  comissao_percentual, valor_comissao,
  termo_exclusividade_path, pdf_comercial_path
) ON public.imoveis FROM anon, authenticated;

-- 2) Restrict storage read on sensitive buckets to super_admin / secretaria.
--    Keep public-image buckets (imoveis) read policy intact.

DROP POLICY IF EXISTS "biblioteca read" ON storage.objects;

CREATE POLICY "imoveis bucket read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'imoveis');

CREATE POLICY "biblioteca read restrita"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['documentos','exclusividades','materiais'])
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  )
);
