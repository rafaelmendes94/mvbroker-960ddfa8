import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, TrendingUp, Flame, Coins, Star, Waves, Crown,
  Building2, RefreshCw, ImageIcon, MapPin, BedDouble, Bath, Car,
  Scan, Maximize2, Paintbrush,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/oportunidades")({
  component: OportunidadesPage,
});

type Imovel = {
  id: string;
  codigo_interno: string | null;
  titulo: string | null;
  cidade: string | null;
  bairro: string | null;
  preco: number | null;
  bonus: string | null;
  exclusividade: boolean | null;
  exclusivo: boolean | null;
  vista_mar: boolean | null;
  decorado: boolean | null;
  padrao: string | null;
  destaque_home: boolean | null;
  dormitorios: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_privativa: number | null;
  area_total: number | null;
  created_at: string;
  updated_at: string;
  capa?: string | null;
};

type Resumo = {
  novos_hoje: number;
  novos_7d: number;
  novos_30d: number;
  atualizados_7d: number;
  exclusivos: number;
  com_bonus: number;
  destaque: number;
  vista_mar: number;
  alto_padrao: number;
};

const fmtBRL = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ---------- Helpers ---------- //
async function fetchImoveis(filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>, limit = 12) {
  const sel = filter(base())
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data } = await sel;
  return await attachCapas((data ?? []) as Imovel[]);
}
function base() {
  return supabase
    .from("imoveis")
    .select("id, codigo_interno, titulo, cidade, bairro, preco, bonus, exclusividade, exclusivo, vista_mar, decorado, padrao, destaque_home, dormitorios, banheiros, vagas, area_privativa, area_total, created_at, updated_at")
    .or("arquivado.is.null,arquivado.eq.false");
}
async function attachCapas(items: Imovel[]): Promise<Imovel[]> {
  if (!items.length) return items;
  const ids = items.map((i) => i.id);
  const { data: imgs } = await supabase
    .from("imovel_imagens")
    .select("imovel_id, storage_path, url, capa, ordem")
    .in("imovel_id", ids)
    .order("capa", { ascending: false })
    .order("ordem", { ascending: true });
  const rows = (imgs ?? []) as any[];

  // Pega a primeira imagem por imóvel
  const firstByImovel = new Map<string, any>();
  rows.forEach((im) => {
    if (!firstByImovel.has(im.imovel_id)) firstByImovel.set(im.imovel_id, im);
  });

  // Gera signed URLs para bucket privado "imoveis"
  const paths = Array.from(firstByImovel.values())
    .map((im) => im.storage_path || im.url)
    .filter((p): p is string => !!p && !p.startsWith("http"));
  const signedMap: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("imoveis")
      .createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s: any) => {
      if (s?.path && s?.signedUrl) signedMap[s.path] = s.signedUrl;
    });
  }

  const map = new Map<string, string>();
  firstByImovel.forEach((im, imovelId) => {
    const p = im.storage_path || im.url;
    if (!p) return;
    const u = p.startsWith("http") ? p : signedMap[p];
    if (u) map.set(imovelId, u);
  });

  return items.map((i) => ({ ...i, capa: map.get(i.id) ?? null }));
}

// ---------- Page ---------- //
function OportunidadesPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [novos, setNovos] = useState<Imovel[]>([]);
  const [atualizados, setAtualizados] = useState<Imovel[]>([]);
  const [exclusivos, setExclusivos] = useState<Imovel[]>([]);
  const [bonus, setBonus] = useState<Imovel[]>([]);
  const [vistaMar, setVistaMar] = useState<Imovel[]>([]);
  const [decorados, setDecorados] = useState<Imovel[]>([]);
  const [altoPadrao, setAltoPadrao] = useState<Imovel[]>([]);
  const [destaques, setDestaques] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: r } = await supabase.rpc("get_oportunidades_resumo");
      setResumo(Array.isArray(r) ? (r[0] as Resumo) : (r as unknown as Resumo));

      const [a, b, c, d, e, f, g, h] = await Promise.all([
        fetchImoveis((q) => q, 12),
        fetchImoveis((q) => q.gt("updated_at", new Date(Date.now() - 7 * 86400000).toISOString()), 12),
        fetchImoveis((q) => q.or("exclusividade.eq.true,exclusivo.eq.true"), 12),
        fetchImoveis((q) => q.not("bonus", "is", null).neq("bonus", ""), 12),
        fetchImoveis((q) => q.eq("vista_mar", true), 12),
        fetchImoveis((q) => q.eq("decorado", true), 12),
        fetchImoveis((q) => q.ilike("padrao", "alto%"), 12),
        fetchImoveis((q) => q.eq("destaque_home", true), 12),
      ]);
      setNovos(a); setAtualizados(b); setExclusivos(c); setBonus(d);
      setVistaMar(e); setDecorados(f); setAltoPadrao(g); setDestaques(h);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Oportunidades"
        description="As melhores oportunidades disponíveis na base agora."
      />

      <Indicadores resumo={resumo} loading={loading} />

      <Secao titulo="Recém Cadastrados" icon={Sparkles} accent="text-blue-600" items={novos} loading={loading} />
      <Secao titulo="Atualizações Recentes" icon={RefreshCw} accent="text-emerald-600" items={atualizados} loading={loading} />
      <Secao titulo="Exclusividades" icon={Flame} accent="text-orange-600" badge={{ label: "Exclusivo", className: "bg-orange-500" }} items={exclusivos} loading={loading} />
      <Secao titulo="Imóveis com Bônus" icon={Coins} accent="text-amber-600" badge={{ label: "Bônus", className: "bg-amber-500" }} items={bonus} loading={loading} mostraBonus />
      <Secao titulo="Destaques" icon={Star} accent="text-violet-600" items={destaques} loading={loading} />
      <Secao titulo="Vista Mar" icon={Waves} accent="text-cyan-600" items={vistaMar} loading={loading} />
      <Secao titulo="Decorados" icon={Building2} accent="text-rose-600" items={decorados} loading={loading} />
      <Secao titulo="Alto Padrão" icon={Crown} accent="text-yellow-600" items={altoPadrao} loading={loading} />
    </div>
  );
}

