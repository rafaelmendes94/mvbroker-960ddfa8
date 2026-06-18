import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ENV_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function useGoogleMapsKey() {
  const [apiKey, setApiKey] = useState<string | null>(ENV_KEY || null);
  const [loading, setLoading] = useState(!ENV_KEY);

  useEffect(() => {
    if (ENV_KEY) return;
    let cancelled = false;

    supabase
      .from("integration_settings" as any)
      .select("value")
      .eq("key", "google_maps_api_key")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[GoogleMaps] key lookup error", error);
        setApiKey(((data as { value?: string | null } | null)?.value ?? "").trim() || null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { apiKey, loading };
}
