import { useEffect, useState } from "react";
import { getGoogleMapsBrowserKey } from "@/lib/googleMaps";

export function useGoogleMapsKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getGoogleMapsBrowserKey()
      .then((key) => {
        if (!cancelled) setApiKey(key);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { apiKey, loading };
}
