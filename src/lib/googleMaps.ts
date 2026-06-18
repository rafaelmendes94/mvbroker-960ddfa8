import { supabase } from "@/integrations/supabase/client";

const ENV_BROWSER_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

declare global {
  interface Window {
    google?: any;
    __mvGoogleMapsReady?: boolean;
    __mvGoogleMapsPromise?: Promise<void>;
    __mvGoogleMapsCallback?: () => void;
  }
}

let keyPromise: Promise<string | null> | null = null;

export function getGoogleMapsBrowserKey(): Promise<string | null> {
  if (ENV_BROWSER_KEY) return Promise.resolve(ENV_BROWSER_KEY);
  if (typeof window === "undefined") return Promise.resolve(null);

  if (!keyPromise) {
    keyPromise = (async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("value")
        .eq("key", "google_maps_api_key")
        .maybeSingle();

        if (error) {
          console.error("[GoogleMaps] key lookup error", error);
          return null;
        }
        return data?.value?.trim() || null;
    })();
  }

  return keyPromise ?? Promise.resolve(null);
}

export async function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.google?.maps?.Map) {
    window.__mvGoogleMapsReady = true;
    return;
  }
  if (window.__mvGoogleMapsPromise) return window.__mvGoogleMapsPromise;

  const apiKey = await getGoogleMapsBrowserKey();
  if (!apiKey) throw new Error("Google Maps key não configurada");

  window.__mvGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    window.__mvGoogleMapsCallback = async () => {
      try {
        if (window.google?.maps?.importLibrary) {
          await Promise.all([
            window.google.maps.importLibrary("maps"),
            window.google.maps.importLibrary("marker").catch(() => null),
            window.google.maps.importLibrary("geocoding").catch(() => null),
            window.google.maps.importLibrary("places").catch(() => null),
          ]);
        }
        window.__mvGoogleMapsReady = true;
        resolve();
      } catch (e) {
        window.__mvGoogleMapsPromise = undefined;
        reject(e as Error);
      }
    };

    const existing = document.querySelector('script[data-google-maps-loader]') as HTMLScriptElement | null;
    if (existing) return;

    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      libraries: "places",
      callback: "__mvGoogleMapsCallback",
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => {
      window.__mvGoogleMapsPromise = undefined;
      reject(new Error("Falha ao carregar Google Maps"));
    };
    document.head.appendChild(script);
  });

  return window.__mvGoogleMapsPromise;
}