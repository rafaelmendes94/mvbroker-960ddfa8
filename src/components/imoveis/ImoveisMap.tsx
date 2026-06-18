import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type Item = {
  id: string;
  titulo: string;
  preco: number | null;
  bairro: string | null;
  cidade: string | null;
  latitude: number | null;
  longitude: number | null;
  foto_capa_url?: string | null;
};

export function ImoveisMap({ items, onSelect }: { items: Item[]; onSelect?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !ref.current || !window.google) return;
      mapRef.current = new window.google.maps.Map(ref.current, {
        center: { lat: -27.5954, lng: -48.5480 },
        zoom: 11,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      });
      infoRef.current = new window.google.maps.InfoWindow();
    }).catch(() => { /* sem chave */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    const valid = items.filter((i) => i.latitude && i.longitude);
    valid.forEach((i) => {
      const pos = { lat: Number(i.latitude), lng: Number(i.longitude) };
      const marker = new window.google.maps.Marker({ position: pos, map: mapRef.current, title: i.titulo });
      marker.addListener("click", () => {
        const preco = i.preco ? `R$ ${Number(i.preco).toLocaleString("pt-BR")}` : "Sob consulta";
        const html = `
          <div style="min-width:220px;font-family:inherit">
            ${i.foto_capa_url ? `<img src="${i.foto_capa_url}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px"/>` : ""}
            <div style="margin-top:6px;font-weight:600;font-size:14px">${i.titulo ?? ""}</div>
            <div style="font-size:12px;color:#666">${[i.bairro, i.cidade].filter(Boolean).join(", ")}</div>
            <div style="margin-top:4px;font-weight:700">${preco}</div>
            <button id="mv-det-${i.id}" style="margin-top:8px;background:#0f172a;color:#fff;border:0;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;width:100%">Ver detalhes</button>
          </div>`;
        infoRef.current.setContent(html);
        infoRef.current.open({ map: mapRef.current, anchor: marker });
        setTimeout(() => {
          document.getElementById(`mv-det-${i.id}`)?.addEventListener("click", () => onSelect?.(i.id));
        }, 50);
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    });

    if (valid.length === 1) {
      mapRef.current.setCenter({ lat: Number(valid[0].latitude), lng: Number(valid[0].longitude) });
      mapRef.current.setZoom(14);
    } else if (valid.length > 1) {
      mapRef.current.fitBounds(bounds);
    }
  }, [items, onSelect]);

  const semCoords = items.filter((i) => !i.latitude || !i.longitude).length;

  return (
    <div className="relative">
      <div ref={ref} className="w-full rounded-md border bg-muted" style={{ height: 600 }} />
      {semCoords > 0 && (
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur border rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />{semCoords} imóvel(is) sem coordenadas
        </div>
      )}
    </div>
  );
}
