import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

declare global {
  interface Window {
    __lovableGoogleMapsCallback?: () => void;
    __lovableGoogleMapsReady?: boolean;
    __lovableGoogleMapsPromise?: Promise<void>;
    __lovableGoogleMapsKey?: string | null;
  }
}

async function resolveBrowserKey(): Promise<string | null> {
  // Em produção (VPS / domínio custom) o conector da Lovable não existe,
  // então buscamos a chave salva pelo usuário em Integrações.
  if (BROWSER_KEY) return BROWSER_KEY;
  if (window.__lovableGoogleMapsKey !== undefined) return window.__lovableGoogleMapsKey;
  try {
    const { data, error } = await supabase
      .from("integration_settings" as any)
      .select("value")
      .eq("key", "google_maps_api_key")
      .maybeSingle();
    if (error) throw error;
    const key = ((data as any)?.value as string | undefined)?.trim() || null;
    window.__lovableGoogleMapsKey = key;
    return key;
  } catch (e) {
    console.error("[GoogleMaps] não foi possível buscar chave externa", e);
    window.__lovableGoogleMapsKey = null;
    return null;
  }
}

function ensureGoogleMapsLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__lovableGoogleMapsReady && (window as any).google?.maps?.Map) {
    return Promise.resolve();
  }
  if (window.__lovableGoogleMapsPromise) return window.__lovableGoogleMapsPromise;

  window.__lovableGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    (async () => {
      const key = await resolveBrowserKey();
      if (!key) {
        reject(new Error("Google Maps API key não configurada. Defina em Configurações → Integrações."));
        return;
      }

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
      if (existing) return;

      const channelParam = TRACKING_ID ? `&channel=${TRACKING_ID}` : "";
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__lovableGoogleMapsCallback${channelParam}`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = "true";
      script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
      document.head.appendChild(script);
    })().catch(reject);
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
