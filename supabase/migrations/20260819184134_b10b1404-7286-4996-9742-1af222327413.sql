-- ============ API KEYS ============
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  last_used_at timestamptz,
  rate_limit integer NOT NULL DEFAULT 600,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_agency ON public.api_keys(agency_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select" ON public.api_keys FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = api_keys.agency_id AND i.owner_id = auth.uid())
);
CREATE POLICY "api_keys_insert" ON public.api_keys FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = api_keys.agency_id AND i.owner_id = auth.uid())
);
CREATE POLICY "api_keys_update" ON public.api_keys FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = api_keys.agency_id AND i.owner_id = auth.uid())
);
CREATE POLICY "api_keys_delete" ON public.api_keys FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = api_keys.agency_id AND i.owner_id = auth.uid())
);

CREATE TRIGGER trg_api_keys_updated BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WEBHOOKS ============
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.imobiliarias(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_agency ON public.webhooks(agency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_select" ON public.webhooks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = webhooks.agency_id AND i.owner_id = auth.uid())
);
CREATE POLICY "webhooks_insert" ON public.webhooks FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = webhooks.agency_id AND i.owner_id = auth.uid())
);
CREATE POLICY "webhooks_update" ON public.webhooks FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = webhooks.agency_id AND i.owner_id = auth.uid())
);
CREATE POLICY "webhooks_delete" ON public.webhooks FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (SELECT 1 FROM public.imobiliarias i WHERE i.id = webhooks.agency_id AND i.owner_id = auth.uid())
);

CREATE TRIGGER trg_webhooks_updated BEFORE UPDATE ON public.webhooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WEBHOOK DELIVERIES ============
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  response_status integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_select" ON public.webhook_deliveries FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.webhooks w
    JOIN public.imobiliarias i ON i.id = w.agency_id
    WHERE w.id = webhook_deliveries.webhook_id AND i.owner_id = auth.uid()
  )
);