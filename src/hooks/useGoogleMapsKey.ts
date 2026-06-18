export function useGoogleMapsKey() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  return { apiKey: apiKey || null, loading: false };
}
