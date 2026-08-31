import { useEffect, useMemo, useRef, useState } from "react";
import { Property, formatCurrency } from "@/data/mockData";
import { useGoogleMapsLoader } from "@/hooks/useGoogleMapsLoader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, LocateFixed, MapPin, BedDouble, Bath, Car, Ruler } from "lucide-react";

interface PropertyMapProps {
  properties: Property[];
  onSelectProperty?: (property: Property) => void;
}

function formatShortPrice(price: number): string {
  if (price >= 1000000) return `${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1)}M`;
  if (price >= 1000) return `${(price / 1000).toFixed(0)}K`;
  return String(price);
}

const typeConfig: Record<string, { emoji: string; color: string; label: string }> = {
  Apartamento: { emoji: "🏢", color: "#22c55e", label: "Apartamento" },
  Casa: { emoji: "🏠", color: "#16a34a", label: "Casa" },
  Comercial: { emoji: "🏪", color: "#4ade80", label: "Comercial" },
  Terreno: { emoji: "🌳", color: "#86efac", label: "Terreno" },
  Lote: { emoji: "📐", color: "#86efac", label: "Lote" },
  Cobertura: { emoji: "🏙️", color: "#10b981", label: "Cobertura" },
  Sobrado: { emoji: "🏡", color: "#6b7280", label: "Sobrado" },
  Kitnet: { emoji: "🛏️", color: "#6b7280", label: "Kitnet" },
  Sala: { emoji: "💼", color: "#6b7280", label: "Sala" },
  Loja: { emoji: "🛒", color: "#6b7280", label: "Loja" },
  Galpão: { emoji: "🏭", color: "#6b7280", label: "Galpão" },
  Condomínio: { emoji: "🏘️", color: "#6b7280", label: "Condomínio" },
};

const defaultCfg = { emoji: "📍", color: "#6b7280", label: "Outro" };

