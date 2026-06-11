import { useEffect, useMemo, useState } from "react";
import { Building2, Camera, Map as MapIcon, Table2, MapPin, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG, TIPOLOGIA_CONFIG, TIPO_LABELS,
  type EmpreendimentoTipo, type Unit, type UnitStatus,
  generateUnits, fmtBRL,
} from "@/lib/espelho";

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
  espelho_grupos?: number | null;
  espelho_por_grupo?: number | null;
};

type SectionId = "midia" | "implantacao" | "tabela";

export function EspelhoSheet({ tipo, empreendimentoId }: Props) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const isAdmin = role === "super_admin" || role === "secretaria";
  const labels = TIPO_LABELS[tipo];

  const [emp, setEmp] = useState<EmpData | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("tabela");
  const [gerando, setGerando] = useState(false);

  async function loadAll() {
    setLoading(true);
    const { data: e } = await supabase
      .from(labels.table)
      .select("*")
      .eq("id", empreendimentoId)
      .maybeSingle();

    // pega a primeira imagem da galeria como cover
    const { data: imgs } = await supabase
      .from("estrutura_imagens")
      .select("url, ordem")
      .eq("estrutura_tipo", tipo)
      .eq("estrutura_id", empreendimentoId)
      .order("ordem", { ascending: true })
      .limit(1);

    setEmp(e ? { ...(e as any), cover_url: imgs?.[0]?.url ?? null } : null);

    const { data: u, error } = await supabase
      .from("espelho_unidades" as any)
      .select("*")
      .eq("empreendimento_tipo", tipo)
      .eq("empreendimento_id", empreendimentoId)
      .order("grupo", { ascending: false })
      .order("numero", { ascending: true });
    if (error) toast.error(error.message);
    setUnits((u as unknown as Unit[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (empreendimentoId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, empreendimentoId]);

  const stats = useMemo(() => ({
    total: units.length,
    disponivel: units.filter(u => u.status === "disponivel").length,
    reservado: units.filter(u => u.status === "reservado").length,
    vendido: units.filter(u => u.status === "vendido").length,
    grupos: new Set(units.map(u => u.grupo)).size,
  }), [units]);

  const byGroup = useMemo(() => {
    const map = new Map<number, Unit[]>();
    for (const u of units) {
      if (!map.has(u.grupo)) map.set(u.grupo, []);
      map.get(u.grupo)!.push(u);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [units]);

  async function gerarEspelho() {
    if (!emp) return;
    if (!isAdmin) { toast.error("Apenas super admin / secretaria"); return; }
    const grupos = emp.espelho_grupos ?? 0;
    const porGrupo = emp.espelho_por_grupo ?? 0;
    if (!grupos || !porGrupo) {
      toast.error(`Defina quantidade de ${labels.grupoPlural} e ${labels.unidadePlural} por ${labels.grupo.toLowerCase()} no cadastro.`);
      return;
    }
    if (units.length > 0 && !confirm("Já existem unidades. Substituir tudo?")) return;
    setGerando(true);
    try {
      if (units.length > 0) {
        await supabase
          .from("espelho_unidades" as any)
          .delete()
          .eq("empreendimento_tipo", tipo)
          .eq("empreendimento_id", empreendimentoId);
      }
      const payload = generateUnits(tipo, empreendimentoId, grupos, porGrupo);
      const { error } = await supabase.from("espelho_unidades" as any).insert(payload as any);
      if (error) throw error;
      toast.success(`${payload.length} ${labels.unidadePlural} geradas`);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar espelho");
    } finally {
      setGerando(false);
    }
  }

  async function changeStatus(unit: Unit, status: UnitStatus) {
    if (!isAdmin) return;
    const { error } = await supabase
      .from("espelho_unidades" as any)
      .update({ status })
      .eq("id", unit.id);
    if (error) { toast.error(error.message); return; }
    setUnits(prev => prev.map(u => u.id === unit.id ? { ...u, status } : u));
    toast.success(`${unit.numero}: ${STATUS_CONFIG[status].label}`);
  }

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
          <img src={emp.cover_url} alt={emp.nome} className="w-full h-full object-cover" />
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label={labels.unidadePlural} value={stats.total} color="bg-muted-foreground" />
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
        {isAdmin && (
          <Button size="sm" variant="outline" className="ml-auto" disabled={gerando} onClick={gerarEspelho}>
            {gerando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {units.length ? "Regenerar espelho" : "Gerar espelho"}
          </Button>
        )}
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
          <div className="px-4 py-3 border-b text-sm font-medium text-foreground/80 flex items-center justify-between">
            <span>
              {stats.grupos} {stats.grupos === 1 ? labels.grupo.toLowerCase() : labels.grupoPlural} • {stats.total} {labels.unidadePlural}
            </span>
          </div>

          {units.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma {labels.unidade.toLowerCase()} cadastrada.{" "}
              {isAdmin && "Clique em 'Gerar espelho' para popular automaticamente."}
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-2 overflow-x-auto">
              {byGroup.map(([grupo, list]) => (
                <div key={grupo} className="flex items-stretch gap-2">
                  <div className="shrink-0 w-14 sm:w-16 flex items-center justify-center rounded-md bg-muted/60 text-xs font-bold text-muted-foreground">
                    {grupo}º {labels.grupo.charAt(0)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map(u => (
                      <UnitCell key={u.id} unit={u} isAdmin={isAdmin} onStatusChange={changeStatus} />
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

function UnitCell({
  unit, isAdmin, onStatusChange,
}: {
  unit: Unit;
  isAdmin: boolean;
  onStatusChange: (u: Unit, s: UnitStatus) => void;
}) {
  const cfg = STATUS_CONFIG[unit.status];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 text-xs font-bold transition-colors flex items-center justify-center",
            cfg.cellClass,
          )}
          title={`${unit.numero} — ${cfg.label}`}
        >
          {unit.numero.replace(/^[QB]\d+-/, "")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">{unit.tipologia ? TIPOLOGIA_CONFIG[unit.tipologia]?.label : ""}</p>
              <h3 className="text-lg font-bold">{unit.numero}</h3>
            </div>
            <Badge className={cn("text-[10px]", cfg.cellClass, "border-0")}>{cfg.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <Info label="Valor">{fmtBRL(unit.valor)}</Info>
            <Info label="Área">{unit.area != null ? `${unit.area} m²` : "—"}</Info>
            {unit.vagas != null && <Info label="Vagas">{unit.vagas}</Info>}
            {unit.suites != null && <Info label="Suítes">{unit.suites}</Info>}
            {unit.nascente && <Info label="Nascente">Sim</Info>}
          </div>

          {isAdmin && (
            <div className="pt-2 border-t">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Alterar status</p>
              <Select value={unit.status} onValueChange={(v) => onStatusChange(unit, v as UnitStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