// ---------- Indicadores ---------- //
function Indicadores({ resumo, loading }: { resumo: Resumo | null; loading: boolean }) {
  const cards = useMemo(
    () => [
      { label: "Novos hoje", value: resumo?.novos_hoje ?? 0, icon: Sparkles, color: "text-blue-600 bg-blue-50" },
      { label: "Últimos 7 dias", value: resumo?.novos_7d ?? 0, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
      { label: "Últimos 30 dias", value: resumo?.novos_30d ?? 0, icon: TrendingUp, color: "text-teal-600 bg-teal-50" },
      { label: "Atualizados", value: resumo?.atualizados_7d ?? 0, icon: RefreshCw, color: "text-indigo-600 bg-indigo-50" },
      { label: "Exclusivos", value: resumo?.exclusivos ?? 0, icon: Flame, color: "text-orange-600 bg-orange-50" },
      { label: "Com bônus", value: resumo?.com_bonus ?? 0, icon: Coins, color: "text-amber-600 bg-amber-50" },
      { label: "Destaques", value: resumo?.destaque ?? 0, icon: Star, color: "text-violet-600 bg-violet-50" },
      { label: "Vista mar", value: resumo?.vista_mar ?? 0, icon: Waves, color: "text-cyan-600 bg-cyan-50" },
      { label: "Alto padrão", value: resumo?.alto_padrao ?? 0, icon: Crown, color: "text-yellow-600 bg-yellow-50" },
    ],
    [resumo],
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-lg grid place-items-center", c.color)}>
            <c.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold leading-tight">{loading ? "—" : c.value}</div>
            <div className="text-xs text-muted-foreground truncate">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Seção ---------- //
function Secao({
  titulo, icon: Icon, accent, items, loading, badge, mostraBonus,
}: {
  titulo: string;
  icon: typeof Sparkles;
  accent: string;
  items: Imovel[];
  loading: boolean;
  badge?: { label: string; className: string };
  mostraBonus?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className={cn("h-5 w-5", accent)} />
          {titulo}
        </h2>
        <Link to="/imoveis" className="text-xs text-primary hover:underline">Ver todos</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Nenhum imóvel nesta seção.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {items.map((im) => (
            <OportunidadeCard key={im.id} im={im} badge={badge} mostraBonus={mostraBonus} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Card (mesmo padrão da grid de Imóveis, somente leitura) ---------- //
function OportunidadeCard({
  im, badge, mostraBonus,
}: {
  im: Imovel;
  badge?: { label: string; className: string };
  mostraBonus?: boolean;
}) {
  const endereco = [im.bairro, im.cidade].filter(Boolean).join(", ");
  return (
    <div className="elevated-card rounded-xl overflow-hidden relative transition-all duration-300 group/card border bg-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {im.capa ? (
          <img
            src={im.capa}
            alt={im.titulo ?? "Imóvel"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {im.codigo_interno && (
          <span className="absolute left-3 top-3 z-20 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {im.codigo_interno}
          </span>
        )}

        {badge && (
          <span className={cn("absolute right-3 top-3 z-20 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase text-white", badge.className)}>
            {badge.label}
          </span>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-end">
          <div className="flex gap-1">
            {im.vista_mar && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/90 text-white backdrop-blur-sm flex items-center gap-0.5">
                <Waves className="w-2.5 h-2.5" /> Mar
              </span>
            )}
            {im.decorado && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/90 text-white backdrop-blur-sm flex items-center gap-0.5">
                <Paintbrush className="w-2.5 h-2.5" /> Dec.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xl font-bold text-foreground">{fmtBRL(im.preco)}</p>
          <h3 className="font-semibold text-card-foreground text-sm uppercase mt-1 line-clamp-2">
            {im.titulo ?? "Sem título"}
          </h3>
          {endereco && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground line-clamp-1">{endereco}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-y border-border">
          {im.dormitorios ? (
            <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {im.dormitorios}</span>
          ) : null}
          {im.banheiros ? (
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {im.banheiros}</span>
          ) : null}
          {im.vagas ? (
            <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {im.vagas}</span>
          ) : null}
          {im.area_total ? (
            <span className="flex items-center gap-1"><Scan className="w-3.5 h-3.5" /> {Number(im.area_total)}m² t.</span>
          ) : null}
          {im.area_privativa ? (
            <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> {Number(im.area_privativa)}m² p.</span>
          ) : null}
        </div>

        {mostraBonus && im.bonus && (
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
            +{im.bonus}
          </Badge>
        )}
      </div>
    </div>
  );
}
