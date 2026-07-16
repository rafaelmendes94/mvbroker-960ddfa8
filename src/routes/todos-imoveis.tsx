import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, Bath, Car, Maximize, MapPin, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/todos-imoveis")({
  head: () => ({
    meta: [
      { title: "Lista de imóveis — MV BROKER" },
      { name: "description", content: "Imóveis selecionados para você." },
      { property: "og:title", content: "Lista de imóveis selecionados" },
      { property: "og:description", content: "Imóveis selecionados para você." },
    ],
  }),
  component: TodosImoveisPage,
});

function formatBRL(n: number | null | undefined) {
  if (n == null) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  } catch { return `R$ ${n}`; }
}

function TodosImoveisPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { ids, por } = useMemo(() => {
    if (typeof window === "undefined") return { ids: "", por: "" };
    const p = new URLSearchParams(window.location.search);
    return { ids: p.get("ids") || "", por: p.get("por") || "" };
  }, []);

  useEffect(() => {
    if (!ids) { setLoading(false); return; }
    let alive = true;
    fetch(`/api/public/imoveis-lista?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) { setItems(j.items || []); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ids]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">Imóveis selecionados</h1>
          {por && (
            <p className="text-muted-foreground inline-flex items-center gap-1.5 justify-center">
              <UserIcon className="w-4 h-4" /> Selecionados por <strong className="text-foreground">{por}</strong>
            </p>
          )}
          <p className="text-sm text-muted-foreground">{items.length} imóvel{items.length === 1 ? "" : "es"}</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Nenhum imóvel encontrado nesta lista.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((im) => {
              const endereco = [im.bairro, im.cidade, im.estado].filter(Boolean).join(", ");
              const area = im.area_privativa || im.area_total;
              return (
                <a
                  key={im.id}
                  href={`/imovel/${im.id}`}
                  className="group bg-card rounded-2xl border overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    <img
                      src={im.cover || "/img/bg-mv.png"}
                      alt={im.titulo || "Imóvel"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-xl font-bold text-primary">{formatBRL(im.preco)}</div>
                    <h3 className="font-semibold text-sm line-clamp-2">{im.titulo || "Imóvel"}</h3>
                    {endereco && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" /> {endereco}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                      {im.dormitorios != null && <span className="inline-flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {im.dormitorios}</span>}
                      {im.banheiros != null && <span className="inline-flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {im.banheiros}</span>}
                      {im.vagas != null && <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {im.vagas}</span>}
                      {area && <span className="inline-flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {area} m²</span>}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
