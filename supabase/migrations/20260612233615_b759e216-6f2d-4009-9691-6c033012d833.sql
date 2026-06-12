
CREATE TABLE public.integration_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages integration settings"
  ON public.integration_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_integration_settings_updated
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.integration_settings (key, value) VALUES
  ('google_maps_api_key', NULL),
  ('gemini_api_key', NULL),
  ('resend_api_key', NULL),
  ('resend_from_email', NULL),
  ('resend_from_name', NULL)
ON CONFLICT (key) DO NOTHING;
