-- =========================================================
-- Helper: identificadores públicos com prefixo (dev_, bld_, typ_, unt_, med_)
-- =========================================================
CREATE OR REPLACE FUNCTION public.gen_public_id(p_prefix text)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT p_prefix || '_' || upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 24))
$$;

-- =========================================================
-- DEVELOPERS (construtoras / incorporadoras)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL DEFAULT public.gen_public_id('dev'),
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  cnpj text,
  website text,
  logo_url text,
  description text,
  phone text,
  email text,
  city text,
  state text,
  status text NOT NULL DEFAULT 'active',
  external_id text,
  external_source text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS developers_public_id_key ON public.developers(public_id);
CREATE INDEX IF NOT EXISTS developers_agency_idx ON public.developers(agency_id);
CREATE INDEX IF NOT EXISTS developers_name_idx ON public.developers(lower(name));
CREATE INDEX IF NOT EXISTS developers_updated_idx ON public.developers(updated_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developers TO authenticated;
GRANT ALL ON public.developers TO service_role;
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developers_select_auth" ON public.developers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "developers_write_staff" ON public.developers
  FOR ALL TO authenticated
  USING (public.is_admin_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = developers.agency_id AND i.owner_id = auth.uid()))
  WITH CHECK (public.is_admin_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = developers.agency_id AND i.owner_id = auth.uid()));

CREATE TRIGGER trg_developers_updated BEFORE UPDATE ON public.developers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Ajustes: developments (Building) e typologies
-- =========================================================
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS developer_id uuid REFERENCES public.developers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_id text;
UPDATE public.developments SET public_id = public.gen_public_id('bld') WHERE public_id IS NULL;
ALTER TABLE public.developments ALTER COLUMN public_id SET DEFAULT public.gen_public_id('bld');
CREATE UNIQUE INDEX IF NOT EXISTS developments_public_id_key ON public.developments(public_id);
CREATE INDEX IF NOT EXISTS developments_developer_idx ON public.developments(developer_id);
CREATE INDEX IF NOT EXISTS developments_city_idx ON public.developments(lower(city));
CREATE INDEX IF NOT EXISTS developments_updated_idx ON public.developments(updated_at);

ALTER TABLE public.typologies ADD COLUMN IF NOT EXISTS public_id text;
UPDATE public.typologies SET public_id = public.gen_public_id('typ') WHERE public_id IS NULL;
ALTER TABLE public.typologies ALTER COLUMN public_id SET DEFAULT public.gen_public_id('typ');
CREATE UNIQUE INDEX IF NOT EXISTS typologies_public_id_key ON public.typologies(public_id);
CREATE INDEX IF NOT EXISTS typologies_updated_idx ON public.typologies(updated_at);

-- =========================================================
-- Ajustes: units
-- =========================================================
ALTER TYPE public.unit_status ADD VALUE IF NOT EXISTS 'inactive';
ALTER TYPE public.unit_status ADD VALUE IF NOT EXISTS 'archived';

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS public_id text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS developer_id uuid REFERENCES public.developers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sharing_scope text NOT NULL DEFAULT 'agency',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS exclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sea_view boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS front_sea boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL;

UPDATE public.units SET public_id = public.gen_public_id('unt') WHERE public_id IS NULL;
ALTER TABLE public.units ALTER COLUMN public_id SET DEFAULT public.gen_public_id('unt');
CREATE UNIQUE INDEX IF NOT EXISTS units_public_id_key ON public.units(public_id);
CREATE INDEX IF NOT EXISTS units_reference_idx ON public.units(reference);
CREATE INDEX IF NOT EXISTS units_city_idx ON public.units(lower(city));
CREATE INDEX IF NOT EXISTS units_neighborhood_idx ON public.units(lower(neighborhood));
CREATE INDEX IF NOT EXISTS units_status_idx ON public.units(status);
CREATE INDEX IF NOT EXISTS units_price_idx ON public.units(price);
CREATE INDEX IF NOT EXISTS units_updated_idx ON public.units(updated_at);
CREATE INDEX IF NOT EXISTS units_sharing_idx ON public.units(sharing_scope);
CREATE INDEX IF NOT EXISTS units_dev_typ_idx ON public.units(development_id, typology_id);
CREATE INDEX IF NOT EXISTS units_developer_idx ON public.units(developer_id);

-- =========================================================
-- UNIT MEDIA / FEATURES / HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.unit_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL DEFAULT public.gen_public_id('med'),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'photo',
  url text NOT NULL,
  storage_path text,
  title text,
  position integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unit_media_public_id_key ON public.unit_media(public_id);
CREATE INDEX IF NOT EXISTS unit_media_unit_idx ON public.unit_media(unit_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_media TO authenticated;
GRANT ALL ON public.unit_media TO service_role;
ALTER TABLE public.unit_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_media_select_auth" ON public.unit_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "unit_media_write_staff" ON public.unit_media FOR ALL TO authenticated
  USING (public.is_admin_staff(auth.uid())) WITH CHECK (public.is_admin_staff(auth.uid()));
CREATE TRIGGER trg_unit_media_updated BEFORE UPDATE ON public.unit_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.unit_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, feature)
);
CREATE INDEX IF NOT EXISTS unit_features_unit_idx ON public.unit_features(unit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_features TO authenticated;
GRANT ALL ON public.unit_features TO service_role;
ALTER TABLE public.unit_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_features_select_auth" ON public.unit_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "unit_features_write_staff" ON public.unit_features FOR ALL TO authenticated
  USING (public.is_admin_staff(auth.uid())) WITH CHECK (public.is_admin_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.unit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  source text NOT NULL DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unit_history_unit_idx ON public.unit_history(unit_id, created_at DESC);
GRANT SELECT ON public.unit_history TO authenticated;
GRANT ALL ON public.unit_history TO service_role;
ALTER TABLE public.unit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_history_select_staff" ON public.unit_history FOR SELECT TO authenticated
  USING (public.is_admin_staff(auth.uid()));

-- =========================================================
-- API KEYS: ambiente, rate limit, campos permitidos, escopos
-- =========================================================
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS rate_limit_per_hour integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS field_scope text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_count bigint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON public.api_keys(key_hash);

CREATE TABLE IF NOT EXISTS public.api_key_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_key_id, scope)
);
CREATE INDEX IF NOT EXISTS api_key_scopes_key_idx ON public.api_key_scopes(api_key_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_key_scopes TO authenticated;
GRANT ALL ON public.api_key_scopes TO service_role;
ALTER TABLE public.api_key_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_key_scopes_admin" ON public.api_key_scopes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- API LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id uuid,
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'live',
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  error_code text,
  ip text,
  user_agent text,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_logs_created_idx ON public.api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_key_idx ON public.api_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_status_idx ON public.api_logs(status_code);
GRANT SELECT ON public.api_logs TO authenticated;
GRANT ALL ON public.api_logs TO service_role;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_logs_select_admin" ON public.api_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- =========================================================
-- LEADS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL DEFAULT public.gen_public_id('led'),
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  message text,
  source text NOT NULL DEFAULT 'api',
  status text NOT NULL DEFAULT 'new',
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_public_id_key ON public.leads(public_id);
CREATE INDEX IF NOT EXISTS leads_unit_idx ON public.leads(unit_id);
CREATE INDEX IF NOT EXISTS leads_agency_idx ON public.leads(agency_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_staff_all" ON public.leads FOR ALL TO authenticated
  USING (public.is_admin_staff(auth.uid())) WITH CHECK (public.is_admin_staff(auth.uid()));
CREATE POLICY "leads_agency_select" ON public.leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = leads.agency_id AND i.owner_id = auth.uid()));
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();