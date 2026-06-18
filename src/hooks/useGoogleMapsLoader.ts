import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
let resolvedBrowserKey: string | null | undefined;

declare global {
  interface Window {
    __mvGoogleMapsReady?: boolean;
    __mvGoogleMapsPromise?: Promise<void>;
    __mvGoogleMapsCallback?: () => void;
  }
}

async function getGoogleMapsKey(): Promise<string | null> {
  if (BROWSER_KEY) return BROWSER_KEY;
  if (resolvedBrowserKey !== undefined) return resolvedBrowserKey;

  const { data, error } = await supabase
    .from("integration_settings" as any)
    .select("value")
    .eq("key", "google_maps_api_key")
    .maybeSingle();

  if (error) {
    console.error("[GoogleMaps] key lookup error", error);
    resolvedBrowserKey = null;
    return null;
  }

  resolvedBrowserKey = ((data as { value?: string | null } | null)?.value ?? "").trim() || null;
  return resolvedBrowserKey;
}

async function ensureGoogleMapsLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.maps?.Map) {
    window.__mvGoogleMapsReady = true;
    return Promise.resolve();
  }
  if (window.__mvGoogleMapsPromise) return window.__mvGoogleMapsPromise;

  const apiKey = await getGoogleMapsKey();
  if (!apiKey) {
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
      existing.addEventListener("load", () => window.__mvGoogleMapsCallback?.(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Google Maps")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=__mvGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });

  return window.__mvGoogleMapsPromise;
}

export function useGoogleMapsLoader() {
  const [ready, setReady] = useState<boolean>(() => typeof window !== "undefined" && !!window.__mvGoogleMapsReady);
  const [loading, setLoading] = useState<boolean>(() => typeof window === "undefined" || !window.__mvGoogleMapsReady);

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
