import { createFileRoute } from "@tanstack/react-router";
import {
  FolderKanban, Users, UserSquare2, Download, TrendingUp, TrendingDown, ArrowRight,
  Building, Briefcase, ImageIcon, FileUp, RefreshCw, Clock, FileText, BadgeCheck, Heart, Eye,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/use-roles";
import { primaryRole, ROLE_LABEL } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { BaixarTabelaButton } from "@/components/dashboard/BaixarTabelaButton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MV Broker" }] }),
  component: Dashboard,
});

type Kpi = { label: string; value: string; delta?: string; up?: boolean; icon: typeof FolderKanban };

const KPIS_ADMIN: Kpi[] = [
  { label: "Clientes", value: "1.926", delta: "+8,7%", up: true, icon: UserSquare2 },
  { label: "Imobiliárias", value: "84", delta: "+3,2%", up: true, icon: Building },
  { label: "Corretores", value: "612", delta: "+5,1%", up: true, icon: Briefcase },
  { label: "Usuários", value: "284", delta: "+3,1%", up: true, icon: Users },
  { label: "Exportações", value: "342", delta: "-2,3%", up: false, icon: Download },
  { label: "Assinaturas ativas", value: "78", delta: "+4,4%", up: true, icon: BadgeCheck },
];

const KPIS_SECRETARIA: Kpi[] = [
  { label: "Imóveis cadastrados", value: "1.482", delta: "+6,2%", up: true, icon: FolderKanban },
  { label: "Imóveis atualizados", value: "326", delta: "+12,1%", up: true, icon: RefreshCw },
  { label: "Arquivos enviados", value: "918", delta: "+4,8%", up: true, icon: FileUp },
  { label: "Fotos enviadas", value: "5.214", delta: "+9,3%", up: true, icon: ImageIcon },
];

const barData = [
  { mes: "Jan", registros: 420 }, { mes: "Fev", registros: 510 },
  { mes: "Mar", registros: 690 }, { mes: "Abr", registros: 740 },
  { mes: "Mai", registros: 820 }, { mes: "Jun", registros: 910 },
  { mes: "Jul", registros: 1020 },
];

const lineData = [
  { dia: "Sem 1", clientes: 120, leads: 80 },
  { dia: "Sem 2", clientes: 180, leads: 140 },
  { dia: "Sem 3", clientes: 240, leads: 200 },
  { dia: "Sem 4", clientes: 310, leads: 260 },
  { dia: "Sem 5", clientes: 390, leads: 320 },
  { dia: "Sem 6", clientes: 480, leads: 410 },
];

