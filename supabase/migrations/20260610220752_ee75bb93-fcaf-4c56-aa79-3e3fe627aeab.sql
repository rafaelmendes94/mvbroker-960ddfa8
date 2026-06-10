
-- ================= audit_logs =================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  perfil TEXT,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  registro_tipo TEXT,
  registro_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'sucesso',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_usuario ON public.audit_logs (usuario_id, created_at DESC);
CREATE INDEX idx_audit_logs_modulo ON public.audit_logs (modulo, acao);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_super_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "audit_logs_insert_any_auth" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ================= security_alerts =================
CREATE TABLE public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL DEFAULT 'media',
  usuario_id UUID,
  descricao TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_alerts_created_at ON public.security_alerts (created_at DESC);
CREATE INDEX idx_security_alerts_status ON public.security_alerts (status);

GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_alerts_super_admin_all" ON public.security_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "security_alerts_insert_auth" ON public.security_alerts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ================= active_sessions =================
CREATE TABLE public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  ip TEXT,
  user_agent TEXT,
  device TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_active_sessions_usuario ON public.active_sessions (usuario_id);
CREATE INDEX idx_active_sessions_last_seen ON public.active_sessions (last_seen DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_sessions TO authenticated;
GRANT ALL ON public.active_sessions TO service_role;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_sessions_own_or_admin_select" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "active_sessions_own_insert" ON public.active_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "active_sessions_own_or_admin_update" ON public.active_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "active_sessions_own_or_admin_delete" ON public.active_sessions
  FOR DELETE TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'super_admin'));

-- ================= trigger: audit imoveis & carteiras =================
CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao TEXT;
  v_old JSONB;
  v_new JSONB;
  v_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criacao';
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'atualizacao';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'exclusao';
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs
    (usuario_id, modulo, acao, registro_tipo, registro_id, dados_anteriores, dados_novos, status)
  VALUES
    (auth.uid(), TG_TABLE_NAME, v_acao, TG_TABLE_NAME, v_id, v_old, v_new, 'sucesso');

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_audit_imoveis
AFTER INSERT OR UPDATE OR DELETE ON public.imoveis
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

CREATE TRIGGER trg_audit_carteiras
AFTER INSERT OR UPDATE OR DELETE ON public.carteiras
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
