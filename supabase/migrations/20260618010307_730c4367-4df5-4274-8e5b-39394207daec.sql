CREATE POLICY "Authenticated users can read Google Maps browser key"
ON public.integration_settings
FOR SELECT
TO authenticated
USING (key = 'google_maps_api_key');