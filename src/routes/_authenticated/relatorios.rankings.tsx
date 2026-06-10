import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Eye, Download, Share2, Heart, Award, LogIn, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorios/rankings")({
  head: () => ({ meta: [{ title: "Rankings — MV Broker" }] }),
  component: RankingsPage,
});

type Periodo = "7d" | "30d" | "total";
type MetricaImovel = "visualizacoes" | "downloads" | "exportacoes" | "favoritos" | "score";
type MetricaCorretor = "score" | "logins" | "visualizacoes" | "downloads" | "exportacoes" | "favoritos";

interface RankImovel {
  imovel_id: string;
  codigo_interno: string | null;
  titulo: string | null;
  cidade: string | null;
  bairro: string | null;
  preco: number | null;
  cover_url: string | null;
  visualizacoes: number;
  downloads: number;
  exportacoes: number;
  favoritos: number;
  score: number;
}

interface RankCorretor {
  corretor_user_id: string;
  nome: string | null;
  foto_url: string | null;
  imobiliaria_nome: string | null;
  logins: number;
  visualizacoes: number;
  downloads: number;
  exportacoes: number;
  favoritos: number;
  score: number;
  classificacao: string;
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "total", label: "Total" },
];

const METRICAS_IMOVEL: { value: MetricaImovel; label: string; icon: any }[] = [
  { value: "visualizacoes", label: "Mais visualizados", icon: Eye },
  { value: "exportacoes", label: "Mais exportados", icon: Share2 },
  { value: "downloads", label: "Mais baixados", icon: Download },
  { value: "favoritos", label: "Mais favoritados", icon: Heart },
  { value: "score", label: "Score geral", icon: Trophy },
];

const METRICAS_CORRETOR: { value: MetricaCorretor; label: string; icon: any }[] = [
  { value: "score", label: "Score geral", icon: Trophy },
  { value: "logins", label: "Mais ativos", icon: LogIn },
  { value: "exportacoes", label: "Exportações", icon: Share2 },
  { value: "downloads", label: "Downloads", icon: Download },
  { value: "visualizacoes", label: "Visualizações", icon: Eye },
  { value: "favoritos", label: "Favoritos", icon: Heart },
];

