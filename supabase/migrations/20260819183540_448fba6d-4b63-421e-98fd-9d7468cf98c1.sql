-- =========================================================
-- MV Broker API v1 — Fase 3
-- developments / typologies / units / offers
-- Nada existente é alterado ou removido.
-- =========================================================

CREATE TYPE public.development_type AS ENUM ('edificio','condominio','loteamento','empreendimento','avulso');
CREATE TYPE public.offer_transaction_type AS ENUM ('sale','rent','sale_rent','season');
CREATE TYPE public.offer_status AS ENUM ('available','reserved','sold','rented','suspended');
CREATE TYPE public.unit_status AS ENUM ('available','reserved','sold','rented','unavailable');

-- ---------------------------------------------------------
-- DEVELOPMENTS
-- ---------------------------------------------------------
CREATE TABLE public.developments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  type public.development_type NOT NULL DEFAULT 'empreendimento',
  description text,
  developer text,
  construction_company text,
  address text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'BR',
  zipcode text,
  latitude numeric,
  longitude numeric,
  delivery_date date,
  construction_status text,
  total_units integer,
  amenities text[] NOT NULL DEFAULT '{}',
  infrastructure text[] NOT NULL DEFAULT '{}',
  cover_image text,
  material_url text,
  status text NOT NULL DEFAULT 'active',
  legacy_table text,
  legacy_id uuid,
  external_id text,
  external_source text,
  last_sync_at timestamptz,
  sync_status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX developments_legacy_uniq ON public.developments (legacy_table, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX developments_external_uniq ON public.developments (external_source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX developments_agency_city_idx ON public.developments (agency_id, city);
CREATE INDEX developments_name_idx ON public.developments (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developments TO authenticated;
GRANT ALL ON public.developments TO service_role;
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developments_select_auth" ON public.developments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "developments_write_staff" ON public.developments
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = developments.agency_id AND i.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = developments.agency_id AND i.owner_id = auth.uid())
  );

-- ---------------------------------------------------------
-- TYPOLOGIES
-- ---------------------------------------------------------
CREATE TABLE public.typologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  name text NOT NULL,
  property_type text,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spaces integer,
  private_area numeric,
  total_area numeric,
  built_area numeric,
  land_area numeric,
  description text,
  floorplan text,
  external_id text,
  external_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX typologies_development_idx ON public.typologies (development_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.typologies TO authenticated;
GRANT ALL ON public.typologies TO service_role;
ALTER TABLE public.typologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typologies_select_auth" ON public.typologies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "typologies_write_staff" ON public.typologies
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = typologies.agency_id AND i.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = typologies.agency_id AND i.owner_id = auth.uid())
  );

-- ---------------------------------------------------------
-- UNITS
-- ---------------------------------------------------------
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  typology_id uuid REFERENCES public.typologies(id) ON DELETE SET NULL,
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  unit_number text,
  tower text,
  block text,
  lot text,
  floor integer,
  orientation text,
  solar_position text,
  private_area numeric,
  total_area numeric,
  built_area numeric,
  land_area numeric,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spaces integer,
  box text,
  storage boolean NOT NULL DEFAULT false,
  furnished boolean NOT NULL DEFAULT false,
  decorated boolean NOT NULL DEFAULT false,
  status public.unit_status NOT NULL DEFAULT 'available',
  delivery_date date,
  legacy_imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  external_id text,
  external_source text,
  last_sync_at timestamptz,
  sync_status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX units_legacy_imovel_uniq ON public.units (legacy_imovel_id) WHERE legacy_imovel_id IS NOT NULL;
CREATE INDEX units_development_typology_idx ON public.units (development_id, typology_id);
CREATE INDEX units_status_idx ON public.units (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_auth" ON public.units
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_write_staff" ON public.units
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = units.agency_id AND i.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = units.agency_id AND i.owner_id = auth.uid())
  );

-- ---------------------------------------------------------
-- OFFERS
-- ---------------------------------------------------------
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL,
  transaction_type public.offer_transaction_type NOT NULL DEFAULT 'sale',
  sale_price numeric,
  previous_price numeric,
  promotional_price numeric,
  rent_price numeric,
  condo_fee numeric,
  property_tax numeric,
  status public.offer_status NOT NULL DEFAULT 'available',
  exclusive boolean NOT NULL DEFAULT false,
  commission_percentage numeric,
  commission_value numeric,
  accepts_vehicle boolean NOT NULL DEFAULT false,
  accepts_property_exchange boolean NOT NULL DEFAULT false,
  accepts_financing boolean NOT NULL DEFAULT false,
  accepts_installments boolean NOT NULL DEFAULT false,
  down_payment numeric,
  installments integer,
  annual_reinforcements text,
  monthly_correction text,
  incc boolean NOT NULL DEFAULT false,
  payment_conditions text[] NOT NULL DEFAULT '{}',
  bonus text,
  internal_notes text,
  public_notes text,
  available_from date,
  legacy_imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  external_id text,
  external_source text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offers_unit_status_idx ON public.offers (unit_id, status);
CREATE INDEX offers_agency_idx ON public.offers (agency_id);
CREATE UNIQUE INDEX offers_legacy_imovel_uniq ON public.offers (legacy_imovel_id) WHERE legacy_imovel_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_select_auth" ON public.offers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "offers_write_staff" ON public.offers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = offers.agency_id AND i.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'secretaria')
    OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = offers.agency_id AND i.owner_id = auth.uid())
  );

-- ---------------------------------------------------------
-- Triggers: updated_at + histórico de preço
-- ---------------------------------------------------------
CREATE TRIGGER trg_developments_updated BEFORE UPDATE ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_typologies_updated BEFORE UPDATE ON public.typologies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.tg_offers_price_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
    NEW.previous_price := OLD.sale_price;
    INSERT INTO public.audit_logs (usuario_id, modulo, acao, registro_tipo, registro_id, dados_anteriores, dados_novos, status)
    VALUES (auth.uid(), 'offers', 'preco_alterado', 'offers', NEW.id,
            jsonb_build_object('sale_price', OLD.sale_price),
            jsonb_build_object('sale_price', NEW.sale_price), 'sucesso');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offers_price_history BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.tg_offers_price_history();