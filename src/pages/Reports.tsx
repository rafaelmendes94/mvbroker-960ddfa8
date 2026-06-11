import { useState, useMemo, useRef, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/MetricCard";
import { useReportData, RealSaleRecord } from "@/hooks/useReportData";
import { formatCurrency } from "@/data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine, LineChart, Line, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Target, Calendar, Download,
  Trophy, Building2, Home, MapPin, Star, BarChart3, CalendarDays,
  CalendarRange, ArrowUp, ArrowDown, ChevronDown, SlidersHorizontal, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ManualSalesDialog } from "@/components/relatorios/ManualSalesDialog";
import { AgenciamentosBI } from "@/components/relatorios/AgenciamentosBI";
import { Database, Briefcase } from "lucide-react";
import { generateReportPdf } from "@/utils/generateReportPdf";
import { toast } from "sonner";

const SEGMENT_COLORS: Record<string, string> = {
  "Luxo": "hsl(142, 71%, 45%)", "Alto Padrão": "hsl(142, 50%, 55%)",
  "Médio Padrão": "hsl(38, 92%, 50%)", "Econômico": "hsl(0, 72%, 51%)",
};
const TYPE_COLORS: Record<string, string> = {
  "Apartamento": "hsl(142, 71%, 45%)", "Casa": "hsl(142, 50%, 60%)",
  "Comercial": "hsl(38, 92%, 50%)", "Terreno": "hsl(0, 60%, 55%)",
};

const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_MAP: Record<string, number> = { "Jan": 0, "Fev": 1, "Mar": 2, "Abr": 3, "Mai": 4, "Jun": 5, "Jul": 6, "Ago": 7, "Set": 8, "Out": 9, "Nov": 10, "Dez": 11 };

type TimePeriod = "Todos" | "Dia" | "Semana" | "Mês" | "Ano";
type TabType = "relatorio" | "comparativo" | "agenciamentos";

function isToday(d: string) { return new Date(d).toDateString() === new Date().toDateString(); }
function isThisWeek(d: string) {
  const date = new Date(d), now = new Date(), ws = new Date(now);
  ws.setDate(now.getDate() - now.getDay()); ws.setHours(0, 0, 0, 0);
  return date >= ws && date <= now;
}
function isThisMonth(d: string) { const dt = new Date(d), now = new Date(); return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear(); }
function isThisYear(d: string) { return new Date(d).getFullYear() === new Date().getFullYear(); }

