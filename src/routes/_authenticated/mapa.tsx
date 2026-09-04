import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PropertyMap } from "@/components/PropertyMap";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholderImage";
import type { Property } from "@/data/mockData";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa de imóveis — MV Broker" },
      { name: "description", content: "Explore os imóveis do portfólio no mapa e encontre as opções mais próximas de você." },
      { property: "og:title", content: "Mapa de imóveis — MV Broker" },
      { property: "og:description", content: "Explore os imóveis do portfólio no mapa e encontre as opções mais próximas de você." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaPage,
});

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  vendido: "Vendido",
  reservado: "Reservado",
  alugado: "Alugado",
  suspenso: "Suspenso",
  pre_importacao: "Pré-importação",
};

function titleCase(v?: string | null) {
  if (!v) return "Outro";
  const s = String(v).replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MapaPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [cidade, setCidade] = useState("todas");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select(
          "id, titulo, logradouro, numero, bairro, cidade, tipo_imovel, status_imovel, preco, area_privativa, area_total, dormitorios, banheiros, vagas, latitude, longitude",
        )
        .eq("arquivado", false)
        .neq("status_imovel", "pre_importacao")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(2000);

      if (error) {
        if (!cancelled) {
          toast.error("Erro ao carregar imóveis");
          setLoading(false);
        }
        return;
      }

      const rows = data || [];
      const ids = rows.map((r: any) => r.id);
      const coverByProperty = new Map<string, string>();
      if (ids.length) {
        const { data: imgs } = await supabase
          .from("imovel_imagens")
          .select("imovel_id, storage_path, url, ordem, capa")
          .in("imovel_id", ids)
          .order("capa", { ascending: false })
          .order("ordem", { ascending: true });
        const first = new Map<string, any>();
        (imgs || []).forEach((im: any) => {
          if (!first.has(im.imovel_id)) first.set(im.imovel_id, im);
        });
        const paths = [...first.values()]
          .map((im) => im.storage_path || im.url)
          .filter((p: any) => p && !String(p).startsWith("http"));
        const { getImageUrls } = await import("@/lib/imageUrl");
        const signed = paths.length ? await getImageUrls(paths) : new Map<string, string>();
        first.forEach((im, key) => {
          const raw = im.storage_path || im.url;
          const url = raw && String(raw).startsWith("http") ? raw : signed.get(raw);
          if (url) coverByProperty.set(key, url);
        });
      }

      const mapped: Property[] = rows.map((r: any) => ({
        id: r.id,
        title: r.titulo || "Imóvel",
        address: [r.logradouro, r.numero].filter(Boolean).join(", "),
        neighborhood: r.bairro || undefined,
        city: r.cidade || "",
        type: titleCase(r.tipo_imovel) as Property["type"],
        status: (STATUS_LABEL[r.status_imovel] || "Disponível") as Property["status"],
        price: Number(r.preco) || 0,
        area: Number(r.area_privativa || r.area_total) || 0,
        bedrooms: Number(r.dormitorios) || 0,
        bathrooms: Number(r.banheiros) || 0,
        parking: Number(r.vagas) || 0,
        broker: "",
        image: coverByProperty.get(r.id) || PLACEHOLDER_IMAGE,
        images: [],
        createdAt: "",
        lat: Number(r.latitude),
        lng: Number(r.longitude),
      }));

      if (!cancelled) {
        setItems(mapped);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tipos = useMemo(() => [...new Set(items.map((i) => i.type))].sort(), [items]);
  const cidades = useMemo(() => [...new Set(items.map((i) => i.city).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (tipo !== "todos" && i.type !== tipo) return false;
      if (cidade !== "todas" && i.city !== cidade) return false;
      if (!term) return true;
      return [i.title, i.address, i.neighborhood, i.city].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [items, q, tipo, cidade]);

  return (
    <div className="space-y-4">
      <PageHeader title="Mapa de imóveis" description="Explore o portfólio no mapa e veja os imóveis mais próximos." />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, bairro ou endereço"
            className="pl-9"
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cidade} onValueChange={setCidade}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as cidades</SelectItem>
            {cidades.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} imóvel(is) no mapa</p>

      {loading ? (
        <div className="h-[400px] sm:h-[600px] rounded-xl border border-border bg-muted flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PropertyMap
          properties={filtered}
          onSelectProperty={(p) => navigate({ to: "/imovel/$id", params: { id: p.id } })}
        />
      )}
    </div>
  );
}
