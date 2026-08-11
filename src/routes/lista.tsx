import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BedDouble, Bath, Car, Maximize, MapPin, Share2 } from "lucide-react";

export const Route = createFileRoute("/lista")({
  head: () => ({
    meta: [
      { title: "Seleção de imóveis — MV BROKER" },
      { name: "description", content: "Lista de imóveis selecionados especialmente para você." },
      { property: "og:title", content: "Seleção de imóveis — MV BROKER" },
      { property: "og:description", content: "Lista de imóveis selecionados especialmente para você." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicListaPage,
});

function formatBRL(n: number | null | undefined) {
  if (n == null) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  } catch { return `R$ ${n}`; }
}

function PublicListaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("Imóveis selecionados");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get("ids") || "";
    const t = params.get("t");
    if (t) setTitulo(t);
    if (!ids) { setItems([]); setLoading(false); return; }
    let alive = true;
    fetch(`/api/public/imoveis-lista?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) { setItems(j?.items ?? []); setLoading(false); } })
      .catch(() => { if (alive) { setItems([]); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const share = async () => {
    const url = window.location.href;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: titulo, url }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${titulo}\n${url}`)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{titulo}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading ? "Carregando…" : `${items.length} imóvel(is)`}
            </p>
          </div>
          <button onClick={share} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>
        </div>

        {!loading && items.length === 0 && (
          <p className="text-muted-foreground">Nenhum imóvel disponível nesta lista.</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((im) => {
            const endereco = [im.bairro, im.cidade, im.estado].filter(Boolean).join(", ");
            return (
              <Link
                key={im.id}
                to="/imovel/$id"
                params={{ id: im.id }}
                className="group rounded-2xl border overflow-hidden bg-card hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={im.cover || "/img/bg-mv.png"}
                    alt={im.titulo || "Imóvel"}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div className="text-lg font-bold text-primary">{formatBRL(im.preco)}</div>
                  <h2 className="font-semibold leading-snug line-clamp-2">{im.titulo || "Imóvel"}</h2>
                  {endereco && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {endereco}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs pt-1">
                    {im.dormitorios != null && <span className="inline-flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-primary" />{im.dormitorios}</span>}
                    {im.banheiros != null && <span className="inline-flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-primary" />{im.banheiros}</span>}
                    {im.vagas != null && <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5 text-primary" />{im.vagas}</span>}
                    {(im.area_privativa || im.area_total) && (
                      <span className="inline-flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-primary" />{im.area_privativa || im.area_total} m²</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
