-- ============================================================
-- 1) FIX bug nas políticas de carteiras (self-reference s.id)
-- ============================================================
DROP POLICY IF EXISTS "Read carteiras (own, shared, public, admin)" ON public.carteiras;
CREATE POLICY "Read carteiras (own, shared, public, admin)"
ON public.carteiras FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR visibilidade = 'publica'
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.carteira_compartilhamentos s
    WHERE s.carteira_id = carteiras.id AND s.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Update carteiras (owner, shared editor, admin)" ON public.carteiras;
CREATE POLICY "Update carteiras (owner, shared editor, admin)"
ON public.carteiras FOR UPDATE TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.carteira_compartilhamentos s
    WHERE s.carteira_id = carteiras.id
      AND s.usuario_id = auth.uid()
      AND s.permissao = 'edicao'
  )
);

-- ============================================================
-- 2) AUDIT_LOGS — bloquear insert direto, usar RPC SECURITY DEFINER
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_insert_any_auth" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.log_action(
  p_modulo text,
  p_acao text,
  p_registro_tipo text DEFAULT NULL,
  p_registro_id uuid DEFAULT NULL,
  p_status text DEFAULT 'sucesso',
  p_descricao text DEFAULT NULL,
  p_dados_anteriores jsonb DEFAULT NULL,
  p_dados_novos jsonb DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs(
    usuario_id, modulo, acao, registro_tipo, registro_id,
    status, descricao, dados_anteriores, dados_novos, user_agent
  ) VALUES (
    auth.uid(),
    p_modulo, p_acao, p_registro_tipo, p_registro_id,
    COALESCE(p_status, 'sucesso'), p_descricao,
    p_dados_anteriores, p_dados_novos, p_user_agent
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_action(text,text,text,uuid,text,text,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_action(text,text,text,uuid,text,text,jsonb,jsonb,text) TO authenticated;

-- ============================================================
-- 3) SECURITY_ALERTS — bloquear insert direto, usar RPC SECURITY DEFINER
-- ============================================================
DROP POLICY IF EXISTS "security_alerts_insert_auth" ON public.security_alerts;

CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_tipo text,
  p_severidade text DEFAULT 'media',
  p_descricao text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.security_alerts(usuario_id, tipo, severidade, descricao, metadata)
  VALUES (auth.uid(), p_tipo, COALESCE(p_severidade, 'media'), p_descricao, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_security_alert(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_security_alert(text,text,text,jsonb) TO authenticated;

-- ============================================================
-- 4) PII: corretores — revogar leitura de email/telefone/whatsapp
-- ============================================================
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_corretor_contato(p_corretor_id uuid)
RETURNS TABLE(email text, telefone text, whatsapp text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.email, c.telefone, c.whatsapp
  FROM public.corretores c
  WHERE c.id = p_corretor_id
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'secretaria'::app_role)
      OR c.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.imobiliarias i
        WHERE i.id = c.imobiliaria_id AND i.owner_id = auth.uid()
      )
    );
END;
$$;
REVOKE ALL ON FUNCTION public.get_corretor_contato(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_corretor_contato(uuid) TO authenticated;

-- ============================================================
-- 5) PII: imobiliarias — revogar leitura de cnpj/email/telefone
-- ============================================================
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_imobiliaria_contato(p_imobiliaria_id uuid)
RETURNS TABLE(cnpj text, email text, telefone text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT i.cnpj, i.email, i.telefone
  FROM public.imobiliarias i
  WHERE i.id = p_imobiliaria_id
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'secretaria'::app_role)
      OR i.owner_id = auth.uid()
    );
END;
$$;
REVOKE ALL ON FUNCTION public.get_imobiliaria_contato(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_imobiliaria_contato(uuid) TO authenticated;

-- ============================================================
-- 6) PII: imoveis — revogar leitura de campos internos sensíveis
-- ============================================================
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

CREATE OR REPLACE FUNCTION public.get_imovel_internal(p_imovel_id uuid)
RETURNS TABLE(
  observacoes_internas text,
  local_chaves text,
  responsavel_nome text,
  responsavel_telefone text,
  responsavel_whatsapp text,
  responsavel_email text,
  comissao_percentual numeric,
  valor_comissao numeric,
  termo_exclusividade_path text,
  pdf_comercial_path text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  SELECT
    i.observacoes_internas, i.local_chaves,
    i.responsavel_nome, i.responsavel_telefone, i.responsavel_whatsapp, i.responsavel_email,
    i.comissao_percentual, i.valor_comissao,
    i.termo_exclusividade_path, i.pdf_comercial_path
  FROM public.imoveis i
  WHERE i.id = p_imovel_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_imovel_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_imovel_internal(uuid) TO authenticated;
