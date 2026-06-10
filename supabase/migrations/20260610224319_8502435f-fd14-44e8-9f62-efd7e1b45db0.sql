
-- =========== PLANOS ===========
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL CHECK (tipo IN ('individual','imobiliaria')),
  preco_mensal numeric(12,2) NOT NULL DEFAULT 0,
  preco_anual numeric(12,2),
  recursos jsonb NOT NULL DEFAULT '[]'::jsonb,
  limite_usuarios integer,
  limite_carteiras integer,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_select_auth" ON public.planos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_admin_all" ON public.planos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'));

CREATE TRIGGER trg_planos_updated BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== ASSINATURAS ===========
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos(id) ON DELETE RESTRICT,
  imobiliaria_id uuid REFERENCES public.imobiliarias(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ciclo text NOT NULL DEFAULT 'mensal' CHECK (ciclo IN ('mensal','anual')),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','bloqueada','cancelada','trial')),
  bloqueio_motivo text,
  inicio_em date NOT NULL DEFAULT CURRENT_DATE,
  proximo_vencimento date,
  ultimo_pagamento_em date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assinatura_um_titular CHECK (
    (imobiliaria_id IS NOT NULL AND usuario_id IS NULL)
    OR (imobiliaria_id IS NULL AND usuario_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX assinaturas_imob_uniq ON public.assinaturas(imobiliaria_id) WHERE imobiliaria_id IS NOT NULL;
CREATE UNIQUE INDEX assinaturas_user_uniq ON public.assinaturas(usuario_id) WHERE usuario_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assinaturas_select" ON public.assinaturas
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'secretaria')
    OR usuario_id = auth.uid()
    OR (imobiliaria_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.imobiliarias i WHERE i.id = assinaturas.imobiliaria_id AND i.owner_id = auth.uid()
    ))
  );
CREATE POLICY "assinaturas_admin_all" ON public.assinaturas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'));

CREATE TRIGGER trg_assinaturas_updated BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== PAGAMENTOS ===========
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL,
  metodo text NOT NULL DEFAULT 'pix' CHECK (metodo IN ('pix','boleto','cartao','transferencia','dinheiro','outro')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','pendente','atrasado','estornado')),
  vencimento date,
  pago_em date,
  competencia text,
  comprovante_url text,
  observacao text,
  registrado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos_select" ON public.pagamentos
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (
      SELECT 1 FROM public.assinaturas a
      WHERE a.id = pagamentos.assinatura_id
        AND (a.usuario_id = auth.uid()
          OR (a.imobiliaria_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.imobiliarias i WHERE i.id = a.imobiliaria_id AND i.owner_id = auth.uid()
          )))
    )
  );
CREATE POLICY "pagamentos_admin_all" ON public.pagamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria'));

CREATE TRIGGER trg_pagamentos_updated BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== RPC status efetivo ===========
CREATE OR REPLACE FUNCTION public.get_minha_assinatura()
RETURNS TABLE(
  assinatura_id uuid,
  plano_id uuid,
  plano_nome text,
  status text,
  ciclo text,
  valor numeric,
  proximo_vencimento date,
  bloqueio_motivo text,
  titular text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  -- 1) assinatura individual
  RETURN QUERY
  SELECT a.id, a.plano_id, p.nome, a.status, a.ciclo, a.valor,
         a.proximo_vencimento, a.bloqueio_motivo, 'individual'::text
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.usuario_id = v_uid
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2) via imobiliária (owner ou corretor)
  RETURN QUERY
  SELECT a.id, a.plano_id, p.nome, a.status, a.ciclo, a.valor,
         a.proximo_vencimento, a.bloqueio_motivo, 'imobiliaria'::text
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.imobiliaria_id IN (
    SELECT i.id FROM public.imobiliarias i WHERE i.owner_id = v_uid
    UNION
    SELECT c.imobiliaria_id FROM public.corretores c WHERE c.user_id = v_uid AND c.imobiliaria_id IS NOT NULL
  )
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_minha_assinatura() TO authenticated;

-- =========== SEED inicial ===========
INSERT INTO public.planos (nome, descricao, tipo, preco_mensal, preco_anual, recursos, limite_usuarios, limite_carteiras, ordem) VALUES
('Corretor', 'Ideal para corretores autônomos.', 'individual', 99.00, 990.00,
  '["1 usuário","Carteiras ilimitadas","XML exclusivo","Distribuição para portais","Relatórios básicos"]'::jsonb,
  1, NULL, 1),
('Imobiliária', 'Ideal para imobiliárias com equipe.', 'imobiliaria', 299.00, 2990.00,
  '["Usuários ilimitados","Carteiras ilimitadas","XMLs exclusivos","Distribuição para portais","Relatórios completos","Suporte prioritário"]'::jsonb,
  NULL, NULL, 2),
('Premium', 'Para operações maiores e multiusuários.', 'imobiliaria', 599.00, 5990.00,
  '["Tudo do plano Imobiliária","Integrações avançadas","Relatórios personalizados","Suporte dedicado","Consultoria especializada"]'::jsonb,
  NULL, NULL, 3);
