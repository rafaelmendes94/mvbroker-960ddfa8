import { useMemo } from "react";
import { useAgenciamentos } from "@/hooks/useAgenciamentos";
import { MetricCard } from "@/components/MetricCard";
import { formatCurrency } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Building2, MapPin, TrendingUp, Users, CheckCircle, RefreshCw, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)",
  "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)", "hsl(24, 75%, 50%)", "hsl(280, 65%, 60%)",
];

function topByKey<T extends Record<string, any>>(arr: T[], key: keyof T, limit = 10) {
  const counts = new Map<string, { count: number; vgv: number }>();
  arr.forEach(item => {
    const k = String(item[key] || "—").trim() || "—";
    const cur = counts.get(k) || { count: 0, vgv: 0 };
    cur.count += 1;
    cur.vgv += Number(item.valor) || 0;
    counts.set(k, cur);
  });
  return [...counts.entries()]
    .map(([name, v]) => ({ name, count: v.count, vgv: v.vgv }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function AgenciamentosBI() {
  const { list, loading, stats } = useAgenciamentos();

  const byCity = useMemo(() => topByKey(list, "cidade", 8), [list]);
  const byBairro = useMemo(() => topByKey(list, "bairro", 10), [list]);
  const byPadrao = useMemo(() => topByKey(list, "padrao", 8), [list]);
  const byDormitorios = useMemo(() => topByKey(list, "dormitorios", 8), [list]);
  const byProprietario = useMemo(() => topByKey(list, "proprietario", 10), [list]);
  const byRua = useMemo(() => topByKey(list, "rua", 10), [list]);

  const statusBreakdown = useMemo(() => [
    { name: "Ativos", value: stats.ativos - stats.novos - stats.atualizados, color: "hsl(215, 20%, 65%)" },
    { name: "Novos da semana", value: stats.novos, color: "hsl(142, 71%, 45%)" },
    { name: "Atualizados da semana", value: stats.atualizados, color: "hsl(38, 92%, 50%)" },
    { name: "Vendidos", value: stats.vendidos, color: "hsl(0, 72%, 51%)" },
  ].filter(d => d.value > 0), [stats]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="elevated-card rounded-xl p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">Nenhum agenciamento cadastrado</h3>
        <p className="text-sm text-muted-foreground">Importe sua planilha pelo botão "Agenciamentos" no topo da página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Carteira Total" value={String(stats.total)} change={`${stats.ativos} ativos`} changeType="positive" icon={Building2} />
        <MetricCard title="VGV de Carteira" value={formatCurrency(stats.vgv)} change="—" changeType="neutral" icon={TrendingUp} />
        <MetricCard title="Ticket Médio" value={formatCurrency(stats.ticketMedio)} change="por imóvel" changeType="neutral" icon={Home} />
        <MetricCard title="Vendidos" value={String(stats.vendidos)} change={`${stats.novos} novos / ${stats.atualizados} atual.`} changeType="positive" icon={CheckCircle} />
      </div>

      {statusBreakdown.length > 0 && (
        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Status da Carteira
          </h3>
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.value}`}>
                  {statusBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {statusBreakdown.map(s => (
                <div key={s.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                    <span className="text-xs font-medium">{s.name}</span>
                  </div>
                  <span className="text-sm font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Carteira por Cidade
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCity} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v: any, n) => n === "vgv" ? formatCurrency(v as number) : v} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Imóveis" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Top 10 Bairros
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byBairro} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} name="Imóveis" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Por Padrão / Tipo
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byPadrao} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => `${e.name}: ${e.count}`}>
                {byPadrao.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Home className="w-4 h-4" /> Por Dormitórios
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDormitorios}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="Imóveis" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Top 10 Proprietários (mais ofertas)
          </h3>
          <div className="space-y-1.5">
            {byProprietario.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> :
              byProprietario.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="outline" className="text-[9px] w-6 justify-center shrink-0">{i + 1}</Badge>
                    <span className="text-xs font-medium truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{formatCurrency(p.vgv)}</span>
                    <Badge variant="secondary" className="text-[10px]">{p.count}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="elevated-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Top 10 Ruas (mais ofertas)
          </h3>
          <div className="space-y-1.5">
            {byRua.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> :
              byRua.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="outline" className="text-[9px] w-6 justify-center shrink-0">{i + 1}</Badge>
                    <span className="text-xs font-medium truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{formatCurrency(r.vgv)}</span>
                    <Badge variant="secondary" className="text-[10px]">{r.count}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
