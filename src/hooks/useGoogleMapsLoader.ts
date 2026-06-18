import { useEffect, useState } from "react";

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

declare global {
  interface Window {
    __mvGoogleMapsReady?: boolean;
    __mvGoogleMapsPromise?: Promise<void>;
    __mvGoogleMapsCallback?: () => void;
  }
}

function ensureGoogleMapsLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__mvGoogleMapsReady && (window as any).google?.maps?.Map) {
    return Promise.resolve();
  }
  if (window.__mvGoogleMapsPromise) return window.__mvGoogleMapsPromise;

  if (!BROWSER_KEY) {
    return Promise.reject(new Error("Google Maps browser key não configurada"));
  }

  window.__mvGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    window.__mvGoogleMapsCallback = async () => {
      try {
        const g = (window as any).google;
        if (g?.maps?.importLibrary) {
          await Promise.all([
            g.maps.importLibrary("maps"),
            g.maps.importLibrary("marker").catch(() => null),
            g.maps.importLibrary("geocoding").catch(() => null),
          ]);
        }
        window.__mvGoogleMapsReady = true;
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    };

    const existing = document.querySelector('script[data-google-maps-loader]') as HTMLScriptElement | null;
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__mvGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });

  return window.__mvGoogleMapsPromise;
}

export function useGoogleMapsLoader() {
  const [ready, setReady] = useState<boolean>(() => !!window.__mvGoogleMapsReady);
  const [loading, setLoading] = useState<boolean>(() => !window.__mvGoogleMapsReady);

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
