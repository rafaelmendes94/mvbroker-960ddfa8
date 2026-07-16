import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BedDouble, Bath, Car, Maximize, MapPin, ChevronLeft, ChevronRight,
  Share2, FileText, Link as LinkIcon, Map as MapIcon, Building2,
} from "lucide-react";

export const Route = createFileRoute("/empreendimento/$id")({
  head: () => ({
    meta: [
      { title: "Empreendimento — MV BROKER" },
      { name: "description", content: "Confira os detalhes deste empreendimento." },
      { property: "og:title", content: "Empreendimento — MV BROKER" },
      { property: "og:description", content: "Confira os detalhes deste empreendimento." },
    ],
  }),
  component: PublicEmpreendimentoPage,
});

type ApiResp = {
  tipo: "edificio" | "condominio" | "empreendimento" | "loteamento";
  empreendimento: any;
  images: string[];
  mapa_pdf_url: string | null;
  implantacao_pdf_url: string | null;
  material_completo_url: string | null;
  imoveis: any[];
};

function formatBRL(n: number | null | undefined) {
  if (n == null) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  } catch { return `R$ ${n}`; }
}

const TIPO_LABEL: Record<ApiResp["tipo"], string> = {
  edificio: "Edifício",
  condominio: "Condomínio",
  empreendimento: "Empreendimento",
  loteamento: "Loteamento",
};

function PublicEmpreendimentoPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/public/empreendimento/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(j?.error || "Não foi possível carregar."); setLoading(false); return; }
        setData(j);
        setLoading(false);
      })
      .catch((e) => { if (alive) { setErr(e?.message || "Erro"); setLoading(false); } });
  }, [id]);

  const disponiveis = useMemo(
    () => (data?.imoveis ?? []).filter((i) => (i.status_imovel ?? "").toLowerCase() !== "indisponivel"),
    [data]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  if (err || !data?.empreendimento) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-bold">Empreendimento não encontrado</h1>
        <p className="text-muted-foreground">{err === "not_found" ? "Este empreendimento não está mais disponível." : "Tente novamente em instantes."}</p>
        <a href="/" className="text-primary underline">Voltar ao início</a>
      </div>
    );
  }

  const e = data.empreendimento;
  const images = data.images.length ? data.images : ["/img/bg-mv.png"];
  const endereco = [e.logradouro, e.numero, e.bairro, e.cidade, e.estado].filter(Boolean).join(", ");
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${e.nome} — ${endereco || TIPO_LABEL[data.tipo]}\n${shareUrl}`;

  const share = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: e.nome, text: shareText, url: shareUrl }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const openMaps = () => {
    const q = (e.latitude && e.longitude)
      ? `${e.latitude},${e.longitude}`
      : encodeURIComponent(endereco);
    if (!q) return;
    window.open(`https://www.google.com/maps?q=${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{TIPO_LABEL[data.tipo]}</div>
          <button onClick={share} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>
        </div>

        {/* Gallery */}
        <div className="relative w-full aspect-[16/10] bg-muted rounded-2xl overflow-hidden">
          <img src={images[idx]} alt={e.nome} className="w-full h-full object-cover" />
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
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{e.nome}</h1>
              {endereco && (
                <p className="mt-1 text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {endereco}
                </p>
              )}
            </div>

            {e.descricao && (
              <section>
                <h2 className="text-lg font-semibold mb-2">Sobre</h2>
                <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{e.descricao}</p>
              </section>
            )}

            {Array.isArray(e.infraestrutura) && e.infraestrutura.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-2">Infraestrutura</h2>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {e.infraestrutura.map((c: string, i: number) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-muted/50">{c}</div>
                  ))}
                </div>
              </section>
            )}

            {disponiveis.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-2">Unidades disponíveis</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {disponiveis.map((im) => (
                    <a
                      key={im.id}
                      href={`/imovel/${im.id}`}
                      className="rounded-xl border p-4 hover:border-primary transition-colors bg-card"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">
                          {im.titulo || `Unidade ${im.unidade || im.numero || im.lote || im.codigo_interno || ""}`}
                        </div>
                        {im.preco != null && (
                          <div className="text-primary font-bold whitespace-nowrap">{formatBRL(im.preco)}</div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {im.dormitorios != null && <span className="inline-flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{im.dormitorios}</span>}
                        {im.banheiros != null && <span className="inline-flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{im.banheiros}</span>}
                        {im.vagas != null && <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" />{im.vagas}</span>}
                        {(im.area_privativa || im.area_total) && (
                          <span className="inline-flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{im.area_privativa || im.area_total} m²</span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {data.implantacao_pdf_url && (
              <section>
                <h2 className="text-lg font-semibold mb-2">Implantação</h2>
                <iframe src={data.implantacao_pdf_url} title="Implantação" className="w-full h-[520px] rounded-xl border" />
              </section>
            )}

            <div className="text-xs text-muted-foreground">
              {e.codigo_interno ? `Código: ${e.codigo_interno}` : `ID: ${e.id}`}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border p-5 bg-card space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Recursos</div>
              {data.material_completo_url && (
                <a href={data.material_completo_url} target="_blank" rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold hover:opacity-90">
                  <LinkIcon className="w-4 h-4" /> Material completo
                </a>
              )}
              {data.mapa_pdf_url && (
                <a href={data.mapa_pdf_url} target="_blank" rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                  <FileText className="w-4 h-4" /> Ver mapa (PDF)
                </a>
              )}
              {(e.latitude && e.longitude) || endereco ? (
                <button onClick={openMaps}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                  <MapIcon className="w-4 h-4" /> Localização
                </button>
              ) : null}
              <button onClick={share}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                <Share2 className="w-4 h-4" /> Compartilhar
              </button>
            </div>

            <div className="rounded-2xl border p-5 bg-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Informações
              </div>
              <dl className="text-sm space-y-1.5">
                {e.construtora && <Row label="Construtora" value={e.construtora} />}
                {e.incorporadora && <Row label="Incorporadora" value={e.incorporadora} />}
                {e.qtd_andares != null && <Row label="Andares" value={e.qtd_andares} />}
                {e.qtd_apartamentos != null && <Row label="Aptos por andar" value={e.qtd_apartamentos} />}
                {e.qtd_elevadores != null && <Row label="Elevadores" value={e.qtd_elevadores} />}
                {e.ano_construcao && <Row label="Ano" value={e.ano_construcao} />}
                {e.numero_lotes != null && <Row label="Lotes" value={e.numero_lotes} />}
                {e.total_lotes != null && <Row label="Total de lotes" value={e.total_lotes} />}
                {e.lotes_disponiveis != null && <Row label="Lotes disponíveis" value={e.lotes_disponiveis} />}
                {e.area_total != null && <Row label="Área total" value={`${e.area_total} m²`} />}
                {e.area_total_m2 != null && <Row label="Área total" value={`${e.area_total_m2} m²`} />}
                {e.portaria && <Row label="Portaria" value={e.portaria} />}
                {e.seguranca && <Row label="Segurança" value={e.seguranca} />}
                {e.status_obra && <Row label="Status" value={e.status_obra} />}
                {e.valor_condominio != null && <Row label="Condomínio" value={formatBRL(e.valor_condominio)} />}
                {e.valor_iptu != null && <Row label="IPTU" value={formatBRL(e.valor_iptu)} />}
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{String(value)}</dd>
    </div>
  );
}
