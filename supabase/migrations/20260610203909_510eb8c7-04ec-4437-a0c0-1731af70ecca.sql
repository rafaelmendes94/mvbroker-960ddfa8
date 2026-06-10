
-- ============================================================
-- TABELA: imoveis
-- ============================================================
CREATE TABLE public.imoveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_interno TEXT UNIQUE,

  -- Identificação
  titulo TEXT NOT NULL,
  unidade TEXT,
  box TEXT,
  quadra TEXT,
  lote TEXT,
  tipo_imovel TEXT,
  status_imovel TEXT NOT NULL DEFAULT 'disponivel',
  dormitorios INTEGER,
  banheiros INTEGER,
  lavabo INTEGER,
  vagas INTEGER,
  elevadores INTEGER,
  area_privativa NUMERIC(12,2),
  area_total NUMERIC(12,2),

  -- Vinculação
  edificio_id UUID REFERENCES public.edificios(id) ON DELETE SET NULL,
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE SET NULL,
  empreendimento_id UUID REFERENCES public.empreendimentos(id) ON DELETE SET NULL,
  imobiliaria_id UUID REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,

  -- Endereço
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),

  -- Valores
  preco NUMERIC(14,2),
  preco_parcelado NUMERIC(14,2),
  comissao_percentual NUMERIC(5,2),
  valor_comissao NUMERIC(14,2),
  bonus TEXT,
  validade_bonus DATE,
  padrao TEXT,
  condicoes_pagamento TEXT[] NOT NULL DEFAULT '{}',

  -- Origem / Responsável
  responsavel_nome TEXT,
  responsavel_telefone TEXT,
  responsavel_whatsapp TEXT,
  responsavel_email TEXT,
  tipo_proprietario TEXT,
  exclusividade BOOLEAN NOT NULL DEFAULT false,
  local_chaves TEXT,
  termo_exclusividade_path TEXT,

  -- Características
  condicao TEXT, -- mobiliado, semi_mobiliado, decorado, vazio
  posicao_predio TEXT,
  posicao_solar TEXT,
  vista TEXT,
  vista_mar BOOLEAN NOT NULL DEFAULT false,
  decorado BOOLEAN NOT NULL DEFAULT false,
  aceita_permuta BOOLEAN NOT NULL DEFAULT false,
  infraestrutura TEXT[] NOT NULL DEFAULT '{}',
  outras_caracteristicas TEXT[] NOT NULL DEFAULT '{}',

  -- Publicação
  ativo_site BOOLEAN NOT NULL DEFAULT true,
  publicar_xml BOOLEAN NOT NULL DEFAULT false,
  destaque_home BOOLEAN NOT NULL DEFAULT false,
  destaque_categoria TEXT,

  -- Descrição
  descricao TEXT,

  -- Vídeos e materiais
  link_video TEXT,
  link_material TEXT,
  link_drive_fotos TEXT,
  tour_360 TEXT,
  pdf_comercial_path TEXT,

  -- Controle interno
  data_captacao DATE,
  responsavel_captacao TEXT,
  observacoes_internas TEXT,
  exclusivo BOOLEAN NOT NULL DEFAULT false,
  compartilhamento_permitido BOOLEAN NOT NULL DEFAULT true,
  comissao_compartilhada NUMERIC(5,2),
  data_vencimento_exclusividade DATE,

  -- XML / Portais
  portais_permitidos TEXT[] NOT NULL DEFAULT '{}',
  prioridade_xml INTEGER NOT NULL DEFAULT 0,
  ultima_exportacao TIMESTAMPTZ,
  status_exportacao TEXT,

  -- Arquivamento
  arquivado BOOLEAN NOT NULL DEFAULT false,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT ALL ON public.imoveis TO service_role;
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imoveis_select_auth"
  ON public.imoveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "imoveis_insert_admin_secretaria"
  ON public.imoveis FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "imoveis_update_admin_secretaria"
  ON public.imoveis FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));
CREATE POLICY "imoveis_delete_admin_secretaria"
  ON public.imoveis FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

CREATE INDEX idx_imoveis_status ON public.imoveis(status_imovel);
CREATE INDEX idx_imoveis_tipo ON public.imoveis(tipo_imovel);
CREATE INDEX idx_imoveis_cidade ON public.imoveis(cidade);
CREATE INDEX idx_imoveis_codigo ON public.imoveis(codigo_interno);
CREATE INDEX idx_imoveis_arquivado ON public.imoveis(arquivado);

CREATE TRIGGER trg_imoveis_updated_at
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SEQUENCE + TRIGGER para codigo_interno (MV-{ano}-{seq})
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.imoveis_codigo_seq;

CREATE OR REPLACE FUNCTION public.gen_imovel_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_interno IS NULL OR NEW.codigo_interno = '' THEN
    NEW.codigo_interno := 'MV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.imoveis_codigo_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_imoveis_codigo
  BEFORE INSERT ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.gen_imovel_codigo();

-- ============================================================
-- TABELA: imovel_imagens
-- ============================================================
CREATE TABLE public.imovel_imagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  capa BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imovel_imagens TO authenticated;
GRANT ALL ON public.imovel_imagens TO service_role;
ALTER TABLE public.imovel_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imovel_imagens_select_auth"
  ON public.imovel_imagens FOR SELECT TO authenticated USING (true);
