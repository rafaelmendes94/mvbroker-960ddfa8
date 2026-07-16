import { useEffect, useMemo, useState } from "react";
import {
  Building2, Camera, Map as MapIcon, Table2, MapPin, Loader2,
  Plus, ExternalLink, LayoutGrid, List as ListIcon, Grid3x3,
  FileText, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getEstruturaImageUrls } from "@/lib/estrutura-images";

import {
  STATUS_CONFIG, TIPO_LABELS, fmtBRL,
  type EmpreendimentoTipo,
} from "@/lib/espelho";
import {
  agruparImoveis, rotuloCelula, statusCelula, extrairBloco, extrairAndar,
  type ImovelEspelho,
} from "@/lib/espelho-grouping";
import { CAMPOS_POR_TIPO, formatCampo } from "@/lib/estrutura-campos";
import { OportunidadeCard, type OportunidadeImovel } from "@/components/imoveis/OportunidadeCard";

type TabelaView = "espelho" | "lista" | "blocos";

interface Props {
  tipo: EmpreendimentoTipo;
  empreendimentoId: string;
}

type EmpData = Record<string, any> & {
  id: string;
  nome: string;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  descricao?: string | null;
  codigo_interno?: string | null;
  infraestrutura?: string[] | null;
  implantacao_pdf_path?: string | null;
  cover_url?: string | null;
  cover_fallback_url?: string | null;
};

type SectionId = "info" | "midia" | "implantacao" | "tabela";

const FK: Record<EmpreendimentoTipo, "edificio_id" | "condominio_id" | "loteamento_id"> = {
  edificio: "edificio_id",
  condominio: "condominio_id",
  loteamento: "loteamento_id",
};

const IMOVEL_SELECT =
  "id, titulo, codigo_interno, quadra, lote, unidade, box, numero, preco, area_total, area_privativa, dormitorios, banheiros, vagas, suites, status_imovel, bairro, cidade, vista_mar, decorado, bonus";

type GaleriaImg = { id: string; url: string; fallbackUrl?: string | null };

