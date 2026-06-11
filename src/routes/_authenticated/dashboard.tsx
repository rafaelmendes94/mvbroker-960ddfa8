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

const pieColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];


function Dashboard() {
  const { roles } = useRoles();
  const role = primaryRole(roles.length ? roles : ["corretor_autonomo"]);
  const variant: "admin" | "secretaria" | "comercial" =
    role === "super_admin" ? "admin" : role === "secretaria" ? "secretaria" : "comercial";

  if (variant === "comercial") {
    return <ComercialDashboard roleLabel={ROLE_LABEL[role]} />;
  }

  return <AdminOpsDashboard variant={variant} roleLabel={ROLE_LABEL[role]} />;
}

type AtividadeAdm = { id: string; usuario_id: string | null; modulo: string; acao: string; created_at: string; nome?: string | null };

function AdminOpsDashboard({ variant, roleLabel }: { variant: "admin" | "secretaria"; roleLabel: string }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [barData, setBarData] = useState<{ mes: string; registros: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [lineData, setLineData] = useState<{ dia: string; novos: number; atividade: number }[]>([]);
  const [atividades, setAtividades] = useState<AtividadeAdm[]>([]);

  useEffect(() => {
    (async () => {
      const head = { count: "exact" as const, head: true };
      const now = new Date();
      const since30d = new Date(now.getTime() - 30 * 86400000).toISOString();
      const sinceCurrPrev30d = new Date(now.getTime() - 60 * 86400000).toISOString();
      const since7m = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();

      // ---------- KPIs ----------
      if (variant === "admin") {
        const [imob, corr, users, exps, assAtv, exps30, exps60] = await Promise.all([
          supabase.from("imobiliarias").select("*", head),
          supabase.from("corretores").select("*", head).eq("status", "ativo"),
          supabase.from("profiles").select("*", head),
          supabase.from("exportacao_itens").select("*", head),
          supabase.from("assinaturas").select("*", head).eq("status", "ativa"),
          supabase.from("exportacao_itens").select("*", head).gte("created_at", since30d),
          supabase.from("exportacao_itens").select("*", head).gte("created_at", sinceCurrPrev30d).lt("created_at", since30d),
        ]);
        const delta = pctDelta(exps30.count ?? 0, exps60.count ?? 0);
        setKpis([
          { label: "Imobiliárias", value: fmt(imob.count), icon: Building },
          { label: "Corretores ativos", value: fmt(corr.count), icon: Briefcase },
          { label: "Usuários", value: fmt(users.count), icon: Users },
          { label: "Exportações", value: fmt(exps.count), delta: delta.label, up: delta.up, icon: Download },
          { label: "Assinaturas ativas", value: fmt(assAtv.count), icon: BadgeCheck },
          { label: "Novas (30 dias)", value: fmt(exps30.count), icon: TrendingUp },
        ]);
      } else {
        const [im, im30, im60, upd30, arq, fotos] = await Promise.all([
          supabase.from("imoveis").select("*", head).eq("arquivado", false),
          supabase.from("imoveis").select("*", head).eq("arquivado", false).gte("created_at", since30d),
          supabase.from("imoveis").select("*", head).eq("arquivado", false).gte("created_at", sinceCurrPrev30d).lt("created_at", since30d),
          supabase.from("imoveis").select("*", head).gte("updated_at", since30d),
          supabase.from("arquivos").select("*", head),
          supabase.from("imovel_imagens").select("*", head),
        ]);
        const delta = pctDelta(im30.count ?? 0, im60.count ?? 0);
        setKpis([
          { label: "Imóveis cadastrados", value: fmt(im.count), delta: delta.label, up: delta.up, icon: FolderKanban },
          { label: "Atualizados (30d)", value: fmt(upd30.count), icon: RefreshCw },
          { label: "Arquivos enviados", value: fmt(arq.count), icon: FileUp },
          { label: "Fotos enviadas", value: fmt(fotos.count), icon: ImageIcon },
        ]);
      }

      // ---------- Bar: imóveis criados por mês (últimos 7 meses) ----------
      const { data: imRows } = await supabase
        .from("imoveis")
        .select("created_at")
        .gte("created_at", since7m)
        .limit(10000);
      const monthsLabel = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets[`${d.getFullYear()}-${d.getMonth()}`] = 0;
      }
      (imRows ?? []).forEach((r: { created_at: string }) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key in buckets) buckets[key] += 1;
      });
      setBarData(
        Object.keys(buckets).map((k) => {
          const [, m] = k.split("-").map(Number);
          return { mes: monthsLabel[m], registros: buckets[k] };
        })
      );

      // ---------- Pie: distribuição por tipo_imovel ----------
      const { data: tipoRows } = await supabase
        .from("imoveis")
        .select("tipo_imovel")
        .eq("arquivado", false)
        .limit(10000);
      const tipoCount: Record<string, number> = {};
      (tipoRows ?? []).forEach((r: { tipo_imovel: string | null }) => {
        const k = r.tipo_imovel || "Outros";
        tipoCount[k] = (tipoCount[k] ?? 0) + 1;
      });
      setPieData(
        Object.entries(tipoCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({ name, value }))
      );

      // ---------- Line: novos imóveis vs atividade por semana (6 semanas) ----------
      const weeks: { start: Date; end: Date; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 7 * 86400000);
        const start = new Date(end.getTime() - 7 * 86400000);
        weeks.push({ start, end, label: `Sem ${6 - i}` });
      }
      const since6w = weeks[0].start.toISOString();
      const [novosRows, logsRows] = await Promise.all([
        supabase.from("imoveis").select("created_at").gte("created_at", since6w).limit(10000),
        supabase.from("imovel_logs").select("created_at").gte("created_at", since6w).limit(10000),
      ]);
      setLineData(
        weeks.map((w) => ({
          dia: w.label,
          novos: (novosRows.data ?? []).filter((r: { created_at: string }) => {
            const t = new Date(r.created_at).getTime();
            return t >= w.start.getTime() && t < w.end.getTime();
          }).length,
          atividade: (logsRows.data ?? []).filter((r: { created_at: string }) => {
            const t = new Date(r.created_at).getTime();
            return t >= w.start.getTime() && t < w.end.getTime();
          }).length,
        }))
      );

      // ---------- Atividade recente ----------
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("id, usuario_id, modulo, acao, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      const uids = Array.from(new Set((logs ?? []).map((l) => l.usuario_id).filter(Boolean))) as string[];
      const profMap: Record<string, string> = {};
      if (uids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uids);
        (profs ?? []).forEach((p: { id: string; full_name: string | null }) => {
          profMap[p.id] = p.full_name || "Usuário";
        });
      }
      setAtividades(
        (logs ?? []).map((l) => ({ ...l, nome: l.usuario_id ? profMap[l.usuario_id] ?? "Usuário" : "Sistema" })) as AtividadeAdm[]
      );

      setLoading(false);
    })();
  }, [variant]);

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
            <Badge variant="secondary" className="text-xs">Perfil: {roleLabel}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {(loading ? Array.from({ length: variant === "admin" ? 6 : 4 }).map((_, i) => ({ label: "—", value: "—", icon: FolderKanban, _k: i } as Kpi & { _k: number })) : kpis).map((k, idx) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label + idx}
              className="rounded-2xl p-6 bg-card border border-border shadow-[0_1px_2px_0_oklch(0_0_0/0.04),0_4px_16px_-6px_oklch(0_0_0/0.06)] hover:border-accent/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-11 w-11 grid place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-accent)]">
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
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                {k.label}
              </p>
              <p className="text-3xl font-extrabold tracking-tight mt-1 text-foreground">
                {loading ? "—" : k.value}
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
              <p className="text-xs text-muted-foreground mt-1">Imóveis cadastrados nos últimos 7 meses</p>
            </div>
            <Badge variant="secondary">{new Date().getFullYear()}</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <defs>
                    <linearGradient id="grad-bar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent-glow)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--color-accent-deep)" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="registros" fill="url(#grad-bar)" radius={[6, 6, 0, 0]} />
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
                    {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {pieData.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground text-center">Sem dados</p>
              )}
              {pieData.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pieColors[i % pieColors.length] }} />
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
            <CardTitle className="text-base">Novos cadastros vs. atividade</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Evolução semanal (6 semanas)</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData}>
                  <defs>
                    <linearGradient id="grad-area-1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-area-2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.40} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="dia" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="novos" name="Novos imóveis" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#grad-area-1)" />
                  <Area type="monotone" dataKey="atividade" name="Atividade" stroke="var(--color-chart-2)" strokeWidth={2.5} fill="url(#grad-area-2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
            {!loading && atividades.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
            )}
            {atividades.map((a) => {
              const who = a.nome || "Sistema";
              return (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {who.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">
                      <span className="font-medium">{who}</span>{" "}
                      <span className="text-muted-foreground">{describeAcao(a.acao, a.modulo)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtRelTime(a.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <Link to="/auditoria">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Ver tudo <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR");
}
function pctDelta(curr: number, prev: number): { label: string; up: boolean } {
  if (!prev) return { label: curr > 0 ? "+100%" : "0%", up: curr >= 0 };
  const d = ((curr - prev) / prev) * 100;
  const up = d >= 0;
  return { label: `${up ? "+" : ""}${d.toFixed(1).replace(".", ",")}%`, up };
}
function describeAcao(acao: string, modulo: string) {
  const map: Record<string, string> = {
    criacao: "criou", atualizacao: "atualizou", exclusao: "excluiu",
    login: "fez login", logout: "saiu do sistema",
  };
  const verb = map[acao] || acao;
  return `${verb} ${modulo ? `em ${modulo}` : ""}`.trim();
}
function fmtRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
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
