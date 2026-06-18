import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

export function useGoogleMapsLoader() {
  const [ready, setReady] = useState<boolean>(() => typeof window !== "undefined" && !!window.__mvGoogleMapsReady);
  const [loading, setLoading] = useState<boolean>(() => typeof window === "undefined" || !window.__mvGoogleMapsReady);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
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
