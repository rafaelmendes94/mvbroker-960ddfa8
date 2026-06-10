
-- ============================================================
-- FASE 2 — Distribuição XML: portais, compartilhamento e regras
-- ============================================================

-- 1) Catálogo de Portais
CREATE TABLE public.portais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  logo_url text,
  cor text,
  site_url text,
  formato_xml text NOT NULL DEFAULT 'vrsync',
  instrucoes text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portais TO authenticated;
GRANT ALL ON public.portais TO service_role;

ALTER TABLE public.portais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read portais"
  ON public.portais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manages portais"
  ON public.portais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_portais_updated_at BEFORE UPDATE ON public.portais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Top 5 portais BR
INSERT INTO public.portais (slug, nome, descricao, cor, site_url, formato_xml, instrucoes, ordem) VALUES
  ('vrsync-universal', 'Universal (VRSync)', 'Padrão Viva Real aceito pela maioria dos portais brasileiros.', '#0EA5E9', null, 'vrsync',
   'Cole a URL XML diretamente no campo de importação do portal. Atualização on-demand.', 0),
  ('olx', 'OLX Imóveis', 'Maior portal de classificados do Brasil.', '#6F2DA8', 'https://www.olx.com.br',
   'olx', 'No painel OLX Pro, vá em Integração → Importação por URL → cole a URL XML.', 1),
  ('vivareal', 'Viva Real', 'Portal especializado em imóveis residenciais.', '#FF6900', 'https://www.vivareal.com.br',
   'vrsync', 'Painel Viva Real: Integrações → Receber XML → cole a URL.', 2),
  ('zap', 'ZAP Imóveis', 'Portal premium do grupo OLX/Viva Real.', '#F47D31', 'https://www.zapimoveis.com.br',
   'vrsync', 'Painel ZAP: Configurações → Importação XML.', 3),
  ('imovelweb', 'ImovelWeb', 'Portal nacional com forte presença em SP.', '#0066CC', 'https://www.imovelweb.com.br',
   'imovelweb', 'Painel ImovelWeb: Cadastros → Integração XML → cole a URL.', 4),
  ('chavesnamao', 'Chaves na Mão', 'Portal tradicional com foco em locação.', '#E11D48', 'https://www.chavesnamao.com.br',
   'vrsync', 'Painel CnM: Anúncios → Importar XML → cole a URL.', 5);

-- 2) Novos campos em carteiras
ALTER TABLE public.carteiras
  ADD COLUMN IF NOT EXISTS visibilidade text NOT NULL DEFAULT 'privada' CHECK (visibilidade IN ('privada','compartilhada','publica')),
  ADD COLUMN IF NOT EXISTS limite_imoveis int,
  ADD COLUMN IF NOT EXISTS marca_dagua boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regra_filtros jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Compartilhamentos
CREATE TABLE public.carteira_compartilhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id uuid NOT NULL REFERENCES public.carteiras(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao text NOT NULL DEFAULT 'leitura' CHECK (permissao IN ('leitura','edicao')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carteira_id, usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carteira_compartilhamentos TO authenticated;
GRANT ALL ON public.carteira_compartilhamentos TO service_role;

ALTER TABLE public.carteira_compartilhamentos ENABLE ROW LEVEL SECURITY;

-- helpers
CREATE OR REPLACE FUNCTION public.pode_ler_carteira(_user_id uuid, _carteira_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.carteiras c
    WHERE c.id = _carteira_id
      AND (
        c.usuario_id = _user_id
        OR c.visibilidade = 'publica'
        OR public.has_role(_user_id, 'super_admin')
        OR EXISTS (SELECT 1 FROM public.carteira_compartilhamentos s
                   WHERE s.carteira_id = _carteira_id AND s.usuario_id = _user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_editar_carteira(_user_id uuid, _carteira_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.carteiras c
    WHERE c.id = _carteira_id
      AND (
        c.usuario_id = _user_id
        OR public.has_role(_user_id, 'super_admin')
        OR EXISTS (SELECT 1 FROM public.carteira_compartilhamentos s
                   WHERE s.carteira_id = _carteira_id AND s.usuario_id = _user_id AND s.permissao = 'edicao')
      )
  )
$$;

CREATE POLICY "Owner manages shares" ON public.carteira_compartilhamentos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.carteiras c WHERE c.id = carteira_id AND c.usuario_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.carteiras c WHERE c.id = carteira_id AND c.usuario_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Shared user reads own share" ON public.carteira_compartilhamentos
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

-- 4) Carteira ↔ Portais
CREATE TABLE public.carteira_portais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id uuid NOT NULL REFERENCES public.carteiras(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.portais(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  ultima_leitura timestamptz,
  total_leituras int NOT NULL DEFAULT 0,
  status_sincronizacao text NOT NULL DEFAULT 'pendente' CHECK (status_sincronizacao IN ('pendente','ok','erro','inativo')),
  mensagem_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carteira_id, portal_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carteira_portais TO authenticated;
GRANT ALL ON public.carteira_portais TO service_role;

ALTER TABLE public.carteira_portais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read if can read carteira" ON public.carteira_portais
  FOR SELECT TO authenticated USING (public.pode_ler_carteira(auth.uid(), carteira_id));

CREATE POLICY "Edit if can edit carteira" ON public.carteira_portais
  FOR ALL TO authenticated
  USING (public.pode_editar_carteira(auth.uid(), carteira_id))
  WITH CHECK (public.pode_editar_carteira(auth.uid(), carteira_id));

CREATE TRIGGER trg_carteira_portais_updated_at BEFORE UPDATE ON public.carteira_portais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Atualizar políticas existentes para respeitar compartilhamento
-- carteiras: substitui política única atual por leitura + edição separadas
DROP POLICY IF EXISTS "Users manage their carteiras" ON public.carteiras;
DROP POLICY IF EXISTS "Super admin manages all carteiras" ON public.carteiras;

CREATE POLICY "Read carteiras (own, shared, public, admin)" ON public.carteiras
  FOR SELECT TO authenticated USING (
    usuario_id = auth.uid()
    OR visibilidade = 'publica'
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.carteira_compartilhamentos s
               WHERE s.carteira_id = id AND s.usuario_id = auth.uid())
  );

CREATE POLICY "Insert own carteiras" ON public.carteiras
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Update carteiras (owner, shared editor, admin)" ON public.carteiras
  FOR UPDATE TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.carteira_compartilhamentos s
               WHERE s.carteira_id = id AND s.usuario_id = auth.uid() AND s.permissao = 'edicao')
  );

CREATE POLICY "Delete own carteiras" ON public.carteiras
  FOR DELETE TO authenticated USING (
    usuario_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
  );

-- carteira_imoveis: ajustar para usar helpers
DROP POLICY IF EXISTS "Users manage carteira_imoveis of their carteiras" ON public.carteira_imoveis;

CREATE POLICY "Read carteira_imoveis if can read" ON public.carteira_imoveis
  FOR SELECT TO authenticated USING (public.pode_ler_carteira(auth.uid(), carteira_id));

CREATE POLICY "Edit carteira_imoveis if can edit" ON public.carteira_imoveis
  FOR ALL TO authenticated
  USING (public.pode_editar_carteira(auth.uid(), carteira_id))
  WITH CHECK (public.pode_editar_carteira(auth.uid(), carteira_id));

-- feed_logs: leitura
DROP POLICY IF EXISTS "Users read feed_logs of their carteiras" ON public.feed_logs;

CREATE POLICY "Read feed_logs if can read carteira" ON public.feed_logs
  FOR SELECT TO authenticated USING (public.pode_ler_carteira(auth.uid(), carteira_id));
