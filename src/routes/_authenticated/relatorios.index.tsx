import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Share2, FolderKanban, Rss, Globe, Download, Eye, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { logRelatorioAccess } from "@/hooks/use-relatorios";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios/")({
  component: VisaoGeral,
});

const KPI_LIST = [
  { key: "imoveis_total", label: "Imóveis cadastrados", icon: Building2 },
  { key: "imoveis_disponiveis", label: "Disponíveis", icon: CheckCircle2 },
  { key: "imoveis_xml", label: "Exportados (XML)", icon: Share2 },
  { key: "carteiras", label: "Carteiras", icon: FolderKanban },
  { key: "feeds_ativos", label: "Feeds XML ativos", icon: Rss },
  { key: "portais", label: "Portais conectados", icon: Globe },
  { key: "downloads", label: "Downloads de arquivos", icon: Download },
  { key: "visualizacoes", label: "Visualizações", icon: Eye },
  { key: "usuarios", label: "Usuários ativos", icon: Users },
] as const;

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 210 80% 56%))", "hsl(var(--chart-3, 142 70% 45%))", "hsl(var(--chart-4, 35 90% 55%))", "hsl(var(--chart-5, 0 80% 60%))"];

function VisaoGeral() {
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [tipos, setTipos] = useState<{ name: string; value: number }[]>([]);
  const [status, setStatus] = useState<{ name: string; value: number }[]>([]);
  const [evolucao, setEvolucao] = useState<{ mes: string; imoveis: number; exportacoes: number }[]>([]);

  const { filters } = useRelFilters();

  useEffect(() => {
    logRelatorioAccess("visao_geral", filters as any);
    (async () => {
      const head = { count: "exact" as const, head: true };
      const [
        imv, disp, xml, cart, feeds, ports, downs, views, profs,
        imoveisData, feedLogsData,
      ] = await Promise.all([
        supabase.from("imoveis").select("*", head),
        supabase.from("imoveis").select("*", head).eq("status_imovel", "disponivel"),
        supabase.from("imoveis").select("*", head).eq("publicar_xml", true),
        supabase.from("carteiras").select("*", head),
        supabase.from("carteira_portais").select("*", head).eq("ativo", true),
        supabase.from("portais").select("*", head).eq("ativo", true),
        supabase.from("arquivo_logs").select("*", head).eq("acao", "download"),
        supabase.from("imovel_logs").select("*", head).eq("acao", "visualizacao"),
        supabase.from("profiles").select("*", head),
        supabase.from("imoveis").select("tipo_imovel, status_imovel, created_at").limit(2000),
        supabase.from("feed_logs").select("created_at").gte("created_at", new Date(Date.now() - 1000*60*60*24*180).toISOString()).limit(5000),
      ]);

      setKpis({
        imoveis_total: imv.count ?? 0,
        imoveis_disponiveis: disp.count ?? 0,
        imoveis_xml: xml.count ?? 0,
        carteiras: cart.count ?? 0,
        feeds_ativos: feeds.count ?? 0,
        portais: ports.count ?? 0,
        downloads: downs.count ?? 0,
        visualizacoes: views.count ?? 0,
        usuarios: profs.count ?? 0,
      });

      const rows = (imoveisData.data ?? []) as { tipo_imovel: string | null; status_imovel: string | null; created_at: string }[];
      const tipoMap = new Map<string, number>();
      const statusMap = new Map<string, number>();
      const evoMap = new Map<string, { imoveis: number; exportacoes: number }>();
      for (const r of rows) {
        const t = r.tipo_imovel || "—";
        tipoMap.set(t, (tipoMap.get(t) ?? 0) + 1);
        const s = r.status_imovel || "—";
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
        const m = r.created_at.slice(0, 7);
        const ex = evoMap.get(m) ?? { imoveis: 0, exportacoes: 0 };
        ex.imoveis += 1; evoMap.set(m, ex);
      }
      for (const r of (feedLogsData.data ?? []) as { created_at: string }[]) {
        const m = r.created_at.slice(0, 7);
        const ex = evoMap.get(m) ?? { imoveis: 0, exportacoes: 0 };
        ex.exportacoes += 1; evoMap.set(m, ex);
      }
      setTipos([...tipoMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value })));
      setStatus([...statusMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })));
      setEvolucao(
        [...evoMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
          .map(([mes, v]) => ({ mes, ...v }))
      );
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_LIST.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-bold leading-none">{(kpis[k.key] ?? 0).toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{k.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Evolução (últimos 6 meses)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="imoveis" name="Imóveis criados" stroke={CHART_COLORS[0]} strokeWidth={2} />
                <Line type="monotone" dataKey="exportacoes" name="Leituras de feed" stroke={CHART_COLORS[1]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Imóveis por tipo</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tipos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {tipos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Imóveis por status</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={status}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