function classificacaoCor(c: string) {
  switch (c) {
    case "Ouro": return "bg-amber-100 text-amber-800 border-amber-300";
    case "Prata": return "bg-slate-200 text-slate-800 border-slate-300";
    case "Bronze": return "bg-orange-100 text-orange-800 border-orange-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function medalha(pos: number) {
  if (pos === 0) return "🥇";
  if (pos === 1) return "🥈";
  if (pos === 2) return "🥉";
  return `${pos + 1}º`;
}

function RankingsPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [metricaImovel, setMetricaImovel] = useState<MetricaImovel>("visualizacoes");
  const [metricaCorretor, setMetricaCorretor] = useState<MetricaCorretor>("score");
  const [imoveis, setImoveis] = useState<RankImovel[]>([]);
  const [corretores, setCorretores] = useState<RankCorretor[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"imoveis" | "corretores">("imoveis");

  useEffect(() => {
    if (tab !== "imoveis") return;
    setLoading(true);
    (supabase.rpc as any)("get_ranking_imoveis", {
      p_periodo: periodo, p_metrica: metricaImovel, p_limit: 20,
    }).then(({ data, error }: any) => {
      if (!error && data) setImoveis(data as RankImovel[]);
      setLoading(false);
    });
  }, [periodo, metricaImovel, tab]);

  useEffect(() => {
    if (tab !== "corretores") return;
    setLoading(true);
    (supabase.rpc as any)("get_ranking_corretores", {
      p_periodo: periodo, p_metrica: metricaCorretor, p_limit: 20,
    }).then(({ data, error }: any) => {
      if (!error && data) setCorretores(data as RankCorretor[]);
      setLoading(false);
    });
  }, [periodo, metricaCorretor, tab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rankings & Score</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores de desempenho da base imobiliária e da equipe.
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          {PERIODOS.map((p) => (
            <Button
              key={p.value}
              variant={periodo === p.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriodo(p.value)}
              className="h-8"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="imoveis">
            <Building2 className="h-4 w-4 mr-2" /> Ranking de Imóveis
          </TabsTrigger>
          <TabsTrigger value="corretores">
            <Award className="h-4 w-4 mr-2" /> Ranking de Corretores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imoveis" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {METRICAS_IMOVEL.map((m) => {
              const Icon = m.icon;
              const active = metricaImovel === m.value;
              return (
                <Button
                  key={m.value}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMetricaImovel(m.value)}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {m.label}
                </Button>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {METRICAS_IMOVEL.find((m) => m.value === metricaImovel)?.label} —{" "}
                {PERIODOS.find((p) => p.value === periodo)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
              ) : imoveis.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Sem dados no período.</div>
              ) : (
                <div className="divide-y">
                  {imoveis.map((i, idx) => (
                    <Link
                      key={i.imovel_id}
                      to="/imoveis/$id"
                      params={{ id: i.imovel_id }}
                      className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className={cn(
                        "w-10 text-center font-bold text-lg shrink-0",
                        idx < 3 ? "text-2xl" : "text-muted-foreground text-sm"
                      )}>
                        {medalha(idx)}
                      </div>
                      <div className="w-16 h-12 rounded bg-muted overflow-hidden shrink-0">
                        {i.cover_url && (
                          <img src={i.cover_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {i.codigo_interno || "—"} · {i.titulo || "Sem título"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[i.bairro, i.cidade].filter(Boolean).join(" · ") || "—"}
                          {i.preco ? ` · R$ ${Number(i.preco).toLocaleString("pt-BR")}` : ""}
                        </div>
                      </div>
                      <div className="hidden md:flex gap-4 text-xs text-muted-foreground">
                        <span title="Visualizações"><Eye className="inline h-3 w-3 mr-1" />{i.visualizacoes}</span>
                        <span title="Downloads"><Download className="inline h-3 w-3 mr-1" />{i.downloads}</span>
                        <span title="Exportações"><Share2 className="inline h-3 w-3 mr-1" />{i.exportacoes}</span>
                        <span title="Favoritos"><Heart className="inline h-3 w-3 mr-1" />{i.favoritos}</span>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {metricaImovel === "score" ? i.score :
                         metricaImovel === "downloads" ? i.downloads :
                         metricaImovel === "exportacoes" ? i.exportacoes :
                         metricaImovel === "favoritos" ? i.favoritos :
                         i.visualizacoes}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corretores" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {METRICAS_CORRETOR.map((m) => {
              const Icon = m.icon;
              const active = metricaCorretor === m.value;
              return (
                <Button
                  key={m.value}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMetricaCorretor(m.value)}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {m.label}
                </Button>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {METRICAS_CORRETOR.find((m) => m.value === metricaCorretor)?.label} —{" "}
                {PERIODOS.find((p) => p.value === periodo)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
              ) : corretores.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Sem atividade no período.</div>
              ) : (
                <div className="divide-y">
                  {corretores.map((c, idx) => (
                    <div key={c.corretor_user_id} className="flex items-center gap-3 p-3">
                      <div className={cn(
                        "w-10 text-center font-bold shrink-0",
                        idx < 3 ? "text-2xl" : "text-muted-foreground text-sm"
                      )}>
                        {medalha(idx)}
                      </div>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={c.foto_url || undefined} />
                        <AvatarFallback>
                          {(c.nome || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.nome || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.imobiliaria_nome || "Autônomo"}
                        </div>
                      </div>
                      <div className="hidden md:flex gap-4 text-xs text-muted-foreground">
                        <span title="Logins"><LogIn className="inline h-3 w-3 mr-1" />{c.logins}</span>
                        <span title="Visualizações"><Eye className="inline h-3 w-3 mr-1" />{c.visualizacoes}</span>
                        <span title="Downloads"><Download className="inline h-3 w-3 mr-1" />{c.downloads}</span>
                        <span title="Exportações"><Share2 className="inline h-3 w-3 mr-1" />{c.exportacoes}</span>
                        <span title="Favoritos"><Heart className="inline h-3 w-3 mr-1" />{c.favoritos}</span>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0", classificacaoCor(c.classificacao))}>
                        {c.classificacao}
                      </Badge>
                      <Badge variant="secondary" className="shrink-0 min-w-[3rem] justify-center">
                        {metricaCorretor === "score" ? c.score :
                         metricaCorretor === "logins" ? c.logins :
                         metricaCorretor === "visualizacoes" ? c.visualizacoes :
                         metricaCorretor === "downloads" ? c.downloads :
                         metricaCorretor === "exportacoes" ? c.exportacoes :
                         c.favoritos}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
