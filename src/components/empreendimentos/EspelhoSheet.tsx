import { useEffect, useMemo, useState } from "react";
import {
  Building2, Camera, Map as MapIcon, Table2, MapPin, Loader2,
  Plus, ExternalLink, LayoutGrid, List as ListIcon, Grid3x3,
  BedDouble, Bath, Car, Ruler,
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

type TabelaView = "espelho" | "lista" | "blocos";

interface Props {
  tipo: EmpreendimentoTipo;
  empreendimentoId: string;
}

type EmpData = {
  id: string;
  nome: string;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cover_url?: string | null;
  cover_fallback_url?: string | null;
};

type SectionId = "midia" | "implantacao" | "tabela";

const FK: Record<EmpreendimentoTipo, "edificio_id" | "condominio_id" | "loteamento_id"> = {
  edificio: "edificio_id",
  condominio: "condominio_id",
  loteamento: "loteamento_id",
};

const IMOVEL_SELECT =
  "id, titulo, codigo_interno, quadra, lote, unidade, box, numero, preco, area_total, dormitorios, vagas, suites, status_imovel";

export function EspelhoSheet({ tipo, empreendimentoId }: Props) {
  const labels = TIPO_LABELS[tipo];

  const [emp, setEmp] = useState<EmpData | null>(null);
  const [imoveis, setImoveis] = useState<ImovelEspelho[]>([]);
  const [imagens, setImagens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("tabela");
  const [tabelaView, setTabelaView] = useState<TabelaView>("espelho");

  async function loadAll() {
    setLoading(true);
    const { data: e } = await supabase
      .from(labels.table)
      .select("*")
      .eq("id", empreendimentoId)
      .maybeSingle();

    const { data: imgs } = await supabase
      .from("estrutura_imagens")
      .select("storage_path, url, capa, ordem")
      .eq("estrutura_tipo", tipo)
      .eq("estrutura_id", empreendimentoId)
      .order("capa", { ascending: false })
      .order("ordem", { ascending: true })
      .limit(1);

    const coverUrls = await getEstruturaImageUrls((imgs?.[0] as any)?.storage_path || (imgs?.[0] as any)?.url);
    setEmp(e ? { ...(e as any), cover_url: coverUrls?.url ?? null, cover_fallback_url: coverUrls?.fallbackUrl ?? null } : null);

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
          { id: "midia" as const, label: "Mídia", icon: Camera },
          { id: "implantacao" as const, label: "Implantação", icon: MapIcon },
          { id: "tabela" as const, label: "Tabela", icon: Table2 },
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

      {/* Section content */}
      {section === "midia" && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Galeria de mídias é gerenciada no cadastro do {labels.grupo.toLowerCase()}.
        </div>
      )}
      {section === "implantacao" && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Anexe a planta de implantação na galeria do cadastro.
        </div>
      )}
      {section === "tabela" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-muted/30">
            <span className="text-sm font-medium text-foreground/80">
              {grupos.length} {grupos.length === 1 ? labels.grupo.toLowerCase() : labels.grupoPlural} • {stats.total} {labels.unidadePlural}
            </span>
            <Button asChild size="sm">
              <Link to="/imoveis/novo">
                <Plus className="h-4 w-4 mr-1.5" /> Novo imóvel
              </Link>
            </Button>
          </div>

          {imoveis.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum imóvel cadastrado neste {tipo}. Cadastre imóveis vinculando-os a este {tipo} para vê-los aqui.
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
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
