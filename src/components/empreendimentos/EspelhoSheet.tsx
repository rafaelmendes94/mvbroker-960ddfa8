import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Camera, Map as MapIcon, Table2, MapPin, Loader2,
  Grid3x3, Upload, Plus, Trash2, Download, Link2, Link2Off, Eye, Search,
  Bed, Bath, Car, Ruler, ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImovelDrawer } from "@/components/imoveis/ImovelDrawer";
import {
  STATUS_CONFIG, TIPOLOGIA_CONFIG, TIPO_LABELS, CSV_TEMPLATE, TIPO_TO_IMOVEL_FK,
  type EmpreendimentoTipo, type Unit, type UnitStatus, type Tipologia,
  generateSkeleton, parseEspelhoCSV, fmtBRL,
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
};

type SectionId = "midia" | "implantacao" | "tabela";

const TIPOLOGIAS: Tipologia[] = ["studio", "1quarto", "2quartos", "3quartos", "cobertura", "lote"];

export function EspelhoSheet({ tipo, empreendimentoId }: Props) {
  const { user } = useAuth();
  const { roles } = useRoles();
  const isAdmin = roles.includes("super_admin") || roles.includes("secretaria");
  const labels = TIPO_LABELS[tipo];

  const [emp, setEmp] = useState<EmpData | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("tabela");

  async function loadAll() {
    setLoading(true);
    const { data: e } = await supabase
      .from(labels.table)
      .select("*")
      .eq("id", empreendimentoId)
      .maybeSingle();

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
    indisponivel: units.filter(u => u.status === "indisponivel").length,
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

  async function saveUnit(unitId: string, patch: Partial<Unit>) {
    const { error } = await supabase
      .from("espelho_unidades" as any)
      .update(patch)
      .eq("id", unitId);
    if (error) { toast.error(error.message); return false; }
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, ...patch } as Unit : u));
    return true;
  }

  async function deleteUnit(unitId: string) {
    if (!confirm("Excluir esta unidade?")) return;
    const { error } = await supabase.from("espelho_unidades" as any).delete().eq("id", unitId);
    if (error) { toast.error(error.message); return; }
    setUnits(prev => prev.filter(u => u.id !== unitId));
    toast.success("Unidade excluída");
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
          {/* Toolbar admin */}
          {isAdmin && (
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2 bg-muted/30">
              <CriarGradeDialog
                tipo={tipo}
                empreendimentoId={empreendimentoId}
                labels={labels}
                jaTemUnidades={units.length > 0}
                onDone={loadAll}
              />
              <ImportarCsvDialog
                tipo={tipo}
                empreendimentoId={empreendimentoId}
                labels={labels}
                onDone={loadAll}
              />
              <NovaUnidadeDialog
                tipo={tipo}
                empreendimentoId={empreendimentoId}
                labels={labels}
                onDone={loadAll}
              />
            </div>
          )}

          <div className="px-4 py-3 border-b text-sm font-medium text-foreground/80 flex items-center justify-between">
            <span>
              {stats.grupos} {stats.grupos === 1 ? labels.grupo.toLowerCase() : labels.grupoPlural} • {stats.total} {labels.unidadePlural}
            </span>
          </div>

          {units.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma {labels.unidade.toLowerCase()} cadastrada.{" "}
              {isAdmin && (
                <>Use <b>Criar grade</b> para gerar a estrutura vazia, <b>Importar CSV</b> ou <b>+ Nova unidade</b>.</>
              )}
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
                      <UnitCell
                        key={u.id}
                        unit={u}
                        isAdmin={isAdmin}
                        onSave={saveUnit}
                        onDelete={deleteUnit}
                      />
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

/* ===== Dialogs ===== */

function CriarGradeDialog({
  tipo, empreendimentoId, labels, jaTemUnidades, onDone,
}: {
  tipo: EmpreendimentoTipo;
  empreendimentoId: string;
  labels: typeof TIPO_LABELS[EmpreendimentoTipo];
  jaTemUnidades: boolean;
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [grupos, setGrupos] = useState(1);
  const [porGrupo, setPorGrupo] = useState(10);
  const [busy, setBusy] = useState(false);
  const [substituir, setSubstituir] = useState(false);

  async function run() {
    if (!grupos || !porGrupo) { toast.error("Preencha grupos e unidades por grupo"); return; }
    setBusy(true);
    try {
      if (jaTemUnidades && substituir) {
        const { error } = await supabase
          .from("espelho_unidades" as any).delete()
          .eq("empreendimento_tipo", tipo).eq("empreendimento_id", empreendimentoId);
        if (error) throw error;
      }
      const payload = generateSkeleton(tipo, empreendimentoId, grupos, porGrupo);
      const { error } = await supabase.from("espelho_unidades" as any).insert(payload as any);
      if (error) throw error;
      toast.success(`${payload.length} ${labels.unidadePlural} criadas (vazias)`);
      setOpen(false);
      await onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar grade");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Grid3x3 className="h-4 w-4 mr-1.5" /> Criar grade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar grade vazia</DialogTitle>
          <DialogDescription>
            Gera apenas a estrutura numerada (sem valores). Depois você edita cada {labels.unidade.toLowerCase()} clicando nela.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1.5">
            <Label>Quantos {labels.grupoPlural}?</Label>
            <Input type="number" min={1} value={grupos} onChange={e => setGrupos(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>{labels.unidadePlural} por {labels.grupo.toLowerCase()}?</Label>
            <Input type="number" min={1} value={porGrupo} onChange={e => setPorGrupo(parseInt(e.target.value) || 0)} />
          </div>
        </div>
        {jaTemUnidades && (
          <div className="flex items-center justify-between rounded-md border p-3 bg-warning/10">
            <div>
              <p className="text-sm font-medium">Já existem unidades</p>
              <p className="text-xs text-muted-foreground">Ative para apagar tudo e recriar.</p>
            </div>
            <Switch checked={substituir} onCheckedChange={setSubstituir} />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={run} disabled={busy || (jaTemUnidades && !substituir)}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarCsvDialog({
  tipo, empreendimentoId, labels, onDone,
}: {
  tipo: EmpreendimentoTipo;
  empreendimentoId: string;
  labels: typeof TIPO_LABELS[EmpreendimentoTipo];
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ rows: number; errors: string[] } | null>(null);
  const [rowsBuf, setRowsBuf] = useState<any[]>([]);
  const [substituir, setSubstituir] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "espelho-modelo.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    const text = await file.text();
    const { rows, errors } = parseEspelhoCSV(text, tipo, empreendimentoId);
    setRowsBuf(rows);
    setPreview({ rows: rows.length, errors });
  }

  async function importar() {
    if (rowsBuf.length === 0) { toast.error("Nada para importar"); return; }
    setBusy(true);
    try {
      if (substituir) {
        const { error } = await supabase.from("espelho_unidades" as any).delete()
          .eq("empreendimento_tipo", tipo).eq("empreendimento_id", empreendimentoId);
        if (error) throw error;
      }
      const { error } = await supabase.from("espelho_unidades" as any).insert(rowsBuf as any);
      if (error) throw error;
      toast.success(`${rowsBuf.length} ${labels.unidadePlural} importadas`);
      setOpen(false);
      setPreview(null); setRowsBuf([]); setSubstituir(false);
      await onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setRowsBuf([]); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1.5" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar planilha CSV</DialogTitle>
          <DialogDescription>
            Colunas: <code>grupo, numero, valor, area, tipologia, vagas, suites, nascente, status, observacoes</code>.
            Só <b>grupo</b> e <b>numero</b> são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1.5" /> Baixar modelo
          </Button>
          <Input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          {preview && (
            <div className="rounded-md border p-3 text-sm space-y-1.5">
              <p><b>{preview.rows}</b> linhas válidas detectadas.</p>
              {preview.errors.length > 0 && (
                <div className="text-xs text-destructive max-h-24 overflow-auto">
                  {preview.errors.slice(0, 5).map((e, i) => <div key={i}>• {e}</div>)}
                  {preview.errors.length > 5 && <div>… +{preview.errors.length - 5} erros</div>}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Substituir unidades existentes</p>
              <p className="text-xs text-muted-foreground">Se ativo, apaga tudo antes de importar.</p>
            </div>
            <Switch checked={substituir} onCheckedChange={setSubstituir} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={busy || !preview || preview.rows === 0}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaUnidadeDialog({
  tipo, empreendimentoId, labels, onDone,
}: {
  tipo: EmpreendimentoTipo;
  empreendimentoId: string;
  labels: typeof TIPO_LABELS[EmpreendimentoTipo];
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Omit<Unit, "id">>({
    empreendimento_tipo: tipo,
    empreendimento_id: empreendimentoId,
    grupo: 1,
    numero: "",
    status: "disponivel",
    valor: null,
    area: null,
    tipologia: tipo === "loteamento" ? "lote" : null,
    vagas: null,
    suites: null,
    nascente: false,
  });

  async function salvar() {
    if (!form.numero.trim()) { toast.error("Informe o número"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("espelho_unidades" as any).insert(form as any);
      if (error) throw error;
      toast.success("Unidade adicionada");
      setOpen(false);
      setForm(f => ({ ...f, numero: "" }));
      await onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1.5" /> Nova {labels.unidade.toLowerCase()}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova {labels.unidade.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <UnitFormFields form={form} setForm={setForm} labels={labels} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnitFormFields({
  form, setForm, labels,
}: {
  form: Omit<Unit, "id"> | Unit;
  setForm: (updater: (f: any) => any) => void;
  labels: typeof TIPO_LABELS[EmpreendimentoTipo];
}) {
  const numField = (key: keyof Unit, label: string, step = "1") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={(form as any)[key] ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          setForm(f => ({ ...f, [key]: v === "" ? null : Number(v) }));
        }}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 pt-1">
      <div className="space-y-1">
        <Label className="text-xs">{labels.grupo}</Label>
        <Input
          type="number" min={1}
          value={form.grupo}
          onChange={(e) => setForm(f => ({ ...f, grupo: parseInt(e.target.value) || 1 }))}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Número</Label>
        <Input
          value={form.numero}
          onChange={(e) => setForm(f => ({ ...f, numero: e.target.value }))}
        />
      </div>
      {numField("valor", "Valor (R$)")}
      {numField("area", "Área (m²)", "0.01")}
      <div className="space-y-1">
        <Label className="text-xs">Tipologia</Label>
        <Select
          value={form.tipologia ?? "_none"}
          onValueChange={(v) => setForm(f => ({ ...f, tipologia: v === "_none" ? null : v as Tipologia }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            {TIPOLOGIAS.map(t => (
              <SelectItem key={t} value={t}>{TIPOLOGIA_CONFIG[t].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => setForm(f => ({ ...f, status: v as UnitStatus }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="reservado">Reservado</SelectItem>
            <SelectItem value="vendido">Vendido</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {numField("vagas", "Vagas")}
      {numField("suites", "Suítes")}
      <div className="col-span-2 flex items-center justify-between rounded-md border p-2.5">
        <Label className="text-xs">Nascente</Label>
        <Switch
          checked={!!form.nascente}
          onCheckedChange={(v) => setForm(f => ({ ...f, nascente: v }))}
        />
      </div>
    </div>
  );
}

function UnitCell({
  unit, isAdmin, onSave, onDelete,
}: {
  unit: Unit;
  isAdmin: boolean;
  onSave: (id: string, patch: Partial<Unit>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[unit.status];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Unit>(unit);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(unit); }, [unit]);

  async function quickStatus(status: UnitStatus) {
    const ok = await onSave(unit.id, { status });
    if (ok) toast.success(`${unit.numero}: ${STATUS_CONFIG[status].label}`);
  }
  async function salvar() {
    setBusy(true);
    const { id, ...patch } = form;
    const ok = await onSave(unit.id, patch);
    setBusy(false);
    if (ok) { toast.success("Salvo"); setEditing(false); }
  }

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
          {unit.numero.replace(/^[QB]\d+-L?/, "")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {!editing ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {unit.tipologia ? TIPOLOGIA_CONFIG[unit.tipologia]?.label : "Sem tipologia"}
                </p>
                <h3 className="text-lg font-bold">{unit.numero}</h3>
              </div>
              <Badge className={cn("text-[10px]", cfg.cellClass, "border-0")}>{cfg.label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <Info label="Valor">{fmtBRL(unit.valor)}</Info>
              <Info label="Área">{unit.area != null ? `${unit.area} m²` : "—"}</Info>
              <Info label="Vagas">{unit.vagas ?? "—"}</Info>
              <Info label="Suítes">{unit.suites ?? "—"}</Info>
              <Info label="Nascente">{unit.nascente ? "Sim" : "Não"}</Info>
            </div>

            <ImovelLinkSection unit={unit} isAdmin={isAdmin} onSave={onSave} />


            {isAdmin && (
              <div className="pt-2 border-t space-y-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Status rápido</p>
                  <Select value={unit.status} onValueChange={(v) => quickStatus(v as UnitStatus)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indisponivel">Indisponível</SelectItem>
                      <SelectItem value="disponivel">Disponível</SelectItem>
                      <SelectItem value="reservado">Reservado</SelectItem>
                      <SelectItem value="vendido">Vendido</SelectItem>
                    </SelectContent>

                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(true)}>
                    Editar dados
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(unit.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Editar {unit.numero}</h3>
            <UnitFormFields
              form={form}
              setForm={(updater) => setForm(updater as any)}
              labels={TIPO_LABELS[unit.empreendimento_tipo]}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(unit); }}>Cancelar</Button>
              <Button size="sm" onClick={salvar} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
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

/* ===== Vínculo com imóvel cadastrado ===== */

type ImovelLite = {
  id: string;
  titulo: string | null;
  codigo_interno: string | null;
  unidade: string | null;
  preco: number | null;
  area_total: number | null;
  dormitorios: number | null;
  suites: number | null;
  vagas: number | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  foto_capa_url?: string | null;
};

function ImovelLinkSection({
  unit, isAdmin, onSave,
}: {
  unit: Unit;
  isAdmin: boolean;
  onSave: (id: string, patch: Partial<Unit>) => Promise<boolean>;
}) {
  const fk = TIPO_TO_IMOVEL_FK[unit.empreendimento_tipo];
  const [linked, setLinked] = useState<ImovelLite | null>(null);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<ImovelLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const SELECT_COLS = "id, titulo, codigo_interno, unidade, preco, area_total, dormitorios, suites, vagas, bairro, cidade, uf";

  async function fetchCoverFor(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const { data } = await supabase
      .from("imovel_imagens")
      .select("imovel_id, url, capa, ordem")
      .in("imovel_id", ids)
      .order("capa", { ascending: false })
      .order("ordem", { ascending: true });
    const map: Record<string, string> = {};
    for (const row of (data as any[]) ?? []) {
      if (!map[row.imovel_id] && row.url) map[row.imovel_id] = row.url;
    }
    return map;
  }

  // Carrega o imóvel vinculado (se houver)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!unit.imovel_id) { setLinked(null); return; }
      setLoadingLinked(true);
      const { data } = await supabase
        .from("imoveis")
        .select(SELECT_COLS)
        .eq("id", unit.imovel_id)
        .maybeSingle();
      const covers = data ? await fetchCoverFor([(data as any).id]) : {};
      if (!cancelled) {
        setLinked(data ? { ...(data as any), foto_capa_url: covers[(data as any).id] ?? null } : null);
        setLoadingLinked(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [unit.imovel_id]);

  // Busca imóveis do mesmo empreendimento
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("imoveis")
        .select(SELECT_COLS)
        .eq(fk, unit.empreendimento_id)
        .eq("arquivado", false)
        .order("unidade", { ascending: true })
        .limit(50);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(
          `titulo.ilike.${term},codigo_interno.ilike.${term},unidade.ilike.${term}`,
        );
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) toast.error(error.message);
      const rows = (data as any[]) ?? [];
      const covers = await fetchCoverFor(rows.map((r) => r.id));
      if (cancelled) return;
      setList(rows.map((r) => ({ ...r, foto_capa_url: covers[r.id] ?? null })) as ImovelLite[]);
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pickerOpen, q, fk, unit.empreendimento_id]);

  async function vincular(im: ImovelLite) {
    const patch: Partial<Unit> = {
      imovel_id: im.id,
      valor: im.preco ?? unit.valor,
      area: im.area_total ?? unit.area,
      suites: im.suites ?? unit.suites,
      vagas: im.vagas ?? unit.vagas,
    };
    const ok = await onSave(unit.id, patch);
    if (ok) {
      toast.success(`Vinculado a ${im.unidade || im.codigo_interno || im.titulo}`);
      setLinked(im);
      setPickerOpen(false);
    }
  }

  async function desvincular() {
    const ok = await onSave(unit.id, { imovel_id: null });
    if (ok) {
      toast.success("Vínculo removido");
      setLinked(null);
    }
  }

  const endereco = linked
    ? [linked.bairro, linked.cidade && `${linked.cidade}${linked.uf ? "/" + linked.uf : ""}`].filter(Boolean).join(", ")
    : "";

  return (
    <div className="pt-2 border-t space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Imóvel cadastrado</p>
      {loadingLinked ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando…
        </div>
      ) : linked ? (
        <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
          <div className="aspect-video bg-muted relative">
            {linked.foto_capa_url ? (
              <img src={linked.foto_capa_url} alt={linked.titulo ?? ""} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Building2 className="h-8 w-8" />
              </div>
            )}
            {linked.preco != null && (
              <div className="absolute bottom-1.5 left-1.5 bg-background/90 backdrop-blur rounded px-2 py-0.5 text-[11px] font-bold">
                {fmtBRL(linked.preco)}
              </div>
            )}
          </div>
          <div className="p-2.5 space-y-2">
            <div>
              <p className="text-xs font-semibold truncate">
                {linked.unidade ? `Un. ${linked.unidade} • ` : ""}{linked.titulo || "Sem título"}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">{linked.codigo_interno}</p>
              {endereco && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" /> {endereco}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground border-t pt-1.5">
              {linked.dormitorios != null && <span className="flex items-center gap-0.5"><Bed className="h-3 w-3" />{linked.dormitorios}</span>}
              {linked.suites != null && linked.suites > 0 && <span className="flex items-center gap-0.5"><Bath className="h-3 w-3" />{linked.suites}</span>}
              {linked.vagas != null && <span className="flex items-center gap-0.5"><Car className="h-3 w-3" />{linked.vagas}</span>}
              {linked.area_total != null && <span className="flex items-center gap-0.5"><Ruler className="h-3 w-3" />{linked.area_total}m²</span>}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => setViewerId(linked.id)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
              </Button>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link to="/imoveis/$id/editar" params={{ id: linked.id }}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Cadastro
                </Link>
              </Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={desvincular}>
                  <Link2Off className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

          </div>
          <ImovelDrawer id={viewerId} open={!!viewerId} onOpenChange={(o) => !o && setViewerId(null)} />
        </div>
      ) : isAdmin ? (
        <Popover open={pickerOpen} onOpenChange={(v) => { setPickerOpen(v); if (v) setQ(""); }}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="w-full h-8 text-xs">
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Vincular imóvel cadastrado
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="relative mb-2">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Buscar por unidade, código ou título…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-auto -mx-2 px-2">
              {searching ? (
                <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : list.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum imóvel cadastrado neste empreendimento.
                </p>
              ) : (
                <div className="space-y-1">
                  {list.map((im) => (
                    <button
                      key={im.id}
                      onClick={() => vincular(im)}
                      className="w-full text-left rounded-md p-1.5 hover:bg-accent text-xs flex gap-2 items-center"
                    >
                      <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                        {im.foto_capa_url ? (
                          <img src={im.foto_capa_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {im.unidade ? `Un. ${im.unidade} • ` : ""}{im.titulo || "Sem título"}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex gap-2">
                          <span>{im.codigo_interno || "—"}</span>
                          {im.preco != null && <span className="font-semibold text-foreground">{fmtBRL(im.preco)}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum imóvel vinculado.</p>
      )}
    </div>
  );
}

