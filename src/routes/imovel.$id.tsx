import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BedDouble, BedSingle, Ruler, Bath, Car, Maximize, MapPin, ChevronLeft, ChevronRight,
  Share2, Loader2, HardDrive, Map as MapIcon, Expand, X, FileText,
  Video, Compass, Layers, Pencil, MessageCircle, Heart, Home,
} from "lucide-react";
import { toast } from "sonner";
import { getImovelPreview } from "@/lib/imovel-publico.functions";
import { useFavoritos } from "@/hooks/use-favoritos";
import { trackPropertyView } from "@/lib/trackPropertyView";
import { supabase } from "@/integrations/supabase/client";
import { WRITE_IMOVEL_ROLES, type AppRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/imovel/$id")({
  loader: async ({ params }) => {
    try {
      return await getImovelPreview({ data: { id: params.id } });
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const p = loaderData;
    const title = p?.titulo || "Imóvel — MV BROKER";
    const desc = p?.descricao || "Confira os detalhes deste imóvel.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(p?.url ? [{ property: "og:url", content: p.url }] : []),
        ...(p?.image
          ? [
              { property: "og:image", content: p.image },
              { property: "og:image:secure_url", content: p.image },
              { property: "og:image:type", content: "image/jpeg" },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { property: "og:image:alt", content: title },
              { name: "twitter:image", content: p.image },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : [{ name: "twitter:card", content: "summary" }]),
      ],
      links: p?.url ? [{ rel: "canonical", href: p.url }] : [],
    };
  },
  component: PublicImovelPage,
});

type Imovel = any;

const WHATS = "5551983282535";

function formatBRL(n: number | null | undefined) {
  if (n == null) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  } catch { return `R$ ${n}`; }
}

