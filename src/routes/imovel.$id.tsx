import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BedDouble, Bath, Car, Maximize, MapPin, ChevronLeft, ChevronRight,
  ArrowLeft, Share2, Phone,
} from "lucide-react";

export const Route = createFileRoute("/imovel/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Imóvel ${params.id.slice(0, 8)} — MV BROKER` },
      { name: "description", content: "Confira os detalhes deste imóvel." },
      { property: "og:title", content: "Imóvel — MV BROKER" },
      { property: "og:description", content: "Confira os detalhes deste imóvel." },
    ],
  }),
  component: PublicImovelPage,
});

type Imovel = any;

function formatBRL(n: number | null | undefined) {
  if (n == null) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  } catch { return `R$ ${n}`; }
}

function PublicImovelPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<{ imovel: Imovel; images: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/public/imovel/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(j?.error || "Não foi possível carregar o imóvel."); setLoading(false); return; }
        setData(j);
        setLoading(false);
      })
      .catch((e) => { if (alive) { setErr(e?.message || "Erro"); setLoading(false); } });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando imóvel…</div>;
  }
  if (err || !data?.imovel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-bold">Imóvel não encontrado</h1>
        <p className="text-muted-foreground">{err === "not_found" ? "Este imóvel não está mais disponível." : "Tente novamente em instantes."}</p>
        <a href="/" className="text-primary underline">Voltar ao início</a>
      </div>
    );
  }

  const im = data.imovel;
  const images = data.images.length ? data.images : ["/img/bg-mv.png"];
  const endereco = [im.logradouro, im.numero, im.bairro, im.cidade, im.estado].filter(Boolean).join(", ");
  const whats = (im.responsavel_whatsapp || im.responsavel_telefone || "").replace(/\D/g, "");
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${im.titulo || "Imóvel"} — ${formatBRL(im.preco)}\n${endereco}\n${shareUrl}`;

  const share = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: im.titulo, text: shareText, url: shareUrl }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={share} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>
        </div>
        {/* Gallery */}
        <div className="relative w-full aspect-[16/10] bg-muted rounded-2xl overflow-hidden">
          <img src={images[idx]} alt={im.titulo || "Imóvel"} className="w-full h-full object-cover" />
          {images.length > 1 && (
            <>
              <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setIdx((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70">
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {idx + 1} / {images.length}
              </div>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {images.slice(0, 16).map((src, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`aspect-square rounded-lg overflow-hidden border-2 ${i === idx ? "border-primary" : "border-transparent"}`}>
                <img src={src} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{im.titulo || "Imóvel"}</h1>
              {endereco && (
                <p className="mt-1 text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {endereco}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              {im.dormitorios != null && <span className="inline-flex items-center gap-1.5"><BedDouble className="w-4 h-4 text-primary" /> {im.dormitorios} dorm.</span>}
              {im.banheiros != null && <span className="inline-flex items-center gap-1.5"><Bath className="w-4 h-4 text-primary" /> {im.banheiros} banh.</span>}
              {im.vagas != null && <span className="inline-flex items-center gap-1.5"><Car className="w-4 h-4 text-primary" /> {im.vagas} vaga(s)</span>}
              {(im.area_privativa || im.area_total) && (
                <span className="inline-flex items-center gap-1.5"><Maximize className="w-4 h-4 text-primary" /> {im.area_privativa || im.area_total} m²</span>
              )}
            </div>

            {im.descricao && (
              <section>
                <h2 className="text-lg font-semibold mb-2">Descrição</h2>
                <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{im.descricao}</p>
              </section>
            )}

            {(im.infraestrutura || im.outras_caracteristicas) && (
              <section>
                <h2 className="text-lg font-semibold mb-2">Características</h2>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {[
                    ...(Array.isArray(im.infraestrutura) ? im.infraestrutura : []),
                    ...(Array.isArray(im.outras_caracteristicas) ? im.outras_caracteristicas : []),
                  ].map((c: string, i: number) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-muted/50">{c}</div>
                  ))}
                </div>
              </section>
            )}

            <div className="text-xs text-muted-foreground">Código: {im.codigo_interno || im.id}</div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border p-5 bg-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Valor</div>
              <div className="text-3xl font-bold text-primary">{formatBRL(im.preco)}</div>
              {im.bonus && <div className="mt-1 text-sm text-emerald-600">Bônus: {im.bonus}</div>}
              {im.condicoes_pagamento && <div className="mt-2 text-sm text-muted-foreground">{im.condicoes_pagamento}</div>}

              {whats ? (
                <a
                  href={`https://wa.me/${whats.startsWith("55") ? whats : "55" + whats}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${im.titulo || im.codigo_interno || ""}. ${shareUrl}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 font-semibold"
                >
                  <Phone className="w-4 h-4" /> Falar no WhatsApp
                </a>
              ) : (
                <a href="/" className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 font-semibold">
                  Entrar em contato
                </a>
              )}

              <button onClick={share} className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                <Share2 className="w-4 h-4" /> Compartilhar
              </button>
            </div>

            {(im.responsavel_nome || im.responsavel_email) && (
              <div className="rounded-2xl border p-5 bg-card">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Responsável</div>
                {im.responsavel_nome && <div className="font-semibold">{im.responsavel_nome}</div>}
                {im.responsavel_email && <div className="text-sm text-muted-foreground">{im.responsavel_email}</div>}
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="mt-10 border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} MV BROKER
      </footer>
    </div>
  );
}
