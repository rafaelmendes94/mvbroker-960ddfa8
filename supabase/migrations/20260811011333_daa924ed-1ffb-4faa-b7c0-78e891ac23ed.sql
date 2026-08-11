CREATE TABLE public.solicitacoes_cadastro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  creci text,
  cidade text,
  status text NOT NULL DEFAULT 'pendente',
  motivo_recusa text,
  aprovado_por uuid,
  aprovado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT solicitacoes_cadastro_status_chk CHECK (status IN ('pendente','aprovado','recusado'))
);

GRANT SELECT ON public.solicitacoes_cadastro TO authenticated;
GRANT UPDATE ON public.solicitacoes_cadastro TO authenticated;
GRANT ALL ON public.solicitacoes_cadastro TO service_role;

ALTER TABLE public.solicitacoes_cadastro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sua solicitacao"
  ON public.solicitacoes_cadastro FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin ve todas solicitacoes"
  ON public.solicitacoes_cadastro FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Admin atualiza solicitacoes"
  ON public.solicitacoes_cadastro FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE TRIGGER trg_solicitacoes_cadastro_updated
  BEFORE UPDATE ON public.solicitacoes_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_solicitacoes_cadastro_status ON public.solicitacoes_cadastro (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_minha_solicitacao()
RETURNS TABLE(status text, motivo_recusa text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.status, s.motivo_recusa, s.created_at
  FROM public.solicitacoes_cadastro s
  WHERE s.user_id = auth.uid()
  LIMIT 1
$$;