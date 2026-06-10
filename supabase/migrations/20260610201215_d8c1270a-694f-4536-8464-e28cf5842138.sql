
-- Helper: is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

-- Default new user role: corretor_autonomo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'corretor_autonomo');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Imobiliarias
CREATE TABLE public.imobiliarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_fantasia text NOT NULL,
  razao_social text,
  cnpj text UNIQUE,
  telefone text,
  email text,
  site text,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imobiliarias TO authenticated;
GRANT ALL ON public.imobiliarias TO service_role;
ALTER TABLE public.imobiliarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view imobiliarias" ON public.imobiliarias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manages imobiliarias" ON public.imobiliarias
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Imobiliaria owner updates own" ON public.imobiliarias
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_imobiliarias_updated
BEFORE UPDATE ON public.imobiliarias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Corretores
CREATE TABLE public.corretores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imobiliaria_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  creci text,
  email text,
  telefone text,
  whatsapp text,
  foto_url text,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretores TO authenticated;
GRANT ALL ON public.corretores TO service_role;
ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view corretores" ON public.corretores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manages corretores" ON public.corretores
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Imobiliaria manages its corretores" ON public.corretores
  FOR ALL TO authenticated
  USING (imobiliaria_id IN (SELECT id FROM public.imobiliarias WHERE owner_id = auth.uid()))
  WITH CHECK (imobiliaria_id IN (SELECT id FROM public.imobiliarias WHERE owner_id = auth.uid()));
CREATE POLICY "Corretor updates own profile" ON public.corretores
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_corretores_updated
BEFORE UPDATE ON public.corretores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auditoria de acessos
CREATE TABLE public.auditoria_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evento text NOT NULL,
  descricao text,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auditoria_acessos TO authenticated;
GRANT ALL ON public.auditoria_acessos TO service_role;
ALTER TABLE public.auditoria_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own audit" ON public.auditoria_acessos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own audit" ON public.auditoria_acessos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admin reads all audit" ON public.auditoria_acessos
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE INDEX idx_corretores_imobiliaria ON public.corretores(imobiliaria_id);
CREATE INDEX idx_auditoria_user ON public.auditoria_acessos(user_id);
CREATE INDEX idx_auditoria_created ON public.auditoria_acessos(created_at DESC);
