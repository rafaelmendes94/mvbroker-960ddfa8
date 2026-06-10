
CREATE TABLE public.system_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_options TO authenticated;
GRANT ALL ON public.system_options TO service_role;
ALTER TABLE public.system_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read options" ON public.system_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manages options" ON public.system_options
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_system_options_updated
BEFORE UPDATE ON public.system_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_system_options_cat ON public.system_options(categoria, ordem);

-- Seed
INSERT INTO public.system_options (categoria, nome, slug, ordem) VALUES
  ('tipo_imovel','Apartamento','apartamento',1),
  ('tipo_imovel','Casa','casa',2),
  ('tipo_imovel','Comercial','comercial',3),
  ('tipo_imovel','Terreno','terreno',4),
  ('tipo_imovel','Lote','lote',5),
  ('tipo_imovel','Condomínio','condominio',6),

  ('status_imovel','Disponível','disponivel',1),
  ('status_imovel','Reservado','reservado',2),
  ('status_imovel','Vendido','vendido',3),
  ('status_imovel','Alugado','alugado',4),
  ('status_imovel','Suspenso','suspenso',5),

  ('posicao_solar','Norte','norte',1),
  ('posicao_solar','Sul','sul',2),
  ('posicao_solar','Leste','leste',3),
  ('posicao_solar','Oeste','oeste',4),
  ('posicao_solar','Nordeste','nordeste',5),
  ('posicao_solar','Noroeste','noroeste',6),
  ('posicao_solar','Sudeste','sudeste',7),
  ('posicao_solar','Sudoeste','sudoeste',8),

  ('vista','Mar','mar',1),
  ('vista','Lagoa','lagoa',2),
  ('vista','Rio','rio',3),
  ('vista','Montanha','montanha',4),
  ('vista','Cidade','cidade',5),
  ('vista','Parque','parque',6),
  ('vista','Área Verde','area-verde',7),

  ('posicao_predio','Frente','frente',1),
  ('posicao_predio','Fundos','fundos',2),
  ('posicao_predio','Lateral','lateral',3),
  ('posicao_predio','Esquina','esquina',4),
  ('posicao_predio','Interno','interno',5),

  ('infraestrutura','Piscina','piscina',1),
  ('infraestrutura','Academia','academia',2),
  ('infraestrutura','Salão de Festas','salao-de-festas',3),
  ('infraestrutura','Portaria 24h','portaria-24h',4),
  ('infraestrutura','Playground','playground',5),
  ('infraestrutura','Elevador','elevador',6),
  ('infraestrutura','Coworking','coworking',7),
  ('infraestrutura','Rooftop','rooftop',8),

  ('destaque_categoria','Sem Destaque','sem-destaque',1),
  ('destaque_categoria','Apartamentos','apartamentos',2),
  ('destaque_categoria','Casas','casas',3),
  ('destaque_categoria','Condomínios','condominios',4),
  ('destaque_categoria','Lotes Condomínio','lotes-condominio',5),
  ('destaque_categoria','Lotes Bairro','lotes-bairro',6),
  ('destaque_categoria','Decorados','decorados',7),
  ('destaque_categoria','Vista Mar','vista-mar',8),

  ('condicoes_pagamento','À Vista','a-vista',1),
  ('condicoes_pagamento','Financiamento Bancário','financiamento-bancario',2),
  ('condicoes_pagamento','FGTS','fgts',3),
  ('condicoes_pagamento','Consórcio','consorcio',4),
  ('condicoes_pagamento','Permuta','permuta',5),
  ('condicoes_pagamento','Dação','dacao',6),

  ('tipo_proprietario','Construtora','construtora',1),
  ('tipo_proprietario','Investidor','investidor',2),
  ('tipo_proprietario','Particular','particular',3),
  ('tipo_proprietario','Adm Comercial','adm-comercial',4),
  ('tipo_proprietario','Exclusividade','exclusividade',5),

  ('padrao_imovel','Econômico','economico',1),
  ('padrao_imovel','Médio Padrão','medio-padrao',2),
  ('padrao_imovel','Alto Padrão','alto-padrao',3),
  ('padrao_imovel','Luxo','luxo',4);