const METRICS_ORDER_KEY = "mv-reports-metrics-order";
function DraggableBlocks({
  items,
  storageKey,
  className = "",
}: {
  items: { key: string; node: React.ReactNode }[];
  storageKey: string;
  className?: string;
}) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]") as string[];
      const valid = saved.filter(k => items.some(i => i.key === k));
      const missing = items.map(i => i.key).filter(k => !valid.includes(k));
      return [...valid, ...missing];
    } catch { return items.map(i => i.key); }
  });
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  useEffect(() => {
    const keys = items.map(i => i.key);
    setOrder(prev => {
      const valid = prev.filter(k => keys.includes(k));
      const missing = keys.filter(k => !valid.includes(k));
      return [...valid, ...missing];
    });
  }, [items]);

  const persist = (next: string[]) => {
    setOrder(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const ordered = order.map(k => items.find(i => i.key === k)).filter(Boolean) as typeof items;

  return (
    <div className={className}>
      {ordered.map((it, idx) => (
        <div
          key={it.key}
          draggable
          onDragStart={(e) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
          onDragLeave={() => setOverIdx(null)}
          onDrop={(e) => {
            e.preventDefault();
            const from = dragIdx.current;
            if (from === null || from === idx) { setOverIdx(null); return; }
            const next = [...order];
            const [moved] = next.splice(from, 1);
            next.splice(idx, 0, moved);
            persist(next);
            dragIdx.current = null;
            setOverIdx(null);
          }}
          onDragEnd={() => { dragIdx.current = null; setOverIdx(null); }}
          className={`cursor-grab active:cursor-grabbing transition-all ${overIdx === idx ? "ring-2 ring-primary scale-[1.01]" : ""}`}
          title="Arraste para reordenar"
        >
          {it.node}
        </div>
      ))}
    </div>
  );
}

function DraggableMetrics({ items }: { items: { key: string; node: React.ReactNode }[] }) {
  return (
    <DraggableBlocks
      items={items}
      storageKey={METRICS_ORDER_KEY}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
    />
  );
}

function FilterChip({ label, active, onClick, onRemove, size = "sm" }: {
  label: string; active: boolean; onClick: () => void; onRemove?: () => void; size?: "sm" | "xs";
}) {
  return (
    <button onClick={onClick} className={`
      ${size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}
      rounded-md font-medium transition-all inline-flex items-center gap-1 border
      ${active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      }
    `}>
      {label}
      {active && onRemove && <X className="w-2.5 h-2.5 ml-0.5 opacity-70" onClick={(e) => { e.stopPropagation(); onRemove(); }} />}
    </button>
  );
}

function SelectFilter({ icon: Icon, options, value, onChange }: {
  label?: string; icon: React.ElementType; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-border rounded-md px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer appearance-none pr-6"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function useRankings(filtered: RealSaleRecord[]) {
  return useMemo(() => {
    const rank = (key: keyof RealSaleRecord | ((s: RealSaleRecord) => string)) => {
      const map: Record<string, { count: number; vgv: number }> = {};
      filtered.forEach(s => {
        const k = typeof key === "function" ? key(s) : String(s[key]);
        if (!k) return;
        if (!map[k]) map[k] = { count: 0, vgv: 0 };
        map[k].count++; map[k].vgv += s.price;
      });
      return Object.entries(map).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.vgv - a.vgv);
    };
    const filterEmpty = (arr: { name: string; count: number; vgv: number }[]) => arr.filter(r => r.name && r.name !== "Avulso");
    const bedroomsLabel = (n: number) => {
      if (!n || n <= 0) return "Sem informação";
      if (n >= 5) return "5+ dormitórios";
      return `${n} ${n === 1 ? "dormitório" : "dormitórios"}`;
    };
    const byBedrooms = rank(s => bedroomsLabel(s.bedrooms))
      .filter(r => r.name !== "Sem informação")
      .sort((a, b) => {
        const na = parseInt(a.name) || 0;
        const nb = parseInt(b.name) || 0;
        return na - nb;
      });
    return {
      byType: rank("type"), bySegment: rank("segment"), byCity: rank("city"),
      byBroker: rank("broker"), byOwner: rank("owner"), byNeighborhood: rank("neighborhood"),
      byEmpreendimento: rank(s => s.empreendimento || "Avulso"),
      byEdificio: filterEmpty(rank(s => s.edificio || "")),
      byCondominio: filterEmpty(rank(s => s.condominio || "")),
      byBedrooms,
    };
  }, [filtered]);
}

export default function Reports() {
  const { sales, manualSales, allCities, allTypes, allSegments, allYears, loading, refetch } = useReportData();
  const [manualOpen, setManualOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>("relatorio");
  const [filterCity, setFilterCity] = useState("Todas");
  const [filterType, setFilterType] = useState("Todos");
  const [filterSegment, setFilterSegment] = useState("Todos");
  const [filterSeaView, setFilterSeaView] = useState("Todos");
  const [filterBedrooms, setFilterBedrooms] = useState("Todos");
  const [filterPeriod, setFilterPeriod] = useState<TimePeriod>("Todos");
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = [filterCity !== "Todas", filterType !== "Todos", filterSegment !== "Todos", filterSeaView !== "Todos", filterBedrooms !== "Todos", filterPeriod !== "Todos", filterMonth !== null, filterYear !== null].filter(Boolean).length;
  const clearAll = () => { setFilterCity("Todas"); setFilterType("Todos"); setFilterSegment("Todos"); setFilterSeaView("Todos"); setFilterBedrooms("Todos"); setFilterPeriod("Todos"); setFilterMonth(null); setFilterYear(null); };

  const filtered = useMemo(() => sales.filter(s => {
    if (filterCity !== "Todas" && s.city !== filterCity) return false;
    if (filterType !== "Todos" && s.type !== filterType) return false;
    if (filterSegment !== "Todos" && s.segment !== filterSegment) return false;
    if (filterSeaView === "Sim" && !s.seaView) return false;
    if (filterSeaView === "Não" && s.seaView) return false;
    if (filterBedrooms !== "Todos") {
      const n = Number(s.bedrooms) || 0;
      if (filterBedrooms === "5+") { if (n < 5) return false; }
      else if (String(n) !== filterBedrooms) return false;
    }
    if (filterPeriod === "Dia" && !isToday(s.date)) return false;
    if (filterPeriod === "Semana" && !isThisWeek(s.date)) return false;
    if (filterPeriod === "Mês" && !isThisMonth(s.date)) return false;
    if (filterPeriod === "Ano" && !isThisYear(s.date)) return false;
    const d = new Date(s.date);
    if (filterMonth !== null && d.getMonth() !== filterMonth) return false;
    if (filterYear !== null && d.getFullYear() !== filterYear) return false;
    return true;
  }), [sales, filterCity, filterType, filterSegment, filterSeaView, filterBedrooms, filterPeriod, filterMonth, filterYear]);

  const currentYear = new Date().getFullYear();
  const currentMonthName = ALL_MONTHS[new Date().getMonth()];

  const vgvYear = filtered.filter(s => isThisYear(s.date)).reduce((sum, s) => sum + s.price, 0);
  const vgvMonth = filtered.filter(s => isThisMonth(s.date)).reduce((sum, s) => sum + s.price, 0);
  const vgvWeek = filtered.filter(s => isThisWeek(s.date)).reduce((sum, s) => sum + s.price, 0);
  const totalSalesYear = filtered.filter(s => isThisYear(s.date)).length;
  const avgTicket = totalSalesYear > 0 ? vgvYear / totalSalesYear : 0;

  const previousYear = currentYear - 1;
  const prevYearSales = filtered.filter(s => new Date(s.date).getFullYear() === previousYear);
  const prevAvgTicket = prevYearSales.length > 0 ? prevYearSales.reduce((sum, s) => sum + s.price, 0) / prevYearSales.length : 0;
  const ticketChange = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket * 100) : 0;

  const rankings = useRankings(filtered);

  const revenueBarData = useMemo(() => {
    const data = ALL_MONTHS.map((month, i) => {
      const targetYear = filterYear ?? new Date().getFullYear();
      const monthSales = filtered.filter(s => { const d = new Date(s.date); return d.getMonth() === i && d.getFullYear() === targetYear; });
      return { month, vendas: monthSales.length, receita: monthSales.reduce((sum, s) => sum + s.price, 0) };
    });
    return data.map((d, i) => {
      const prev = i > 0 ? data[i - 1].receita : d.receita;
      const change = prev > 0 ? ((d.receita - prev) / prev) * 100 : 0;
      return { ...d, change: i === 0 ? 0 : change, trend: i === 0 ? "neutral" as const : change > 0 ? "alta" as const : change < 0 ? "baixa" as const : "neutral" as const };
    });
  }, [filtered, filterYear]);

  const avgRevenue = useMemo(() => {
    const nonZero = revenueBarData.filter(d => d.receita > 0);
    return nonZero.length > 0 ? nonZero.reduce((s, d) => s + d.receita, 0) / nonZero.length : 0;
  }, [revenueBarData]);

  const segmentPie = rankings.bySegment.map(s => ({ name: s.name, value: s.vgv, fill: SEGMENT_COLORS[s.name] || "hsl(var(--chart-4))" }));
  const typePie = rankings.byType.map(s => ({ name: s.name, value: s.count, fill: TYPE_COLORS[s.name] || "hsl(var(--chart-4))" }));

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="reports-scope p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5">
        <BackButton />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório de Vendas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              VGV, ranking e BI de carteira
              {manualSales.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                  {manualSales.length} agenciamento(s) vendido(s)
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setManualOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors">
              <Database className="w-4 h-4" /> Agenciamentos
            </button>
            <button
              onClick={async () => {
                try {
                  await generateReportPdf({
                    filtered, vgvYear, vgvMonth, vgvWeek, totalSalesYear, avgTicket,
                    currentYear, rankings,
                    filters: {
                      city: filterCity, type: filterType, segment: filterSegment,
                      seaView: filterSeaView, period: filterPeriod,
                      month: filterMonth, year: filterYear,
                    },
                  });
                  toast.success("Relatório PDF gerado com sucesso!");
                } catch (e) {
                  console.error(e);
                  toast.error("Erro ao gerar PDF");
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" /> Exportar PDF
            </button>
          </div>
        </div>
        <ManualSalesDialog open={manualOpen} onOpenChange={setManualOpen} onChanged={refetch} />

        <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg w-fit">
          <button onClick={() => setActiveTab("relatorio")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "relatorio" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <BarChart3 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Relatório
          </button>
          <button onClick={() => setActiveTab("comparativo")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "comparativo" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <TrendingUp className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Comparativo Anual
          </button>
          <button onClick={() => setActiveTab("agenciamentos")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "agenciamentos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Briefcase className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />BI Agenciamentos
          </button>
        </div>

        {activeTab === "agenciamentos" ? <AgenciamentosBI /> : activeTab === "relatorio" ? (
          <>
            <DraggableMetrics items={[
              { key: "vgv-ano", node: <MetricCard title={`VGV Ano (${currentYear})`} value={formatCurrency(vgvYear)} change={`${totalSalesYear} vendas`} changeType="positive" icon={CalendarRange} /> },
              { key: "vgv-mes", node: <MetricCard title={`VGV Mês (${currentMonthName})`} value={formatCurrency(vgvMonth)} change={`${filtered.filter(s => isThisMonth(s.date)).length} vendas`} changeType="positive" icon={CalendarDays} /> },
              { key: "vgv-semana", node: <MetricCard title="VGV Semana" value={formatCurrency(vgvWeek)} change={`${filtered.filter(s => isThisWeek(s.date)).length} vendas`} changeType="positive" icon={Calendar} /> },
              { key: "ticket", node: <MetricCard title="Ticket Médio" value={formatCurrency(avgTicket)} change={ticketChange !== 0 ? `${ticketChange > 0 ? "+" : ""}${ticketChange.toFixed(1)}%` : "—"} changeType={ticketChange > 0 ? "positive" : ticketChange < 0 ? "negative" : "neutral"} icon={TrendingUp} /> },
              { key: "total", node: <MetricCard title="Total de Vendas" value={String(totalSalesYear)} change="no período" changeType="neutral" icon={Target} /> },
            ]} />

            <div className="elevated-card rounded-xl p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <SelectFilter icon={MapPin} value={filterCity} onChange={setFilterCity} options={[{ value: "Todas", label: "Todas cidades" }, ...allCities.map(c => ({ value: c, label: c }))]} />
                <SelectFilter icon={Building2} value={filterType} onChange={setFilterType} options={[{ value: "Todos", label: "Todos tipos" }, ...allTypes.map(t => ({ value: t, label: t }))]} />
                <SelectFilter icon={Star} value={filterSegment} onChange={setFilterSegment} options={[{ value: "Todos", label: "Todos" }, ...allSegments.map(s => ({ value: s, label: s }))]} />

                <div className="w-px h-6 bg-border" />

                {(["Dia", "Semana", "Mês", "Ano"] as TimePeriod[]).map(p => (
                  <FilterChip key={p} label={p} active={filterPeriod === p} onClick={() => setFilterPeriod(filterPeriod === p ? "Todos" : p)} />
                ))}

                <div className="ml-auto flex items-center gap-2">
                  {activeFilterCount > 0 && (
                    <button onClick={clearAll} className="text-[10px] text-destructive hover:underline flex items-center gap-0.5">
                      <X className="w-3 h-3" /> Limpar ({activeFilterCount})
                    </button>
                  )}
                  <button onClick={() => setShowAdvanced(!showAdvanced)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${showAdvanced ? "border-primary/30 text-primary bg-primary/5" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <SlidersHorizontal className="w-3 h-3" />
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {showAdvanced && (
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 flex-wrap">
                  <SelectFilter icon={Home} value={filterSeaView} onChange={setFilterSeaView} options={[{ value: "Todos", label: "Todos" }, { value: "Sim", label: "Com vista" }, { value: "Não", label: "Sem vista" }]} />
                  <SelectFilter icon={Home} value={filterBedrooms} onChange={setFilterBedrooms} options={[{ value: "Todos", label: "Todos" }, { value: "1", label: "1 dormitório" }, { value: "2", label: "2 dormitórios" }, { value: "3", label: "3 dormitórios" }, { value: "4", label: "4 dormitórios" }, { value: "5+", label: "5+ dormitórios" }]} />
                </div>
              )}
            </div>

            <div className="elevated-card rounded-xl px-4 py-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" /> Mês
                </span>
                <div className="flex gap-1 flex-wrap">
                  <FilterChip size="xs" label="Todos" active={filterMonth === null} onClick={() => setFilterMonth(null)} />
                  {ALL_MONTHS.map((m, i) => (
                    <FilterChip size="xs" key={m} label={m} active={filterMonth === i} onClick={() => setFilterMonth(filterMonth === i ? null : i)} />
                  ))}
                </div>
                <div className="w-px h-5 bg-border" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarRange className="w-3 h-3" /> Ano
                </span>
                <div className="flex gap-1">
                  <FilterChip size="xs" label="Todos" active={filterYear === null} onClick={() => setFilterYear(null)} />
                  {allYears.map(y => (
                    <FilterChip size="xs" key={y} label={String(y)} active={filterYear === y} onClick={() => setFilterYear(filterYear === y ? null : y)} />
                  ))}
                </div>
              </div>
            </div>

            <DraggableBlocks
              storageKey="mv-reports-blocks-order"
              className="space-y-4"
              items={[
                {
                  key: "charts-row",
                  node: (
                    <div className="space-y-4">
                      <div className="elevated-card rounded-xl p-5">
                        <h3 className="text-base font-semibold text-card-foreground mb-1 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-accent" /> VGV Mensal
                        </h3>
                        <p className="text-[11px] text-muted-foreground mb-3">Clique em uma barra para detalhes</p>
                        <ResponsiveContainer width="100%" height={420}>
                          <BarChart data={revenueBarData} barCategoryGap="20%" onClick={(data: any) => { if (data?.activeLabel) setSelectedMonth(data.activeLabel); }} style={{ cursor: "pointer" }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), "Receita"]} />
                            <ReferenceLine y={avgRevenue} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                            <Bar dataKey="receita" radius={[4, 4, 0, 0]} animationDuration={800}>
                              {revenueBarData.map((entry, i) => (
                                <Cell key={i} fill={entry.trend === "alta" ? "hsl(142, 71%, 45%)" : entry.trend === "baixa" ? "hsl(0, 72%, 51%)" : "hsl(var(--muted-foreground))"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-around mt-2">
                          {revenueBarData.map((d, i) => (
                            <div key={i} className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] font-medium text-muted-foreground">{d.vendas} un.</span>
                              <span className={`text-[11px] font-bold ${d.trend === "alta" ? "text-emerald-500" : d.trend === "baixa" ? "text-destructive" : "text-muted-foreground"}`}>
                                {i === 0 ? "—" : `${d.change > 0 ? "+" : ""}${d.change.toFixed(0)}%`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="elevated-card rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4 text-accent" /> Distribuição
                        </h3>
                        {segmentPie.length === 0 && typePie.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-16">Nenhuma venda registrada</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[11px] text-muted-foreground text-center mb-1 font-medium">Segmento (VGV)</p>
                              <ResponsiveContainer width="100%" height={220}>
                                <PieChart><Pie data={segmentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>{segmentPie.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie>
                                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                                {segmentPie.map(s => <div key={s.name} className="flex items-center gap-1 text-[10px] text-muted-foreground"><div className="w-2 h-2 rounded-full" style={{ background: s.fill }} />{s.name}</div>)}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground text-center mb-1 font-medium">Tipo (Qtd)</p>
                              <ResponsiveContainer width="100%" height={220}>
                                <PieChart><Pie data={typePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>{typePie.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie>
                                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                                {typePie.map(s => <div key={s.name} className="flex items-center gap-1 text-[10px] text-muted-foreground"><div className="w-2 h-2 rounded-full" style={{ background: s.fill }} />{s.name}</div>)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "rankings-1",
                  node: (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <RankingBarCard title="Tipo de Imóvel" data={rankings.byType} colors={TYPE_COLORS} />
                      <RankingBarCard title="Dormitórios" data={rankings.byBedrooms} />
                    </div>
                  ),
                },
                {
                  key: "rankings-entidades",
                  node: (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <RankingListCard title="Edifícios Mais Vendidos" icon={Building2} data={rankings.byEdificio.slice(0, 6)} sales={filtered} field="edificio" />
                      <RankingListCard title="Condomínios Mais Vendidos" icon={Building2} data={rankings.byCondominio.slice(0, 6)} sales={filtered} field="condominio" />
                      <RankingListCard title="Loteamentos Mais Vendidos" icon={Building2} data={rankings.byEmpreendimento.slice(0, 6)} sales={filtered} field="empreendimento" />
                    </div>
                  ),
                },
                {
                  key: "rankings-2",
                  node: (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <RankingProgressCard title="Top Corretores" data={rankings.byBroker} />
                      <RankingProgressCard title="Proprietários" data={rankings.byOwner} />
                    </div>
                  ),
                },
                {
                  key: "rankings-3",
                  node: (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <RankingBarCard title="Cidade" data={rankings.byCity} />
                      <RankingBarCard title="Bairros" data={rankings.byNeighborhood} />
                    </div>
                  ),
                },
                {
                  key: "recent-sales",
                  node: (
                    <div className="elevated-card rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-accent" /> Últimas Vendas
                      </h3>
                      {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda encontrada com os filtros selecionados</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                {["Data", "Imóvel", "Cidade", "Tipo", "Segmento", "Corretor", "Plataforma", "Valor"].map(h => (
                                  <th key={h} className={`py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.slice(0, 10).map(sale => (
                                <tr key={sale.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                  <td className="py-2 text-xs text-muted-foreground">{new Date(sale.date).toLocaleDateString("pt-BR")}</td>
                                  <td className="py-2 text-xs font-medium text-card-foreground">{sale.propertyTitle}</td>
                                  <td className="py-2 text-xs text-muted-foreground">{sale.city}</td>
                                  <td className="py-2"><Badge variant="outline" className="text-[9px] px-1.5 py-0">{sale.type}</Badge></td>
                                  <td className="py-2"><Badge variant="secondary" className="text-[9px] px-1.5 py-0">{sale.segment}</Badge></td>
                                  <td className="py-2 text-xs text-muted-foreground">{sale.broker}</td>
                                  <td className="py-2 text-xs">{sale.platform ? <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-accent/40 text-accent">{sale.platform}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                                  <td className="py-2 text-right text-xs font-bold text-accent">{formatCurrency(sale.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </>
        ) : (
          <ComparativoAnual sales={sales} allYears={allYears} allCities={allCities} allTypes={allTypes} defaultYearA={currentYear} defaultYearB={previousYear} />
        )}

        <Dialog open={!!selectedMonth} onOpenChange={() => setSelectedMonth(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader><DialogTitle>Vendas de {selectedMonth}</DialogTitle></DialogHeader>
            {(() => {
              const monthNum = selectedMonth ? MONTH_MAP[selectedMonth] : -1;
              const monthSales = filtered.filter(s => new Date(s.date).getMonth() === monthNum);
              const totalVgv = monthSales.reduce((sum, s) => sum + s.price, 0);
              return (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="p-3 rounded-lg bg-primary/10"><p className="text-xs text-muted-foreground">Total de Vendas</p><p className="text-lg font-bold text-foreground">{monthSales.length}</p></div>
                    <div className="p-3 rounded-lg bg-accent/10"><p className="text-xs text-muted-foreground">VGV do Mês</p><p className="text-lg font-bold text-accent">{formatCurrency(totalVgv)}</p></div>
                  </div>
                  {monthSales.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda neste mês</p> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Imóvel</TableHead><TableHead>Cidade</TableHead><TableHead>Tipo</TableHead><TableHead>Segmento</TableHead><TableHead>Corretor</TableHead><TableHead>Plataforma</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {monthSales.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-foreground">{s.propertyTitle}</TableCell>
                            <TableCell className="text-muted-foreground">{s.city}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{s.type}</Badge></TableCell>
                            <TableCell><Badge className="text-xs" style={{ background: SEGMENT_COLORS[s.segment] + "33", color: SEGMENT_COLORS[s.segment], border: "none" }}>{s.segment}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{s.broker}</TableCell>
                            <TableCell>{s.platform ? <Badge variant="outline" className="text-xs border-accent/40 text-accent">{s.platform}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                            <TableCell className="text-right font-bold text-foreground">{formatCurrency(s.price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function ComparativoAnual({
  sales, allYears, allCities, allTypes, defaultYearA, defaultYearB,
}: {
  sales: RealSaleRecord[];
  allYears: number[];
  allCities: string[];
  allTypes: string[];
  defaultYearA: number;
  defaultYearB: number;
}) {
  const [yearA, setYearA] = useState<number>(defaultYearA);
  const [yearB, setYearB] = useState<number>(defaultYearB);
  const [fType, setFType] = useState<string>("Todos");
  const [fCity, setFCity] = useState<string>("Todas");
  const [fEmpr, setFEmpr] = useState<string>("Todos");
  const [compareEmpr, setCompareEmpr] = useState<boolean>(false);
  const [fEmprB, setFEmprB] = useState<string>("Todos");

  const allEmpreendimentos = useMemo(
    () => [...new Set(sales.map(s => s.empreendimento).filter(Boolean))].sort(),
    [sales]
  );

  const baseFiltered = useMemo(() => sales.filter(s => {
    if (fType !== "Todos" && s.type !== fType) return false;
    if (fCity !== "Todas" && s.city !== fCity) return false;
    if (!compareEmpr && fEmpr !== "Todos" && s.empreendimento !== fEmpr) return false;
    return true;
  }), [sales, fType, fCity, fEmpr, compareEmpr]);

  const activeFilters = [
    fType !== "Todos",
    fCity !== "Todas",
    !compareEmpr && fEmpr !== "Todos",
    compareEmpr && (fEmpr !== "Todos" || fEmprB !== "Todos"),
  ].filter(Boolean).length;
  const clearFilters = () => {
    setFType("Todos"); setFCity("Todas"); setFEmpr("Todos"); setFEmprB("Todos"); setCompareEmpr(false);
  };

  const data = useMemo(() => {
    const matchA = (s: RealSaleRecord) => !compareEmpr || fEmpr === "Todos" || s.empreendimento === fEmpr;
    const matchB = (s: RealSaleRecord) => !compareEmpr || fEmprB === "Todos" || s.empreendimento === fEmprB;
    const yearASales = baseFiltered.filter(s => new Date(s.date).getFullYear() === yearA && matchA(s));
    const yearBSales = baseFiltered.filter(s => new Date(s.date).getFullYear() === yearB && matchB(s));
    const uniqueSegments = [...new Set(baseFiltered.map(s => s.segment).filter(Boolean))];
    const segmentComparison = uniqueSegments.map(seg => {
      const curVgv = yearASales.filter(s => s.segment === seg).reduce((sum, s) => sum + s.price, 0);
      const prevVgv = yearBSales.filter(s => s.segment === seg).reduce((sum, s) => sum + s.price, 0);
      const valorization = prevVgv > 0 ? ((curVgv - prevVgv) / prevVgv) * 100 : curVgv > 0 ? 100 : 0;
      return { segment: seg, curVgv, prevVgv, valorization };
    });
    const monthlyComparison = ALL_MONTHS.map((m, i) => ({
      month: m,
      [`VGV ${yearA}`]: yearASales.filter(s => new Date(s.date).getMonth() === i).reduce((sum, s) => sum + s.price, 0),
      [`VGV ${yearB}`]: yearBSales.filter(s => new Date(s.date).getMonth() === i).reduce((sum, s) => sum + s.price, 0),
    }));
    const curTotal = yearASales.reduce((sum, s) => sum + s.price, 0);
    const prevTotal = yearBSales.reduce((sum, s) => sum + s.price, 0);
    const totalValorization = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : 0;

    const yMin = Math.min(yearA, yearB), yMax = Math.max(yearA, yearB);
    const years: number[] = [];
    for (let y = yMin; y <= yMax; y++) years.push(y);
    const baseYearSales = baseFiltered.filter(s => new Date(s.date).getFullYear() === yMin);
    const baseAvg = baseYearSales.length > 0 ? baseYearSales.reduce((s, x) => s + x.price, 0) / baseYearSales.length : 0;
    const valorizationSeries = years.map(y => {
      const ys = baseFiltered.filter(s => new Date(s.date).getFullYear() === y && (matchA(s) || matchB(s)));
      const avg = ys.length > 0 ? ys.reduce((s, x) => s + x.price, 0) / ys.length : 0;
      const valorPct = baseAvg > 0 && avg > 0 ? ((avg - baseAvg) / baseAvg) * 100 : 0;
      return { year: String(y), ticketMedio: avg, valorPct, vendas: ys.length };
    });
    const firstAvg = valorizationSeries.find(p => p.ticketMedio > 0)?.ticketMedio || 0;
    const lastAvg = [...valorizationSeries].reverse().find(p => p.ticketMedio > 0)?.ticketMedio || 0;
    const periodValorization = firstAvg > 0 && lastAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    return {
      segmentComparison, monthlyComparison, curTotal, prevTotal, totalValorization,
      curCount: yearASales.length, prevCount: yearBSales.length,
      valorizationSeries, periodValorization, years,
    };
  }, [baseFiltered, yearA, yearB, compareEmpr, fEmpr, fEmprB]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>(allYears);
    set.add(yearA); set.add(yearB);
    return [...set].sort((a, b) => b - a);
  }, [allYears, yearA, yearB]);

  const selectCls = "h-9 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-5">
      <div className="elevated-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-accent" /> Filtros do Comparativo
          </h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compareEmpr}
                onChange={(e) => setCompareEmpr(e.target.checked)}
                className="accent-accent"
              />
              Comparar 2 empreendimentos
            </label>
            {(activeFilters > 0 || yearA !== defaultYearA || yearB !== defaultYearB || compareEmpr) && (
              <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ano A</label>
            <select value={yearA} onChange={e => setYearA(Number(e.target.value))} className={`${selectCls} w-full mt-1`}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ano B</label>
            <select value={yearB} onChange={e => setYearB(Number(e.target.value))} className={`${selectCls} w-full mt-1`}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</label>
            <select value={fType} onChange={e => setFType(e.target.value)} className={`${selectCls} w-full mt-1`}>
              <option value="Todos">Todos</option>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cidade</label>
            <select value={fCity} onChange={e => setFCity(e.target.value)} className={`${selectCls} w-full mt-1`}>
              <option value="Todas">Todas</option>
              {allCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {compareEmpr ? "Empreendimento A" : "Empreendimento"}
            </label>
            <select value={fEmpr} onChange={e => setFEmpr(e.target.value)} className={`${selectCls} w-full mt-1`}>
              <option value="Todos">Todos</option>
              {allEmpreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          {compareEmpr && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Empreendimento B</label>
              <select value={fEmprB} onChange={e => setFEmprB(e.target.value)} className={`${selectCls} w-full mt-1`}>
                <option value="Todos">Todos</option>
                {allEmpreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}
        </div>
        {(activeFilters > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {fType !== "Todos" && <Badge variant="outline" className="text-[10px]">Tipo: {fType}</Badge>}
            {fCity !== "Todas" && <Badge variant="outline" className="text-[10px]">Cidade: {fCity}</Badge>}
            {!compareEmpr && fEmpr !== "Todos" && <Badge variant="outline" className="text-[10px]">Empreendimento: {fEmpr}</Badge>}
            {compareEmpr && <Badge variant="outline" className="text-[10px]">A: {fEmpr} ({yearA}) vs B: {fEmprB} ({yearB})</Badge>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="elevated-card rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            VGV {yearA}{compareEmpr && fEmpr !== "Todos" ? ` • ${fEmpr}` : ""}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(data.curTotal)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{data.curCount} vendas</p>
        </div>
        <div className="elevated-card rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            VGV {yearB}{compareEmpr && fEmprB !== "Todos" ? ` • ${fEmprB}` : ""}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(data.prevTotal)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{data.prevCount} vendas</p>
        </div>
        <div className="elevated-card rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {compareEmpr ? "Valorização A vs B" : `Valorização (${yearA} vs ${yearB})`}
          </p>
          <p className={`text-2xl font-bold mt-1 flex items-center gap-2 ${data.totalValorization >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {data.totalValorization >= 0 ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
            {data.totalValorization > 0 ? "+" : ""}{data.totalValorization.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">VGV total</p>
        </div>
      </div>

      <div className="elevated-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Linha de Valorização — Ticket médio por ano
          </h3>
          <Badge variant="outline" className={`text-[10px] ${data.periodValorization >= 0 ? "border-emerald-500/40 text-emerald-500" : "border-destructive/40 text-destructive"}`}>
            {data.periodValorization >= 0 ? "+" : ""}{data.periodValorization.toFixed(1)}% no período
          </Badge>
        </div>
        {data.valorizationSeries.length === 0 || data.valorizationSeries.every(p => p.ticketMedio === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem dados para os filtros selecionados</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.valorizationSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v > 0 ? `${(v / 1000000).toFixed(1)}M` : "0"} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                formatter={(v: number, name: string) => {
                  if (name === "Ticket médio") return [formatCurrency(v), name];
                  return [v, name];
                }}
                labelFormatter={(label, payload: any) => {
                  const item = payload?.[0]?.payload;
                  return `${label} • ${item?.vendas || 0} venda(s) • ${item?.valorPct >= 0 ? "+" : ""}${item?.valorPct.toFixed(1)}%`;
                }}
              />
              <Line type="monotone" dataKey="ticketMedio" name="Ticket médio" stroke="hsl(142, 71%, 45%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(142, 71%, 45%)" }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Valorização calculada com base no preço médio das vendas filtradas em cada ano do intervalo selecionado.
        </p>
      </div>

      <div className="elevated-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" /> VGV Mensal — {yearA} vs {yearB}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthlyComparison} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v > 0 ? `${(v / 1000000).toFixed(1)}M` : "0"} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [formatCurrency(v)]} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey={`VGV ${yearA}`} fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={`VGV ${yearB}`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.segmentComparison.length > 0 && (
        <div className="elevated-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-accent" /> Comparativo Visual por Segmento
          </h3>
          <div className="space-y-4">
            {data.segmentComparison.map(seg => {
              const maxVgv = Math.max(...data.segmentComparison.flatMap(s => [s.curVgv, s.prevVgv]), 1);
              return (
                <div key={seg.segment} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{seg.segment}</span>
                    <span className={`text-[10px] font-bold ${seg.valorization >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {seg.valorization > 0 ? "+" : ""}{seg.valorization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-8">{yearA}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(seg.curVgv / maxVgv) * 100}%`, background: SEGMENT_COLORS[seg.segment] }} />
                      </div>
                      <span className="text-[9px] text-foreground font-medium w-20 text-right">{formatCurrency(seg.curVgv)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-8">{yearB}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 opacity-40" style={{ width: `${(seg.prevVgv / maxVgv) * 100}%`, background: SEGMENT_COLORS[seg.segment] }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground w-20 text-right">{formatCurrency(seg.prevVgv)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RankingBarCard({ title, data, colors }: { title: string; data: { name: string; count: number; vgv: number }[]; colors?: Record<string, string> }) {
  if (data.length === 0) return (
    <div className="elevated-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" /> Ranking — {title}</h3>
      <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período</p>
    </div>
  );
  return (
    <div className="elevated-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" /> Ranking — {title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [formatCurrency(v), "VGV"]} />
          <Bar dataKey="vgv" radius={[0, 4, 4, 0]} animationDuration={800}>
            {data.map((e, i) => <Cell key={i} fill={colors?.[e.name] || (i === 0 ? "hsl(142, 71%, 45%)" : i === 1 ? "hsl(142, 50%, 60%)" : "hsl(38, 92%, 50%)")} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1">
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold ${idx === 0 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{idx + 1}</span>
              <span className="text-card-foreground font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{item.count}×</span>
              <span className="font-bold text-accent text-[11px]">{formatCurrency(item.vgv)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingListCard({ title, icon: Icon, data, colors, sales, field }: { title: string; icon: React.ElementType; data: { name: string; count: number; vgv: number }[]; colors?: Record<string, string>; sales?: RealSaleRecord[]; field?: "edificio" | "condominio" | "empreendimento" }) {
  const [openName, setOpenName] = useState<string | null>(null);
  if (data.length === 0) return (
    <div className="elevated-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2"><Icon className="w-4 h-4 text-accent" /> {title}</h3>
      <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período</p>
    </div>
  );
  const matched = openName && sales && field ? sales.filter(s => (s[field] || "") === openName) : [];
  const totalVgv = matched.reduce((sum, s) => sum + s.price, 0);
  return (
    <div className="elevated-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2"><Icon className="w-4 h-4 text-accent" /> {title}</h3>
      <div className="space-y-1.5">
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold shrink-0 ${idx === 0 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{idx + 1}</span>
              {sales && field ? (
                <button
                  type="button"
                  onClick={() => setOpenName(item.name)}
                  className="text-xs font-medium text-card-foreground hover:text-accent hover:underline text-left truncate"
                  title={`Ver vendas de ${item.name}`}
                >
                  {item.name}
                </button>
              ) : (
                <span className="text-xs font-medium text-card-foreground truncate">{item.name}</span>
              )}
              {colors && <div className="w-1.5 h-1.5 rounded-full ml-1 shrink-0" style={{ background: colors[item.name] }} />}
            </div>
            <div className="text-right flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground">{item.count}×</span>
              <span className="text-xs font-bold text-accent">{formatCurrency(item.vgv)}</span>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!openName} onOpenChange={(o) => !o && setOpenName(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-accent" />
              Vendas de {openName}
            </DialogTitle>
            <div className="text-xs text-muted-foreground flex gap-4 mt-1">
              <span>{matched.length} venda{matched.length !== 1 ? "s" : ""}</span>
              <span>VGV total: <span className="font-bold text-accent">{formatCurrency(totalVgv)}</span></span>
            </div>
          </DialogHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.propertyTitle}</TableCell>
                    <TableCell>{s.city}{s.neighborhood ? ` - ${s.neighborhood}` : ""}</TableCell>
                    <TableCell>{s.broker}</TableCell>
                    <TableCell>{new Date(s.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-bold text-accent">{formatCurrency(s.price)}</TableCell>
                  </TableRow>
                ))}
                {matched.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma venda encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RankingProgressCard({ title, data }: { title: string; data: { name: string; count: number; vgv: number }[] }) {
  if (data.length === 0) return null;
  const maxVgv = data[0]?.vgv || 1;
  return (
    <div className="elevated-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" /> {title}</h3>
      <div className="space-y-2.5">
        {data.map((item, idx) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold ${idx === 0 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{idx + 1}</span>
                <span className="font-medium text-card-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{item.count}×</span>
                <span className="font-bold text-accent text-[11px]">{formatCurrency(item.vgv)}</span>
              </div>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-700" style={{ width: `${(item.vgv / maxVgv) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
