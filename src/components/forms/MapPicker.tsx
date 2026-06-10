import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

declare global {
  interface Window {
    google?: any;
    __mvBrokerInitMap?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loadingPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps key não configurada"));
  loadingPromise = new Promise((resolve, reject) => {
    window.__mvBrokerInitMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__mvBrokerInitMap${CHANNEL ? `&channel=${CHANNEL}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return loadingPromise;
}

export function MapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current || !window.google) return;
      const center = { lat: latitude ?? -23.5505, lng: longitude ?? -46.6333 };
      const map = new window.google.maps.Map(ref.current, {
        center, zoom: latitude && longitude ? 16 : 11,
        streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
      });
      mapRef.current = map;
      if (latitude && longitude) {
        markerRef.current = new window.google.maps.Marker({ position: center, map, draggable: true });
        markerRef.current.addListener("dragend", (e: any) => {
          onChange(e.latLng.lat(), e.latLng.lng());
        });
      }
      map.addListener("click", (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new window.google.maps.Marker({ position: { lat, lng }, map, draggable: true });
        markerRef.current.addListener("dragend", (ev: any) => onChange(ev.latLng.lat(), ev.latLng.lng()));
        onChange(lat, lng);
      });
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker when value changes externally
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (latitude && longitude) {
      const pos = { lat: latitude, lng: longitude };
      if (markerRef.current) markerRef.current.setPosition(pos);
      else {
        markerRef.current = new window.google.maps.Marker({ position: pos, map: mapRef.current, draggable: true });
        markerRef.current.addListener("dragend", (ev: any) => onChange(ev.latLng.lat(), ev.latLng.lng()));
      }
      mapRef.current.panTo(pos);
    }
  }, [latitude, longitude, onChange]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Latitude</Label>
          <Input
            type="number" step="any"
            value={latitude ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null, longitude)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Longitude</Label>
          <Input
            type="number" step="any"
            value={longitude ?? ""}
            onChange={(e) => onChange(latitude, e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => { onChange(null, null); if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; } }}
          >
            <MapPin className="h-4 w-4 mr-1.5" /> Limpar
          </Button>
        </div>
      </div>
      {err ? (
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          Mapa indisponível: {err}. Use os campos de latitude/longitude acima.
        </div>
      ) : (
        <div ref={ref} className="h-72 w-full rounded-md border bg-muted" />
      )}
      <p className="text-xs text-muted-foreground">Clique no mapa para marcar a localização. Arraste o marcador para ajustar.</p>
    </div>
  );
}