const DARK_MAP_STYLES: any[] = [
  { elementType: "geometry", stylers: [{ color: "#111111" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0b" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#12291d" }, { visibility: "on" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#111111" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c1c1c" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b0f0d" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3f5148" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a2a2a" }] },
];

function cfgOf(type: string) {
  return typeConfig[type] || defaultCfg;
}


function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

function priceIcon(maps: any, _color: string, price: number, selected: boolean) {
  const label = formatShortPrice(price);
  const w = selected ? 90 : 72;
  const h = selected ? 44 : 34;
  const boxH = selected ? 28 : 22;
  const fill = selected ? "#22c55e" : "#0f0f0f";
  const stroke = selected ? "#ffffff" : "#22c55e";
  const strokeW = selected ? 2.5 : 1.5;
  const textFill = selected ? "#0a0a0a" : "#22c55e";
  const font = selected ? 13 : 12;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
      <rect x="2" y="2" width="${w - 4}" height="${boxH}" rx="${boxH / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />
      <path d="M${w / 2 - 5} ${boxH + 2}H${w / 2 + 5}L${w / 2} ${h}L${w / 2 - 5} ${boxH + 2}Z" fill="${fill}" />
      <text x="${w / 2}" y="${boxH / 2 + 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${font}" font-weight="700" fill="${textFill}">${label}</text>
    </svg>`.trim();
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(w, h),
    anchor: new maps.Point(w / 2, h),
  };
}

function popupHtml(property: Property, color: string) {
  return `
    <div style="width:135px;font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;border:1px solid #22c55e33;border-radius:12px;overflow:hidden;">
      <img src="${property.image}" alt="" style="width:100%;height:70px;object-fit:cover;display:block;" />
      <div style="padding:6px 8px 8px 8px;">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">
          <span style="font-size:9px;font-weight:700;color:#0a0a0a;background:${color};padding:1px 5px;border-radius:3px;text-transform:uppercase;">${property.type}</span>
          <span style="font-size:9px;color:#9ca3af;">${property.status}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:#f5f5f5;line-height:1.25;">${property.title}</div>
        <div style="font-size:9px;color:#9ca3af;margin:2px 0;">📍 ${[property.neighborhood, property.city].filter(Boolean).join(" – ")}</div>
        <div style="display:flex;gap:5px;font-size:9px;color:#9ca3af;margin-bottom:3px;">
          ${property.bedrooms > 0 ? `<span>🛏 ${property.bedrooms}</span>` : ""}
          ${property.bathrooms > 0 ? `<span>🚿 ${property.bathrooms}</span>` : ""}
          ${property.parking > 0 ? `<span>🚗 ${property.parking}</span>` : ""}
          ${property.area > 0 ? `<span>📐 ${property.area}m²</span>` : ""}
        </div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:4px;">
          <span style="font-size:12px;font-weight:800;color:#22c55e;">${formatCurrency(property.price)}</span>
          <span id="gmaps-detail-${property.id}" style="font-size:9px;color:#22c55e;cursor:pointer;font-weight:700;text-decoration:underline;">Ver →</span>
        </div>
      </div>
    </div>`;
}


export function PropertyMap({ properties, onSelectProperty }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const { ready, loading, error } = useGoogleMapsLoader();

  const valid = useMemo(
    () =>
      properties.filter(
        (p) =>
          Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
          Math.abs(p.lat) > 0.001 && Math.abs(p.lng) > 0.001 &&
          Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180,
      ),
    [properties],
  );

  const reference = userLocation || mapCenter || (valid[0] ? { lat: valid[0].lat, lng: valid[0].lng } : null);

  const sorted = useMemo(() => {
    if (!reference) return valid;
    return [...valid]
      .map((p) => ({ p, d: distanceKm(reference.lat, reference.lng, p.lat, p.lng) }))
      .sort((a, b) => a.d - b.d)
      .map(({ p, d }) => ({ ...p, __d: d }) as Property & { __d: number });
  }, [valid, reference?.lat, reference?.lng]);

  const setMarkerIcon = (id: string, selected: boolean) => {
    const maps = (window as any).google?.maps;
    const marker = markersRef.current.get(id);
    const prop = valid.find((p) => p.id === id);
    if (!maps || !marker || !prop) return;
    marker.setIcon(priceIcon(maps, cfgOf(prop.type).color, prop.price, selected));
    marker.setZIndex(selected ? 999 : 1);
  };

  const scrollToCard = (id: string) => {
    const el = listRef.current?.querySelector(`[data-property-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  const focusProperty = (property: Property, scroll = true) => {
    const map = mapInstanceRef.current;
    const marker = markersRef.current.get(property.id);
    const prev = selectedIdRef.current;
    if (prev && prev !== property.id) setMarkerIcon(prev, false);
    selectedIdRef.current = property.id;
    setSelectedId(property.id);
    setMarkerIcon(property.id, true);

    if (map) {
      map.panTo({ lat: property.lat, lng: property.lng });
      if (map.getZoom() < 15) map.setZoom(15);
      if (marker && infoWindowRef.current) {
        infoWindowRef.current.setContent(popupHtml(property, cfgOf(property.type).color));
        infoWindowRef.current.open({ map, anchor: marker });
        setTimeout(() => {
          document
            .getElementById(`gmaps-detail-${property.id}`)
            ?.addEventListener("click", () => onSelectProperty?.(property), { once: true });
        }, 100);
      }
    }
    if (scroll) scrollToCard(property.id);
  };

  useEffect(() => {
    const maps = (window as any).google?.maps;
    if (!ready || !mapRef.current || !maps) return;
    let cancelled = false;

    (async () => {
      const MapCtor =
        maps.Map || (typeof maps.importLibrary === "function" ? (await maps.importLibrary("maps")).Map : null);
      if (!MapCtor || cancelled || !mapRef.current) return;

      const center = valid.length > 0 ? { lat: valid[0].lat, lng: valid[0].lng } : { lat: -26.9906, lng: -48.6348 };

      const map = new MapCtor(mapRef.current, {
        center,
        zoom: 13,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        backgroundColor: "#111111",
        styles: DARK_MAP_STYLES,
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new maps.InfoWindow();

      map.addListener("idle", () => {
        const c = map.getCenter();
        if (c) setMapCenter({ lat: c.lat(), lng: c.lng() });
      });

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = new Map();

      valid.forEach((property) => {
        const cfg = cfgOf(property.type);
        const marker = new maps.Marker({
          position: { lat: property.lat, lng: property.lng },
          map,
          title: property.title,
          icon: priceIcon(maps, cfg.color, property.price, false),
        });
        marker.addListener("click", () => focusProperty(property));
        markersRef.current.set(property.id, marker);
      });

      if (valid.length > 1) {
        const bounds = new maps.LatLngBounds();
        valid.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 40);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, valid]);

  const handleNearby = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        const map = mapInstanceRef.current;
        if (map) {
          map.panTo(loc);
          map.setZoom(14);
        }
        const nearest = valid
          .map((p) => ({ p, d: distanceKm(loc.lat, loc.lng, p.lat, p.lng) }))
          .sort((a, b) => a.d - b.d)[0];
        if (nearest) toast.success(`Mais próximo: ${nearest.p.title} (${formatDistance(nearest.d)})`);
        else toast.success("Localização encontrada");
      },
      () => {
        setLocating(false);
        toast.error("Não foi possível obter sua localização");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (loading) {
    return (
      <div className="rounded-xl overflow-hidden relative border border-border shadow-sm h-[400px] sm:h-[600px] flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ready) {
    return (
      <div className="rounded-xl overflow-hidden relative border border-border shadow-sm h-[400px] sm:h-[600px] flex items-center justify-center bg-muted p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">Mapa indisponível</p>
          <p className="mt-1 text-xs text-muted-foreground">{error ?? "A chave do Google Maps não foi carregada."}</p>
        </div>
      </div>
    );
  }

  const activeTypes = [...new Set(properties.map((p) => p.type))];

  const Card = ({ property }: { property: Property & { __d?: number } }) => {
    const cfg = cfgOf(property.type);
    const selected = selectedId === property.id;
    return (
      <button
        type="button"
        data-property-id={property.id}
        onClick={() => focusProperty(property, false)}
        className={`w-full text-left flex gap-2 p-2 rounded-xl border bg-card transition-all ${
          selected
            ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary"
            : "border-border hover:border-primary/50 hover:shadow-sm"
        }`}
      >
        <img
          src={property.image}
          alt={property.title}
          loading="lazy"
          className="w-24 sm:w-28 aspect-[4/3] rounded-lg object-cover flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="text-[9px] font-bold uppercase text-white px-1.5 py-0.5 rounded"
              style={{ backgroundColor: cfg.color }}
            >
              {property.type}
            </span>
            {typeof property.__d === "number" && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {formatDistance(property.__d)}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold truncate text-foreground">{property.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {[property.neighborhood, property.city].filter(Boolean).join(" – ")}
          </p>
          <div className="flex items-center gap-2 my-1 text-[10px] text-muted-foreground">
            {property.bedrooms > 0 && (
              <span className="flex items-center gap-0.5">
                <BedDouble className="h-3 w-3" />
                {property.bedrooms}
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="flex items-center gap-0.5">
                <Bath className="h-3 w-3" />
                {property.bathrooms}
              </span>
            )}
            {property.parking > 0 && (
              <span className="flex items-center gap-0.5">
                <Car className="h-3 w-3" />
                {property.parking}
              </span>
            )}
            {property.area > 0 && (
              <span className="flex items-center gap-0.5">
                <Ruler className="h-3 w-3" />
                {property.area}m²
              </span>
            )}
          </div>
          <p className="text-sm font-extrabold" style={{ color: cfg.color }}>
            {formatCurrency(property.price)}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-3 lg:h-[640px]">
        <div className="relative rounded-xl overflow-hidden border border-border shadow-sm h-[380px] lg:h-full lg:flex-1">
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-card/95 backdrop-blur-sm rounded-full shadow-lg px-3 py-1.5 border border-border flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-foreground">{properties.length}</span>
              <span className="text-[10px] text-muted-foreground">imóveis</span>
            </div>
          </div>
          <div className="absolute top-4 right-4 z-10">
            <Button size="sm" className="rounded-full shadow-lg" onClick={handleNearby} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              <span className="ml-1.5 text-xs">Imóveis próximos</span>
            </Button>
          </div>
          <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
        </div>

        <aside className="hidden lg:flex lg:w-[380px] flex-col rounded-xl border border-border bg-muted/30 overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">
              {userLocation ? "Imóveis mais próximos de você" : "Imóveis próximos ao centro do mapa"}
            </p>
            <p className="text-[11px] text-muted-foreground">Toque em um imóvel para ver no mapa</p>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
            {sorted.map((p) => (
              <Card key={p.id} property={p as any} />
            ))}
          </div>
        </aside>

        <div className="lg:hidden -mx-1 px-1 overflow-x-auto snap-x snap-mandatory flex gap-2 pb-1">
          {sorted.map((p) => (
            <div key={p.id} className="snap-start flex-shrink-0 w-[290px]">
              <Card property={p as any} />
            </div>
          ))}
        </div>
      </div>

      {activeTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {activeTypes.map((type) => {
            const cfg = cfgOf(type);
            return (
              <div
                key={type}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-medium"
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                <span>{cfg.emoji}</span>
                <span className="text-foreground">{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
