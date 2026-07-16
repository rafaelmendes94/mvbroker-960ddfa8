import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Loader2 } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { toast } from "sonner";

type Suggestion = { placeId: string; text: string };

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
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  function placeMarker(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map || !window.google) return;
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new window.google.maps.Marker({ position: { lat, lng }, map, draggable: true });
    markerRef.current.addListener("dragend", (ev: any) => onChange(ev.latLng.lat(), ev.latLng.lng()));
    onChange(lat, lng);
  }

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
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
        placeMarker(e.latLng.lat(), e.latLng.lng());
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

  // Debounced autocomplete via Places API (New)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = search.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        await loadGoogleMaps();
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          await window.google.maps.importLibrary("places");
        if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
        const { suggestions: sug } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ["br"],
        });
        const list: Suggestion[] = (sug ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({
            placeId: p.placeId,
            text: p.text?.text ?? (typeof p.text === "string" ? p.text : ""),
          }));
        setSuggestions(list);
        setOpen(true);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [search]);

  async function pickSuggestion(s: Suggestion) {
    try {
      const { Place } = await window.google.maps.importLibrary("places");
      const place = new Place({ id: s.placeId, requestedLanguage: "pt-BR" });
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const loc = place.location;
      if (!loc) return;
      const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
      const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(17);
      placeMarker(lat, lng);
      setSearch(place.formattedAddress ?? s.text);
      setOpen(false);
      sessionTokenRef.current = null;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar endereço no mapa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="pl-9"
          />
          {searching && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-auto">
            {suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
            onClick={() => { onChange(null, null); if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; } setSearch(""); setSuggestions([]); }}
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
        <div ref={ref} className="h-[520px] w-full rounded-md border bg-muted" />
      )}
      <p className="text-xs text-muted-foreground">Busque pelo endereço acima, clique no mapa ou arraste o marcador para ajustar.</p>
    </div>
  );
}
