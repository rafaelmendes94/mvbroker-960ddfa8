INSERT INTO public.integration_settings (key, value)
SELECT 'google_maps_browser_key', s.value
FROM public.integration_settings s
WHERE s.key = 'google_maps_api_key'
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can read Google Maps browser key" ON public.integration_settings;

CREATE POLICY "Authenticated users can read Google Maps browser key"
ON public.integration_settings
FOR SELECT
TO authenticated
USING (key = 'google_maps_browser_key');