export function EspelhoSheet({ tipo, empreendimentoId }: Props) {
  const labels = TIPO_LABELS[tipo];

  const [emp, setEmp] = useState<EmpData | null>(null);
  const [imoveis, setImoveis] = useState<ImovelEspelho[]>([]);
  const [imagens, setImagens] = useState<Record<string, string>>({});
  const [galeria, setGaleria] = useState<GaleriaImg[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("info");
  const [tabelaView, setTabelaView] = useState<TabelaView>("blocos");
  const [lightbox, setLightbox] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    const { data: e } = await supabase
      .from(labels.table)
      .select("*")
      .eq("id", empreendimentoId)
      .maybeSingle();

    // Galeria completa
    const { data: imgs } = await supabase
      .from("estrutura_imagens")
      .select("id, storage_path, url, capa, ordem")
      .eq("estrutura_tipo", tipo)
      .eq("estrutura_id", empreendimentoId)
      .order("capa", { ascending: false })
      .order("ordem", { ascending: true });

    const resolvedGaleria: GaleriaImg[] = [];
    for (const r of (imgs ?? []) as any[]) {
      const urls = await getEstruturaImageUrls(r.storage_path || r.url);
      resolvedGaleria.push({ id: r.id, url: urls?.url ?? r.url ?? "", fallbackUrl: urls?.fallbackUrl ?? null });
    }
    setGaleria(resolvedGaleria);

    const cover = resolvedGaleria[0];
    setEmp(e ? { ...(e as any), cover_url: cover?.url ?? null, cover_fallback_url: cover?.fallbackUrl ?? null } : null);

    // PDF de implantação
    const pdfPath = (e as any)?.implantacao_pdf_path as string | null | undefined;
    if (pdfPath) {
      const { data: signed } = await supabase.storage.from("estrutura-arquivos").createSignedUrl(pdfPath, 3600);
      setPdfUrl(signed?.signedUrl ?? null);
    } else {
      setPdfUrl(null);
    }

    const fk = FK[tipo];
    const { data, error } = await supabase
      .from("imoveis")
      .select(IMOVEL_SELECT)
      .eq(fk, empreendimentoId)
      .or("arquivado.is.null,arquivado.eq.false")
      .limit(5000);
    if (error) toast.error(error.message);
    const lista = (data as unknown as ImovelEspelho[]) ?? [];
    setImoveis(lista);

    // Capas dos imóveis (uma por imóvel)
    const ids = lista.map((i) => i.id);
    if (ids.length) {
      const { data: fotos } = await supabase
        .from("imovel_imagens")
        .select("imovel_id, storage_path, url, ordem, capa")
        .in("imovel_id", ids)
        .order("capa", { ascending: false })
        .order("ordem", { ascending: true });
      const first: Record<string, string> = {};
      const paths: string[] = [];
      (fotos || []).forEach((f: any) => {
        if (first[f.imovel_id]) return;
        const p = f.storage_path || f.url;
        if (!p) return;
        first[f.imovel_id] = p;
        if (!p.startsWith("http")) paths.push(p);
      });
      const signedMap: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("imoveis").createSignedUrls(paths, 3600);
        (signed || []).forEach((s: any) => { if (s?.path && s?.signedUrl) signedMap[s.path] = s.signedUrl; });
      }
      const resolved: Record<string, string> = {};
      Object.entries(first).forEach(([id, p]) => {
        resolved[id] = p.startsWith("http") ? p : (signedMap[p] || "");
      });
      setImagens(resolved);
    } else {
      setImagens({});
    }

    setLoading(false);
  }

  useEffect(() => {
    if (empreendimentoId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, empreendimentoId]);

  const stats = useMemo(() => {
    let indisponivel = 0, disponivel = 0, reservado = 0, vendido = 0;
    for (const i of imoveis) {
      const s = statusCelula(i);
      if (s === "disponivel") disponivel++;
      else if (s === "reservado") reservado++;
      else if (s === "vendido") vendido++;
      else indisponivel++;
    }
    return { total: imoveis.length, indisponivel, disponivel, reservado, vendido };
  }, [imoveis]);

  const grupos = useMemo(() => agruparImoveis(tipo, imoveis), [tipo, imoveis]);

  const campos = CAMPOS_POR_TIPO[tipo] ?? [];
  const camposPreenchidos = emp ? campos.filter((c) => emp[c.key] != null && emp[c.key] !== "") : [];

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!emp) return <div className="py-12 text-center text-muted-foreground">Empreendimento não encontrado.</div>;

  const endereco = [emp.logradouro, emp.numero, emp.bairro, emp.cidade && `${emp.cidade}${emp.estado ? "/" + emp.estado : ""}`]
    .filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative w-full h-56 sm:h-72 overflow-hidden rounded-xl border bg-muted">
        {emp.cover_url ? (
          <img
            src={emp.cover_url}
            alt={emp.nome}
            className="w-full h-full object-cover"
            onError={(e) => {
              if (emp.cover_fallback_url && e.currentTarget.src !== emp.cover_fallback_url) e.currentTarget.src = emp.cover_fallback_url;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Building2 className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-2 capitalize">{tipo}</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground drop-shadow truncate">{emp.nome}</h2>
            {endereco && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" /> {endereco}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard label={labels.unidadePlural} value={stats.total} color="bg-muted-foreground" />
        <StatCard label="Indisponíveis" value={stats.indisponivel} color={STATUS_CONFIG.indisponivel.dotClass} />
        <StatCard label="Disponíveis" value={stats.disponivel} color={STATUS_CONFIG.disponivel.dotClass} />
        <StatCard label="Reservados" value={stats.reservado} color={STATUS_CONFIG.reservado.dotClass} />
        <StatCard label="Vendidos" value={stats.vendido} color={STATUS_CONFIG.vendido.dotClass} />
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "info" as const, label: "Informações", icon: Building2 },
          { id: "midia" as const, label: "Mídia", icon: Camera },
          { id: "implantacao" as const, label: "Implantação", icon: MapIcon },
          { id: "tabela" as const, label: "Imóveis", icon: Table2 },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors border",
              section === s.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Info section */}
      {section === "info" && (
        <div className="space-y-4">
          {emp.descricao && (
            <div className="rounded-xl border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sobre</h3>
              <p className="text-sm text-foreground/90 whitespace-pre-line">{emp.descricao}</p>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Dados</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
              {emp.codigo_interno && <Info label="Código">{emp.codigo_interno}</Info>}
              <Info label="Situação">{emp.ativo ? "Ativo" : "Inativo"}</Info>
              {camposPreenchidos.map((c) => (
                <Info key={c.key} label={c.label}>{formatCampo(emp[c.key], c.type)}</Info>
              ))}
              {(emp.latitude != null && emp.longitude != null) && (
                <Info label="Coordenadas">{emp.latitude?.toFixed?.(5)}, {emp.longitude?.toFixed?.(5)}</Info>
              )}
            </div>
            {camposPreenchidos.length === 0 && !emp.codigo_interno && (
              <p className="text-xs text-muted-foreground">Nenhuma informação específica cadastrada.</p>
            )}
          </div>

          {emp.infraestrutura && emp.infraestrutura.length > 0 && (
            <div className="rounded-xl border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Infraestrutura</h3>
              <div className="flex flex-wrap gap-1.5">
                {emp.infraestrutura.map((it) => (
                  <Badge key={it} variant="secondary" className="text-xs">{it}</Badge>
                ))}
              </div>
            </div>
          )}

          {endereco && (
            <div className="rounded-xl border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Endereço</h3>
              <p className="text-sm text-foreground/90">{endereco}</p>
              {emp.latitude != null && emp.longitude != null && (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a
                    href={`https://www.google.com/maps?q=${emp.latitude},${emp.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    <MapPin className="h-3.5 w-3.5 mr-1.5" /> Abrir no Google Maps
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mídia section */}
      {section === "midia" && (
        <div className="rounded-xl border bg-card p-4">
          {galeria.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma imagem cadastrada.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {galeria.map((g, idx) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setLightbox(idx)}
                    className="relative aspect-video rounded-md overflow-hidden bg-muted border group"
                  >
                    <img
                      src={g.url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        if (g.fallbackUrl && e.currentTarget.src !== g.fallbackUrl) e.currentTarget.src = g.fallbackUrl;
                      }}
                    />
                  </button>
                ))}
              </div>

              {lightbox != null && galeria[lightbox] && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setLightbox(null)}
                >
                  <button
                    className="absolute top-4 right-4 text-white/80 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
                    aria-label="Fechar"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <button
                    className="absolute left-4 text-white/80 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i == null ? 0 : (i - 1 + galeria.length) % galeria.length)); }}
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    className="absolute right-4 text-white/80 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i == null ? 0 : (i + 1) % galeria.length)); }}
                    aria-label="Próxima"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                  <img
                    src={galeria[lightbox].url}
                    alt=""
                    className="max-h-[90vh] max-w-[90vw] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Implantação section */}
      {section === "implantacao" && (
        <div className="rounded-xl border bg-card p-4">
          {pdfUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir em nova aba
                  </a>
                </Button>
              </div>
              <div className="rounded-md border overflow-hidden bg-muted/30">
                <iframe src={pdfUrl} title="Implantação" className="w-full h-[70vh]" />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <FileText className="h-8 w-8" />
              Nenhum PDF de implantação enviado. Anexe no cadastro deste {tipo}.
            </div>
          )}
        </div>
      )}

      {/* Tabela section */}
      {section === "tabela" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-muted/30">
            <span className="text-sm font-medium text-foreground/80">
              {grupos.length} {grupos.length === 1 ? labels.grupo.toLowerCase() : labels.grupoPlural} • {stats.total} {labels.unidadePlural}
            </span>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border bg-background p-0.5">
                {([
                  { id: "blocos" as const, Icon: LayoutGrid, label: "Cards" },
                  { id: "espelho" as const, Icon: Grid3x3, label: "Espelho" },
                  { id: "lista" as const, Icon: ListIcon, label: "Lista" },
                ]).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setTabelaView(v.id)}
                    className={cn(
                      "flex items-center gap-1 h-8 px-2.5 rounded text-xs font-medium transition-colors",
                      tabelaView === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                    title={v.label}
                  >
                    <v.Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{v.label}</span>
                  </button>
                ))}
              </div>
              <Button asChild size="sm">
                <Link to="/imoveis/novo">
                  <Plus className="h-4 w-4 mr-1.5" /> Novo imóvel
                </Link>
              </Button>
            </div>
          </div>

          {imoveis.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum imóvel cadastrado neste {tipo}. Cadastre imóveis vinculando-os a este {tipo} para vê-los aqui.
            </div>
          ) : tabelaView === "espelho" ? (
            <div className="p-3 sm:p-4 space-y-3 overflow-x-auto">
              {grupos.map((g) => (
                <div key={g.chave} className="flex items-stretch gap-2">
                  <div className="shrink-0 w-20 sm:w-24 flex items-center justify-center rounded-md bg-muted/60 text-xs font-bold text-muted-foreground text-center px-1">
                    {g.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.imoveis.map((im) => (
                      <UnitCell key={im.id} tipo={tipo} imovel={im} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : tabelaView === "blocos" ? (
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {imoveis.map((im) => {
                const op: OportunidadeImovel = {
                  id: im.id,
                  codigo_interno: im.codigo_interno ?? null,
                  titulo: im.titulo ?? null,
                  cidade: (im as any).cidade ?? null,
                  bairro: (im as any).bairro ?? null,
                  preco: im.preco ?? null,
                  bonus: (im as any).bonus ?? null,
                  vista_mar: (im as any).vista_mar ?? null,
                  decorado: (im as any).decorado ?? null,
                  dormitorios: im.dormitorios ?? null,
                  banheiros: (im as any).banheiros ?? null,
                  vagas: im.vagas ?? null,
                  area_privativa: (im as any).area_privativa ?? null,
                  area_total: im.area_total ?? null,
                  capa: imagens[im.id] ?? null,
                };
                return <OportunidadeCard key={im.id} im={op} />;
              })}
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-2">
              {imoveis.map((im) => (
                <ImovelRow key={im.id} tipo={tipo} imovel={im} imagem={imagens[im.id]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImovelRow({ tipo, imovel, imagem }: { tipo: EmpreendimentoTipo; imovel: ImovelEspelho; imagem?: string }) {
  const status = statusCelula(imovel);
  const cfg = STATUS_CONFIG[status];
  const rotulo = rotuloCelula(tipo, imovel);
  return (
    <Link
      to="/imoveis/$id/editar"
      params={{ id: imovel.id }}
      className="group grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-card p-2 transition-colors hover:border-primary"
    >
      <div className="h-16 w-20 rounded-md overflow-hidden bg-muted shrink-0">
        {imagem ? (
          <img src={imagem} alt={imovel.titulo || rotulo} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground"><Building2 className="h-5 w-5" /></div>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">{imovel.titulo || `Imóvel ${rotulo}`}</p>
          <Badge className={cn("text-[10px] shrink-0 border-0", cfg.cellClass)}>{cfg.label}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{imovel.codigo_interno || "—"}</span> · {rotulo}
          {imovel.dormitorios != null && ` · ${imovel.dormitorios} dorm`}
          {imovel.vagas != null && ` · ${imovel.vagas} vaga${imovel.vagas === 1 ? "" : "s"}`}
          {imovel.area_total != null && ` · ${imovel.area_total} m²`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-primary text-sm">{fmtBRL(imovel.preco)}</p>
      </div>
    </Link>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5 text-center">
      <div className={cn("w-2 h-2 rounded-full mx-auto mb-1", color)} />
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">{label}</p>
    </div>
  );
}

function UnitCell({ tipo, imovel }: { tipo: EmpreendimentoTipo; imovel: ImovelEspelho }) {
  const status = statusCelula(imovel);
  const cfg = STATUS_CONFIG[status];
  const rotulo = rotuloCelula(tipo, imovel);
  const bloco = tipo === "condominio" ? extrairBloco(imovel.unidade, imovel.quadra) : null;
  const andar = tipo === "edificio" ? extrairAndar(imovel.unidade) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "min-w-14 h-14 sm:min-w-16 sm:h-16 px-2 rounded-lg border-2 text-xs font-bold transition-colors flex items-center justify-center",
            cfg.cellClass,
          )}
          title={`${rotulo} — ${cfg.label}`}
        >
          {rotulo}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{imovel.codigo_interno ?? ""}</p>
              <h3 className="text-base font-bold truncate">{imovel.titulo || rotulo}</h3>
            </div>
            <Badge className={cn("text-[10px] shrink-0", cfg.cellClass, "border-0")}>{cfg.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {imovel.quadra && <Info label="Quadra">{imovel.quadra}</Info>}
            {imovel.lote && <Info label="Lote">{imovel.lote}</Info>}
            {bloco && <Info label="Bloco">{bloco}</Info>}
            {andar != null && <Info label="Andar">{andar}</Info>}
            {imovel.unidade && <Info label="Unidade">{imovel.unidade}</Info>}
            {imovel.box && <Info label="Box">{imovel.box}</Info>}
            {imovel.numero && <Info label="Número">{imovel.numero}</Info>}
            <Info label="Valor">{fmtBRL(imovel.preco)}</Info>
            <Info label="Área">{imovel.area_total != null ? `${imovel.area_total} m²` : "—"}</Info>
            <Info label="Dorm.">{imovel.dormitorios ?? "—"}</Info>
            <Info label="Suítes">{imovel.suites ?? "—"}</Info>
            <Info label="Vagas">{imovel.vagas ?? "—"}</Info>
          </div>

          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/imoveis/$id/editar" params={{ id: imovel.id }}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir imóvel
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}
