// Browser-safe Google Maps key fornecida pelo conector oficial da Lovable.
// É uma chave restrita por referrer (*.lovable.app / *.lovableproject.com),
// portanto pode ser usada diretamente no client sem passar por edge function.
export function useGoogleMapsKey() {
  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  return { apiKey: apiKey || null, loading: false };
}
