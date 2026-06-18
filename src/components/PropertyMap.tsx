import { useEffect, useRef } from "react";
import { Property, formatCurrency } from "@/data/mockData";
import { useGoogleMapsLoader } from "@/hooks/useGoogleMapsLoader";
import { Loader2 } from "lucide-react";

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
  Apartamento: { emoji: "🏢", color: "#2563eb", label: "Apartamento" },
  Casa: { emoji: "🏠", color: "#059669", label: "Casa" },
  Comercial: { emoji: "🏪", color: "#d97706", label: "Comercial" },
  Terreno: { emoji: "🌳", color: "#7c3aed", label: "Terreno" },
  Lote: { emoji: "📐", color: "#8b5cf6", label: "Lote" },
  Cobertura: { emoji: "🏙️", color: "#0891b2", label: "Cobertura" },
  Sobrado: { emoji: "🏡", color: "#16a34a", label: "Sobrado" },
  Kitnet: { emoji: "🛏️", color: "#f59e0b", label: "Kitnet" },
  Sala: { emoji: "💼", color: "#6366f1", label: "Sala" },
  Loja: { emoji: "🛒", color: "#ea580c", label: "Loja" },
  Galpão: { emoji: "🏭", color: "#78716c", label: "Galpão" },
  Condomínio: { emoji: "🏘️", color: "#0d9488", label: "Condomínio" },
};

const defaultCfg = { emoji: "📍", color: "#2563eb", label: "Outro" };

function clearMarker(marker: any) {
  if (!marker) return;
  if ("map" in marker) {
    marker.map = null;
    return;
  }
  if (typeof marker.setMap === "function") {
    marker.setMap(null);
  }
}

function createFallbackMarker(maps: any, map: any, property: Property, shortPrice: string, color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="34" viewBox="0 0 72 34" fill="none">
      <rect x="2" y="2" width="68" height="22" rx="11" fill="${color}" />
      <path d="M31 24H41L36 32L31 24Z" fill="${color}" />
      <text x="36" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="white">${shortPrice}</text>
    </svg>
  `.trim();

  return new maps.Marker({
    position: { lat: property.lat, lng: property.lng },
    map,
    title: property.title,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new maps.Size(72, 34),
      anchor: new maps.Point(36, 32),
    },
  });
}

function createMarker(maps: any, map: any, property: Property, cfg: { emoji: string; color: string }, shortPrice: string) {
  return createFallbackMarker(maps, map, property, shortPrice, cfg.color);
}

export function PropertyMap({ properties, onSelectProperty }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const { ready, loading, error } = useGoogleMapsLoader();

  useEffect(() => {
    const maps = (window as any).google?.maps;
    if (!ready || !mapRef.current || !maps) return;

    let cancelled = false;

    (async () => {
      const MapCtor =
        maps.Map ||
        (typeof maps.importLibrary === "function"
          ? (await maps.importLibrary("maps")).Map
          : null);
      if (!MapCtor || cancelled || !mapRef.current) return;

      if (typeof maps.importLibrary === "function") {
        await maps.importLibrary("marker").catch(() => null);
      }

      const center = properties.length > 0
        ? { lat: properties[0].lat, lng: properties[0].lng }
        : { lat: -23.55, lng: -46.63 };

      const map = new MapCtor(mapRef.current, {
        center,
        zoom: 11,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;
      infoWindowRef.current = new maps.InfoWindow();

      markersRef.current.forEach(clearMarker);
      markersRef.current = [];

      properties.forEach((property) => {
      const cfg = typeConfig[property.type] || defaultCfg;
      const shortPrice = formatShortPrice(property.price);
      const marker = createMarker(maps, map, property, cfg, shortPrice);

      marker.addListener("click", () => {
        const popupContent = `
          <div style="width:270px;font-family:system-ui,-apple-system,sans-serif;padding:0;">
            <img src="${property.image}" alt="${property.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;display:block;cursor:pointer;" />
            <div style="padding:12px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="font-size:10px;font-weight:700;color:#fff;background:${cfg.color};padding:2px 8px;border-radius:4px;letter-spacing:0.5px;text-transform:uppercase;">${property.type}</span>
                <span style="font-size:10px;font-weight:500;color:#94a3b8;">${property.status}</span>
              </div>
              <h3 style="font-size:14px;font-weight:700;margin:0 0 4px 0;color:#0f172a;line-height:1.3;">${property.title}</h3>
              <p style="font-size:11px;color:#64748b;margin:0 0 4px 0;line-height:1.4;">📍 ${property.address}${property.neighborhood ? `, ${property.neighborhood}` : ""} – ${property.city}</p>
              <div style="display:flex;gap:8px;margin-bottom:8px;font-size:10px;color:#64748b;">
                ${property.bedrooms > 0 ? `<span>🛏 ${property.bedrooms}</span>` : ""}
                ${property.bathrooms > 0 ? `<span>🚿 ${property.bathrooms}</span>` : ""}
                ${property.parking > 0 ? `<span>🚗 ${property.parking}</span>` : ""}
                <span>📐 ${property.area}m²</span>
              </div>
              <div style="display:flex;align-items:baseline;justify-content:space-between;">
                <p style="font-size:18px;font-weight:800;color:${cfg.color};margin:0;">${formatCurrency(property.price)}</p>
                <span id="gmaps-detail-${property.id}" style="font-size:10px;color:${cfg.color};cursor:pointer;font-weight:700;text-decoration:underline;">Ver detalhes →</span>
              </div>
            </div>
          </div>`;

        infoWindowRef.current?.setContent(popupContent);
        infoWindowRef.current?.open({ map, anchor: marker });

        setTimeout(() => {
          const detailBtn = document.getElementById(`gmaps-detail-${property.id}`);
          detailBtn?.addEventListener("click", () => onSelectProperty?.(property), { once: true });
        }, 100);
      });

      markersRef.current.push(marker);
    });

      if (properties.length > 1) {
        const bounds = new maps.LatLngBounds();
        properties.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 40);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach(clearMarker);
      markersRef.current = [];
    };
  }, [ready, properties, onSelectProperty]);

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

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden relative border border-border shadow-sm h-[400px] sm:h-[600px]">
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-border flex items-center gap-2">
            <span className="text-[11px] font-bold text-foreground">{properties.length}</span>
            <span className="text-[10px] text-muted-foreground">imóveis no mapa</span>
          </div>
        </div>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      </div>

      {activeTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {activeTypes.map((type) => {
            const cfg = typeConfig[type] || defaultCfg;
            return (
              <div key={type} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-medium">
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
