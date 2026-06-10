
-- CARTEIRAS
CREATE TABLE public.carteiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ativa',
  atualizacao_intervalo TEXT NOT NULL DEFAULT 'on_demand',
  ultima_atualizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carteiras TO authenticated;
GRANT ALL ON public.carteiras TO service_role;
ALTER TABLE public.carteiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas próprias carteiras"
  ON public.carteiras FOR ALL
  USING (auth.uid() = usuario_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = usuario_id OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_carteiras_updated_at
  BEFORE UPDATE ON public.carteiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CARTEIRA_IMOVEIS
CREATE TABLE public.carteira_imoveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carteira_id UUID NOT NULL REFERENCES public.carteiras(id) ON DELETE CASCADE,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (carteira_id, imovel_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carteira_imoveis TO authenticated;
GRANT ALL ON public.carteira_imoveis TO service_role;
ALTER TABLE public.carteira_imoveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam itens das suas carteiras"
  ON public.carteira_imoveis FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.carteiras c
    WHERE c.id = carteira_imoveis.carteira_id
      AND (c.usuario_id = auth.uid() OR public.is_super_admin(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.carteiras c
    WHERE c.id = carteira_imoveis.carteira_id
      AND (c.usuario_id = auth.uid() OR public.is_super_admin(auth.uid()))
  ));

CREATE INDEX idx_carteira_imoveis_carteira ON public.carteira_imoveis(carteira_id);
CREATE INDEX idx_carteira_imoveis_imovel ON public.carteira_imoveis(imovel_id);

-- FEED_LOGS
CREATE TABLE public.feed_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carteira_id UUID NOT NULL REFERENCES public.carteiras(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  detalhes JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feed_logs TO authenticated;
GRANT ALL ON public.feed_logs TO service_role;
ALTER TABLE public.feed_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donos da carteira veem seus logs"
  ON public.feed_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.carteiras c
    WHERE c.id = feed_logs.carteira_id
      AND (c.usuario_id = auth.uid() OR public.is_super_admin(auth.uid()))
  ));

CREATE INDEX idx_feed_logs_carteira ON public.feed_logs(carteira_id, created_at DESC);
