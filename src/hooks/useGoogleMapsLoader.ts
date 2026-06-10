import { useEffect, useState } from "react";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

declare global {
  interface Window {
    __lovableGoogleMapsCallback?: () => void;
    __lovableGoogleMapsReady?: boolean;
    __lovableGoogleMapsPromise?: Promise<void>;
  }
}

function ensureGoogleMapsLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__lovableGoogleMapsReady && (window as any).google?.maps?.Map) {
    return Promise.resolve();
  }
  if (window.__lovableGoogleMapsPromise) return window.__lovableGoogleMapsPromise;

  if (!BROWSER_KEY) {
    return Promise.reject(new Error("Google Maps browser key não configurada"));
  }

  window.__lovableGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    window.__lovableGoogleMapsCallback = async () => {
      try {
        const g = (window as any).google;
        if (g?.maps?.importLibrary) {
          await Promise.all([
            g.maps.importLibrary("maps"),
            g.maps.importLibrary("marker").catch(() => null),
            g.maps.importLibrary("geocoding").catch(() => null),
          ]);
        }
        window.__lovableGoogleMapsReady = true;
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    };

    const existing = document.querySelector('script[data-google-maps-loader]') as HTMLScriptElement | null;
    if (existing) {
      // Script tag exists; assume callback will fire when ready.
      return;
    }

    const channelParam = TRACKING_ID ? `&channel=${TRACKING_ID}` : "";
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__lovableGoogleMapsCallback${channelParam}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });

  return window.__lovableGoogleMapsPromise;
}

export function useGoogleMapsLoader() {
  const [ready, setReady] = useState<boolean>(() => !!window.__lovableGoogleMapsReady);
  const [loading, setLoading] = useState<boolean>(() => !window.__lovableGoogleMapsReady);

  useEffect(() => {
    let cancelled = false;
    ensureGoogleMapsLoaded()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[GoogleMaps] load error", err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, loading };
}