function toEmbedUrl(raw?: string | null): string | null {
  const u = (raw || "").trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function isFileVideo(u: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(u.trim());
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm p-5 md:p-7">
      <h2 className="text-[18px] font-semibold tracking-tight mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="px-3 py-1.5 rounded-full bg-muted text-sm">{children}</span>;
}

function PublicImovelPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<{ imovel: Imovel; images: string[]; mapaPdfUrl?: string | null; pdfComercialUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [logged, setLogged] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);
  const { has: hasFav, toggle: toggleFav } = useFavoritos();
  const isFav = hasFav(id);

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

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackPropertyView(id);
  }, [id]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data: s }) => {
      const uid = s.session?.user?.id;
      if (!uid) { if (alive) { setLogged(false); setCanEdit(false); } return; }
      if (alive) setLogged(true);
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (rows ?? []).map((r: any) => r.role as AppRole);
      if (alive) setCanEdit(roles.some((r) => WRITE_IMOVEL_ROLES.includes(r)));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const im = data?.imovel;
  const images = useMemo(() => (data?.images?.length ? data.images : []), [data]);

  const empreendimento: string | null = useMemo(() => {
    if (!im) return null;
    return (
      [im.empreendimento, im.edificios?.nome, im.condominios?.nome, im.empreendimentos?.nome]
        .map((v: any) => (typeof v === "string" ? v.trim() : v))
        .find((v: any) => !!v) ?? null
    );
  }, [im]);

  const endereco = im
    ? [im.logradouro, im.numero, im.complemento, im.bairro, im.cidade, im.estado].filter(Boolean).join(", ")
    : "";

  // SEO dinâmico
  useEffect(() => {
    if (!im) return;
    const preco = formatBRL(im.preco);
    const title = `${im.titulo || "Imóvel"} - ${preco}`;
    document.title = title;
    const desc = [
      im.tipo_imovel || "Imóvel",
      (im.bairro || im.cidade) ? `em ${im.bairro || im.cidade}` : null,
    ].filter(Boolean).join(" ") +
      [
        im.dormitorios != null ? ` • ${im.dormitorios} quartos` : "",
        (im.area_privativa || im.area_total) ? ` • ${im.area_privativa || im.area_total}m²` : "",
      ].join("");
    setMeta("name", "description", desc);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", "article");
    if (images[0]) setMeta("property", "og:image", images[0]);
  }, [im, images]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/imovel/${id}` : "";
  const shareText = im
    ? `🏠 *${im.titulo || "Imóvel"}*\n💰 ${formatBRL(im.preco)}${endereco ? `\n📍 ${endereco}` : ""}\n\n🔗 ${shareUrl}`
    : "";

  const share = useCallback(async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: im?.titulo, text: shareText, url: shareUrl }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado!");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    }
  }, [im, shareText, shareUrl]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else window.location.href = "/imoveis";
  };

  const next = useCallback(() => setIdx((i) => (images.length ? (i + 1) % images.length : 0)), [images.length]);
  const prev = useCallback(() => setIdx((i) => (images.length ? (i - 1 + images.length) % images.length : 0)), [images.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, next, prev]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando imóvel…
      </div>
    );
  }
  if (err || !im) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-bold">Imóvel indisponível</h1>
        <p className="text-muted-foreground">Este imóvel não está mais disponível.</p>
        <a href="/" className="text-primary underline">Ir para o site</a>
      </div>
    );
  }

  const videos = String(im.link_video || "")
    .split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
  const primeiroVideo = videos[0] || null;
  const tour360 = (im.tour_360 || "").trim() || null;
  const codigo = im.codigo_interno || String(im.id).slice(0, 8).toUpperCase();
  const tipo = (im.tipo_imovel || "").toLowerCase();
  const isApto = /apart|apto|flat|studio|cobertura|sala/.test(tipo);
  const mapaPdfUrl = data?.mapaPdfUrl || null;
  const pdfComercialUrl = data?.pdfComercialUrl || null;
  const mapQuery = im.latitude && im.longitude ? `${im.latitude},${im.longitude}` : endereco;
  const mapSrc = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : null;

  const badgesGaleria = [
    im.vista_mar ? "Vista Mar" : null,
    im.decorado ? "Decorado" : null,
    im.aceita_permuta ? "Permuta" : null,
  ].filter(Boolean) as string[];

  const identBadges = [
    empreendimento ? { label: "Empreendimento", value: empreendimento } : null,
    isApto
      ? (im.unidade ? { label: "Unidade", value: String(im.unidade) } : null)
      : (im.quadra ? { label: "Quadra", value: String(im.quadra) } : null),
    isApto
      ? null
      : (im.lote ? { label: "Lote", value: String(im.lote) } : null),
    im.box ? { label: "Box", value: String(im.box) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const stats = [
    im.dormitorios != null ? { icon: BedDouble, label: "Quartos", value: String(im.dormitorios) } : null,
    im.suites != null ? { icon: BedSingle, label: "Suítes", value: String(im.suites) } : null,
    im.banheiros != null ? { icon: Bath, label: "Banheiros", value: String(im.banheiros) } : null,
    im.vagas != null ? { icon: Car, label: "Vagas", value: String(im.vagas) } : null,
    im.area_privativa ? { icon: Ruler, label: "Área privativa", value: `${im.area_privativa} m²` } : null,
    im.area_total ? { icon: Maximize, label: "Área do terreno", value: `${im.area_total} m²` } : null,
  ].filter(Boolean) as { icon: any; label: string; value: any }[];

  const ficha: [string, string][] = ([
    ["Código do imóvel", codigo],
    ["Tipo", im.tipo_imovel],
    ["Status", im.status_imovel],
    ["Área privativa", im.area_privativa ? `${im.area_privativa} m²` : null],
    ["Área total", im.area_total ? `${im.area_total} m²` : null],
    ["Quartos", im.dormitorios != null ? `${im.dormitorios}${im.suites ? ` (${im.suites} suíte${im.suites > 1 ? "s" : ""})` : ""}` : null],
    ["Banheiros", im.banheiros != null ? String(im.banheiros) : null],
    ["Lavabo", im.lavabo != null ? (im.lavabo === true ? "Sim" : String(im.lavabo)) : null],
    ["Vagas", im.vagas != null ? String(im.vagas) : null],
    ["Padrão", im.padrao],
    ["Condição", im.condicao],
    ["Vista", im.vista],
    ["Posição solar", im.posicao_solar],
    ["Posição no prédio", im.posicao_predio],
    ["Aceita permuta", im.aceita_permuta ? "Sim" : null],
  ] as [string, any][]).filter(([, v]) => v != null && v !== "") as [string, string][];

  const downloads = [
    pdfComercialUrl ? { icon: FileText, title: "PDF comercial", sub: "Abrir/baixar PDF", href: pdfComercialUrl } : null,
    primeiroVideo ? { icon: Video, title: "Vídeo", sub: "Assistir na página", onClick: () => videoRef.current?.scrollIntoView({ behavior: "smooth" }) } : null,
    tour360 ? { icon: Compass, title: "Tour 360°", sub: "Visita virtual", href: tour360 } : null,
    im.link_material ? { icon: Layers, title: "Material completo", sub: "Abrir material do imóvel", href: im.link_material } : null,
    im.link_drive_fotos ? { icon: HardDrive, title: "Acessar Drive completo", sub: "Abrir pasta no Drive", href: im.link_drive_fotos } : null,
    mapaPdfUrl ? { icon: MapIcon, title: "Mapa / Implantação", sub: "PDF do condomínio", href: mapaPdfUrl } : null,
  ].filter(Boolean) as any[];

  const atalhos = [
    pdfComercialUrl ? { icon: FileText, label: "PDF comercial", title: "Abrir PDF comercial", href: pdfComercialUrl } : null,
    im.link_material ? { icon: Layers, label: "Material completo", title: "Abrir material completo", href: im.link_material } : null,
    im.link_drive_fotos ? { icon: HardDrive, label: "Drive completo", title: "Acessar Drive completo", href: im.link_drive_fotos } : null,
    mapaPdfUrl ? { icon: MapIcon, label: "Mapa", title: "Mapa / implantação do condomínio", href: mapaPdfUrl } : null,
  ].filter(Boolean) as any[];

  const waHref = `https://wa.me/${WHATS}?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar para imóveis</span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={share}
              className="h-10 inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 text-[13px] font-medium transition-all duration-150 hover:border-accent/45 hover:bg-muted">
              <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Compartilhar</span>
            </button>
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="h-10 inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground transition-all duration-150 hover:brightness-95">
              <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
            {logged && (
              <button onClick={() => toggleFav(id)}
                className={`h-10 inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 text-[13px] font-medium transition-all duration-150 hover:border-accent/45 ${isFav ? "text-accent border-accent/45" : ""}`}>
                <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} /> <span className="hidden sm:inline">Salvar imóvel</span>
              </button>
            )}
            {canEdit && (
              <a href={`/imoveis/${id}/editar`} title="Editar imóvel"
                className="h-10 inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 text-[13px] font-medium transition-all duration-150 hover:border-accent/45 hover:bg-muted">
                <Pencil className="w-4 h-4" /> <span className="hidden lg:inline">Editar</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-5 md:space-y-6">
        {/* Galeria */}
        <div className="relative w-full aspect-[4/3] md:aspect-video bg-muted rounded-2xl overflow-hidden">
          {images.length ? (
            <img src={images[idx]} alt={im.titulo || "Imóvel"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
          )}
          {images.length > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="bg-foreground/70 text-background text-xs px-2 py-1 rounded">{idx + 1}/{images.length}</span>
              <button onClick={() => setLightbox(true)} title="Tela cheia"
                className="bg-foreground/70 text-background rounded-full p-2 hover:bg-foreground">
                <Expand className="w-4 h-4" />
              </button>
            </div>
          )}
          {images.length > 1 && (
            <>
              <button onClick={prev} title="Anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-foreground/60 text-background rounded-full p-2 hover:bg-foreground">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={next} title="Próxima"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-foreground/60 text-background rounded-full p-2 hover:bg-foreground">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          {badgesGaleria.length > 0 && (
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
              {badgesGaleria.map((b) => <Badge key={b}>{b}</Badge>)}
            </div>
          )}
        </div>

        {/* Miniaturas */}
        {images.length > 1 && (
          <div className="relative">
            <button onClick={() => thumbsRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
              className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-full p-1.5 shadow">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div ref={thumbsRef} className="flex gap-2 overflow-x-auto scrollbar-none py-1">
              {images.map((src, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 ${i === idx ? "border-accent" : "border-transparent"}`}>
                  <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />
                </button>
              ))}
            </div>
            <button onClick={() => thumbsRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-full p-1.5 shadow">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Atalhos de mídia */}
        {atalhos.length > 0 && (
          <div className="flex flex-wrap gap-2 w-full">
            {atalhos.map((a, i) => {
              const Icon = a.icon;
              const cls = "flex-1 min-w-24 inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm hover:bg-muted transition-colors";
              return a.href ? (
                <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" title={a.title} className={cls}>
                  <Icon className="w-4 h-4 text-accent" /> {a.label}
                </a>
              ) : (
                <button key={i} onClick={a.onClick} title={a.title} className={cls}>
                  <Icon className="w-4 h-4 text-accent" /> {a.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Cabeçalho do imóvel */}
        <section className="rounded-2xl border bg-card shadow-sm p-5 md:p-7 space-y-4">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <a href="/" className="hover:text-foreground inline-flex items-center gap-1"><Home className="w-3 h-3" /> Início</a>
            <span>›</span>
            <a href="/imoveis" className="hover:text-foreground">Imóveis</a>
            {im.tipo_imovel && (<><span>›</span><span>{im.tipo_imovel}</span></>)}
            {empreendimento && (<><span>›</span><span className="text-foreground">{empreendimento}</span></>)}
          </nav>

          {im.status_imovel && (
            <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-deep">
              {im.status_imovel}
            </span>
          )}

          <h1 className="text-2xl md:text-[30px] font-semibold tracking-tight leading-tight">{im.titulo || "Imóvel"}</h1>

          {identBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {identBadges.map((b) => (
                <span key={b.label} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{b.label}:</span> {b.value}
                </span>
              ))}
            </div>
          )}

          <div>
            <div className="text-[26px] md:text-[30px] font-semibold tracking-tight text-accent">{formatBRL(im.preco)}</div>
            {im.preco_parcelado && <div className="text-sm text-muted-foreground">Parcelado: {im.preco_parcelado}</div>}
            {im.bonus && <div className="text-sm text-accent-deep">Bônus: {im.bonus}</div>}
            {im.condicoes_pagamento && typeof im.condicoes_pagamento === "string" && (
              <div className="text-sm text-muted-foreground mt-1">{im.condicoes_pagamento}</div>
            )}
          </div>

          {endereco && (
            <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-accent" /> {endereco}{im.cep ? ` — CEP ${im.cep}` : ""}
            </p>
          )}

          {stats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5 border-t">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-canvas px-3 py-4 text-center transition-colors duration-150 hover:border-accent/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10">
                    <s.icon className="h-4 w-4 text-accent" />
                  </span>
                  <span className="text-lg font-semibold leading-none">{s.value}</span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Downloads e materiais */}
        {downloads.length > 0 && (
          <Section title="Downloads e materiais">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {downloads.map((d, i) => {
                const Icon = d.icon;
                const inner = (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10"><Icon className="w-4 h-4 text-accent" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{d.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">{d.sub}</span>
                    </span>
                  </>
                );
                const cls = "flex items-center gap-3 rounded-xl border bg-canvas p-3 text-left transition-all duration-150 hover:border-accent/45 hover:bg-accent/5 cursor-pointer";
                return d.href ? (
                  <a key={i} href={d.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                ) : (
                  <button key={i} onClick={d.onClick} className={cls}>{inner}</button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Vídeo */}
        {primeiroVideo && (
          <div ref={videoRef}>
            <Section title="Vídeo do imóvel">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
                {toEmbedUrl(primeiroVideo) ? (
                  <iframe src={toEmbedUrl(primeiroVideo)!} title="Vídeo do imóvel"
                    className="absolute inset-0 w-full h-full" allowFullScreen loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                ) : isFileVideo(primeiroVideo) ? (
                  <video controls className="absolute inset-0 w-full h-full" src={primeiroVideo} />
                ) : (
                  <a href={primeiroVideo} target="_blank" rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center text-primary underline">
                    Assistir vídeo
                  </a>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* Tour 360 */}
        {tour360 && (
          <Section title="Tour 360°">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
              <iframe src={tour360} title="Tour 360°" className="absolute inset-0 w-full h-full" allowFullScreen loading="lazy" />
            </div>
          </Section>
        )}

        {/* Sobre / ficha */}
        {(im.descricao || ficha.length > 0) && (
          <Section title="Sobre o imóvel">
            <div className="grid md:grid-cols-2 gap-6">
              {im.descricao && (
                <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{im.descricao}</p>
              )}
              {ficha.length > 0 && (
                <dl className="divide-y rounded-xl border overflow-hidden bg-canvas/60 self-start w-full">
                  {ficha.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className={`font-medium text-right ${k === "Status" ? "text-accent" : ""}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Section>
        )}

        {/* Infraestrutura */}
        {(Array.isArray(im.infraestrutura) && im.infraestrutura.length > 0) ||
        (Array.isArray(im.outras_caracteristicas) && im.outras_caracteristicas.length > 0) ? (
          <Section title="Infraestrutura e características">
            <div className="flex flex-wrap gap-2">
              {[
                ...(Array.isArray(im.infraestrutura) ? im.infraestrutura : []),
                ...(Array.isArray(im.outras_caracteristicas) ? im.outras_caracteristicas : []),
              ].map((c: string, i: number) => <Chip key={i}>{c}</Chip>)}
            </div>
          </Section>
        ) : null}

        {/* Condições de pagamento (lista) */}
        {Array.isArray(im.condicoes_pagamento) && im.condicoes_pagamento.length > 0 && (
          <Section title="Condições de pagamento">
            <div className="flex flex-wrap gap-2">
              {im.condicoes_pagamento.map((c: string, i: number) => <Chip key={i}>{c}</Chip>)}
            </div>
          </Section>
        )}

        {/* Localização */}
        {mapSrc && (
          <Section title="Localização">
            <p className="text-sm text-muted-foreground mb-3 flex items-start gap-1.5">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {endereco || mapQuery}
            </p>
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border">
              <iframe src={mapSrc} title="Mapa" className="absolute inset-0 w-full h-full" loading="lazy" />
            </div>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
              target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent font-medium hover:underline">
              Ver no Google Maps
            </a>
          </Section>
        )}

        {/* Action bar */}
        <div className="rounded-2xl border bg-card shadow-sm p-3 md:p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs md:text-sm text-muted-foreground">Código: <span className="font-medium text-foreground">{codigo}</span></div>

          <div className="flex md:items-center gap-2">
            <button onClick={share}
              className="h-11 w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition-all duration-150 hover:border-accent/45 hover:bg-muted hover:-translate-y-px">
              <Share2 className="w-4 h-4" /> Compartilhar
            </button>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center">
          <button onClick={() => setLightbox(false)} title="Fechar"
            className="absolute top-4 right-4 text-background p-2 rounded-full hover:bg-background/20">
            <X className="w-6 h-6" />
          </button>
          {images.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-4 text-background p-2 rounded-full hover:bg-background/20">
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button onClick={next} className="absolute right-4 text-background p-2 rounded-full hover:bg-background/20">
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <img src={images[idx]} alt="" className="max-h-[90vh] max-w-[92vw] object-contain" />
          <div className="absolute bottom-4 text-background text-sm">{idx + 1} / {images.length}</div>
        </div>
      )}
    </div>
  );
}