CREATE POLICY "imovel_imagens_write_admin_sec"
  ON public.imovel_imagens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

CREATE INDEX idx_imovel_imagens_imovel ON public.imovel_imagens(imovel_id);

-- ============================================================
-- TABELA: imovel_logs
-- ============================================================
CREATE TABLE public.imovel_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  user_id UUID,
  acao TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.imovel_logs TO authenticated;
GRANT ALL ON public.imovel_logs TO service_role;
ALTER TABLE public.imovel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imovel_logs_select_auth"
  ON public.imovel_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "imovel_logs_insert_auth"
  ON public.imovel_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX idx_imovel_logs_imovel ON public.imovel_logs(imovel_id);

-- ============================================================
-- STORAGE policies para bucket 'imoveis' (galeria)
-- ============================================================
DO $$ BEGIN
  CREATE POLICY "imoveis_storage_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'imoveis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "imoveis_storage_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'imoveis' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "imoveis_storage_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'imoveis' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "imoveis_storage_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'imoveis' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEEDS system_options (idempotente)
-- ============================================================
INSERT INTO public.system_options (categoria, nome, slug, ativo, ordem) VALUES
  -- padrao_imovel
  ('padrao_imovel', 'Econômico', 'economico', true, 1),
  ('padrao_imovel', 'Médio', 'medio', true, 2),
  ('padrao_imovel', 'Alto Padrão', 'alto_padrao', true, 3),
  ('padrao_imovel', 'Luxo', 'luxo', true, 4),
  -- condicoes_pagamento
  ('condicoes_pagamento', 'À Vista', 'a_vista', true, 1),
  ('condicoes_pagamento', 'Financiamento', 'financiamento', true, 2),
  ('condicoes_pagamento', 'FGTS', 'fgts', true, 3),
  ('condicoes_pagamento', 'Permuta', 'permuta', true, 4),
  ('condicoes_pagamento', 'Carta de Crédito', 'carta_credito', true, 5),
  -- tipo_proprietario
  ('tipo_proprietario', 'Construtora', 'construtora', true, 1),
  ('tipo_proprietario', 'Investidor', 'investidor', true, 2),
  ('tipo_proprietario', 'Particular', 'particular', true, 3),
  ('tipo_proprietario', 'Adm Comercial', 'adm_comercial', true, 4),
  -- posicao_predio
  ('posicao_predio', 'Frente', 'frente', true, 1),
  ('posicao_predio', 'Fundos', 'fundos', true, 2),
  ('posicao_predio', 'Lateral', 'lateral', true, 3),
  ('posicao_predio', 'Cobertura', 'cobertura', true, 4),
  -- posicao_solar
  ('posicao_solar', 'Norte', 'norte', true, 1),
  ('posicao_solar', 'Sul', 'sul', true, 2),
  ('posicao_solar', 'Leste', 'leste', true, 3),
  ('posicao_solar', 'Oeste', 'oeste', true, 4),
  -- vista
  ('vista', 'Mar', 'mar', true, 1),
  ('vista', 'Cidade', 'cidade', true, 2),
  ('vista', 'Montanha', 'montanha', true, 3),
  ('vista', 'Lagoa', 'lagoa', true, 4),
  ('vista', 'Parque', 'parque', true, 5),
  -- destaque_categoria
  ('destaque_categoria', 'Lançamento', 'lancamento', true, 1),
  ('destaque_categoria', 'Oportunidade', 'oportunidade', true, 2),
  ('destaque_categoria', 'Exclusivo', 'exclusivo', true, 3),
  ('destaque_categoria', 'Top do Mês', 'top_mes', true, 4),
  -- portais_xml
  ('portais_xml', 'Viva Real', 'viva_real', true, 1),
  ('portais_xml', 'Zap Imóveis', 'zap_imoveis', true, 2),
  ('portais_xml', 'OLX', 'olx', true, 3),
  ('portais_xml', 'ImovelWeb', 'imovelweb', true, 4),
  ('portais_xml', 'Chaves na Mão', 'chaves_na_mao', true, 5),
  -- status_imovel (caso não exista)
  ('status_imovel', 'Disponível', 'disponivel', true, 1),
  ('status_imovel', 'Reservado', 'reservado', true, 2),
  ('status_imovel', 'Vendido', 'vendido', true, 3),
  ('status_imovel', 'Alugado', 'alugado', true, 4),
  ('status_imovel', 'Suspenso', 'suspenso', true, 5),
  -- tipo_imovel (caso não exista)
  ('tipo_imovel', 'Apartamento', 'apartamento', true, 1),
  ('tipo_imovel', 'Casa', 'casa', true, 2),
  ('tipo_imovel', 'Comercial', 'comercial', true, 3),
  ('tipo_imovel', 'Terreno', 'terreno', true, 4),
  ('tipo_imovel', 'Lote', 'lote', true, 5),
  ('tipo_imovel', 'Condomínio', 'condominio', true, 6)
ON CONFLICT DO NOTHING;