const pieData = [
  { name: "Residencial", value: 540 },
  { name: "Comercial", value: 320 },
  { name: "Terreno", value: 180 },
  { name: "Rural", value: 90 },
];
const pieColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function Dashboard() {
  const { roles } = useRoles();
  const role = primaryRole(roles.length ? roles : ["corretor_autonomo"]);
  const variant: "admin" | "secretaria" | "comercial" =
    role === "super_admin" ? "admin" : role === "secretaria" ? "secretaria" : "comercial";

  if (variant === "comercial") {
    return <ComercialDashboard roleLabel={ROLE_LABEL[role]} />;
  }

  const kpis = variant === "admin" ? KPIS_ADMIN : KPIS_SECRETARIA;
  const title = variant === "admin" ? "Dashboard Administrativo" : "Dashboard Operacional";
  const desc = variant === "admin"
    ? "Indicadores globais da plataforma e das contas."
    : "Acompanhe a produção operacional de cadastros e mídias.";

  return (
    <>
      <PageHeader
        title={title}
        description={desc}
        actions={
          <div className="flex items-center gap-2">
            <BaixarTabelaButton />
            <Badge variant="secondary" className="text-xs">Perfil: {ROLE_LABEL[role]}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {kpis.map((k, idx) => {
          const Icon = k.icon;
          const highlight = idx === kpis.length - 1; // last card = dark highlight
          return (
            <div
              key={k.label}
              className={
                highlight
                  ? "rounded-2xl p-6 bg-primary text-primary-foreground border border-white/10 shadow-[0_8px_24px_-8px_oklch(0_0_0/0.25)]"
                  : "rounded-2xl p-6 bg-card border border-border shadow-[0_1px_2px_0_oklch(0_0_0/0.04),0_4px_16px_-6px_oklch(0_0_0/0.06)] hover:border-accent/40 transition-colors"
              }
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={
                    highlight
                      ? "h-11 w-11 grid place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-accent)]"
                      : "h-11 w-11 grid place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-accent)]"
                  }
                >
                  <Icon className="h-5 w-5" />
                </div>
                {k.delta && (
                  <span
                    className={
                      k.up
                        ? "text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent/15 text-accent"
                        : "text-[11px] font-bold px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive"
                    }
                  >
                    {k.up ? <TrendingUp className="h-3 w-3 inline -mt-px mr-0.5" /> : <TrendingDown className="h-3 w-3 inline -mt-px mr-0.5" />}
                    {k.delta}
                  </span>
                )}
              </div>
              <p className={highlight ? "text-[11px] uppercase tracking-wider font-bold text-white/50" : "text-[11px] uppercase tracking-wider font-bold text-muted-foreground"}>
                {k.label}
              </p>
              <p className={highlight ? "text-3xl font-extrabold tracking-tight mt-1 text-white" : "text-3xl font-extrabold tracking-tight mt-1 text-foreground"}>
                {k.value}
              </p>
            </div>
          );
        })}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Registros por mês</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Volume de novos cadastros no período</p>
            </div>
            <Badge variant="secondary">2025</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="registros" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por tipo</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Imóveis cadastrados</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {pieData.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pieColors[i] }} />
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                  <span className="font-medium">{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Clientes vs. Leads</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Evolução semanal</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="dia" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="clientes" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="leads" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { who: "Maria Silva", what: "criou um novo registro", when: "há 5 min" },
              { who: "João Pereira", what: "exportou relatório", when: "há 22 min" },
              { who: "Ana Costa", what: "atualizou cliente", when: "há 1 h" },
              { who: "Carlos R.", what: "criou novo usuário", when: "há 3 h" },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {a.who.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="leading-snug"><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.what}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.when}</p>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full justify-between">
              Ver tudo <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

type Atividade = { id: string; acao: string; created_at: string; imovel_id: string | null };

function ComercialDashboard({ roleLabel }: { roleLabel: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    favoritos: 0,
    exportacoes: 0,
    downloads: 0,
    visualizacoes: 0,
    imoveisSistema: 0,
    novos7d: 0,
  });
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }

      const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
      const head = { count: "exact" as const, head: true };

      const [favC, expC, dlC, vwC, imSys, novos, ativ] = await Promise.all([
        supabase.from("imoveis_favoritos").select("*", head).eq("usuario_id", uid),
        supabase.from("exportacao_itens").select("*", head).eq("usuario_id", uid),
        supabase.from("imovel_logs").select("*", head).eq("user_id", uid).ilike("acao", "download%"),
        supabase.from("imovel_logs").select("*", head).eq("user_id", uid).ilike("acao", "visualiz%"),
        supabase.from("imoveis").select("*", head).eq("arquivado", false),
        supabase.from("imoveis").select("*", head).eq("arquivado", false).gte("created_at", since7d),
        supabase.from("imovel_logs").select("id, acao, created_at, imovel_id").eq("user_id", uid).order("created_at", { ascending: false }).limit(6),
      ]);

      setStats({
        favoritos: favC.count ?? 0,
        exportacoes: expC.count ?? 0,
        downloads: dlC.count ?? 0,
        visualizacoes: vwC.count ?? 0,
        imoveisSistema: imSys.count ?? 0,
        novos7d: novos.count ?? 0,
      });
      setAtividades((ativ.data ?? []) as Atividade[]);
      setLoading(false);
    })();
  }, []);

  const kpis: Kpi[] = [
    { label: "Meus favoritos", value: String(stats.favoritos), icon: Heart },
    { label: "Minhas exportações", value: String(stats.exportacoes), icon: Download },
    { label: "Meus downloads", value: String(stats.downloads), icon: FileText },
    { label: "Minhas visualizações", value: String(stats.visualizacoes), icon: Eye },
  ];

  const fmtRel = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "agora";
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h} h`;
    return `há ${Math.floor(h / 24)} d`;
  };

  return (
    <>
      <PageHeader
        title="Meu Dashboard"
        description="Resumo da sua atividade na plataforma."
        actions={
          <div className="flex items-center gap-2">
            <BaixarTabelaButton />
            <Badge variant="secondary" className="text-xs">Perfil: {roleLabel}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{k.label}</p>
                    <p className="text-3xl font-bold tracking-tight mt-2">{loading ? "—" : k.value}</p>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Apenas dados da sua conta</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Imóveis disponíveis no sistema</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Catálogo completo acessível para você</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Total no sistema</p>
                <p className="text-3xl font-bold mt-1">{loading ? "—" : stats.imoveisSistema.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Novos (últimos 7 dias)</p>
                <p className="text-3xl font-bold mt-1">{loading ? "—" : stats.novos7d.toLocaleString("pt-BR")}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to="/imoveis"><Button size="sm" variant="outline">Ver imóveis <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
              <Link to="/oportunidades"><Button size="sm" variant="outline">Oportunidades</Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Minha atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
            {!loading && atividades.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma atividade registrada ainda.</p>
            )}
            {atividades.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="leading-snug capitalize">{a.acao.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtRel(a.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
