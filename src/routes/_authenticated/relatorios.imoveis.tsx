import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { logRelatorioAccess } from "@/hooks/use-relatorios";
import { useRelFilters } from "@/hooks/use-rel-filters";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios/imoveis")({
  component: RelImoveis,
});

const CHART_COLORS = ["hsl(var(--primary))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type Row = {
  id: string;
  tipo_imovel: string | null;
  status_imovel: string | null;
  cidade: string | null;
  bairro: string | null;
  preco: number | null;
  publicar_xml: boolean | null;
  descricao: string | null;
  updated_at: string;
};

function faixaPreco(p: number | null): string {
  if (!p) return "Sem preço";
  if (p < 200000) return "< 200k";
  if (p < 500000) return "200k–500k";
  if (p < 1000000) return "500k–1M";
  if (p < 2000000) return "1M–2M";
  return "> 2M";
}

function group<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}

function RelImoveis() {
  const { filters } = useRelFilters();
  const [rows, setRows] = useState<Row[]>([]);
  const [fotosByImovel, setFotosByImovel] = useState<Set<string>>(new Set());

  useEffect(() => {
    logRelatorioAccess("imoveis", filters as any);
    (async () => {
      let q: any = supabase
        .from("imoveis")
        .select("id, tipo_imovel, status_imovel, cidade, bairro, preco, publicar_xml, descricao, updated_at")
        .limit(5000);
      if (filters.cidade) q = q.eq("cidade", filters.cidade);
      if (filters.tipo) q = q.eq("tipo_imovel", filters.tipo);
      if (filters.status) q = q.eq("status_imovel", filters.status);
      const since = filters.periodoDias ? new Date(Date.now() - filters.periodoDias * 86400000).toISOString() : null;
      if (since) q = q.gte("updated_at", since);
      const { data } = await q;
      setRows((data ?? []) as Row[]);

      const { data: imgs } = await supabase.from("imovel_imagens").select("imovel_id").limit(20000);
      setFotosByImovel(new Set((imgs ?? []).map((r: { imovel_id: string }) => r.imovel_id)));
    })();
  }, [filters]);



  const porStatus = useMemo(() => group(rows, (r) => r.status_imovel ?? ""), [rows]);
  const porTipo = useMemo(() => group(rows, (r) => r.tipo_imovel ?? ""), [rows]);
  const porCidade = useMemo(() => group(rows, (r) => r.cidade ?? "").slice(0, 10), [rows]);
  const porBairro = useMemo(() => group(rows, (r) => r.bairro ?? "").slice(0, 10), [rows]);
  const porFaixa = useMemo(() => group(rows, (r) => faixaPreco(r.preco)), [rows]);

  const semFoto = useMemo(() => rows.filter((r) => !fotosByImovel.has(r.id)).length, [rows, fotosByImovel]);
  const semDesc = useMemo(() => rows.filter((r) => !r.descricao || r.descricao.trim().length < 20).length, [rows]);
  const xmlAtivo = useMemo(() => rows.filter((r) => r.publicar_xml).length, [rows]);
  const incompletos = useMemo(
    () => rows.filter((r) => !r.preco || !r.tipo_imovel || !r.cidade || !fotosByImovel.has(r.id)).length,
    [rows, fotosByImovel]
  );
  const recentes = useMemo(() => {
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    return rows.filter((r) => new Date(r.updated_at).getTime() >= cutoff).length;
  }, [rows]);

  const flags = [
    { label: "Com XML ativo", value: xmlAtivo, tone: "default" as const },
    { label: "Sem foto", value: semFoto, tone: "destructive" as const },
    { label: "Sem descrição", value: semDesc, tone: "destructive" as const },
    { label: "Incompletos", value: incompletos, tone: "secondary" as const },
    { label: "Atualizados (30d)", value: recentes, tone: "default" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {flags.map((f) => (
          <Card key={f.label}>
            <CardContent className="p-4">
              <Badge variant={f.tone}>{f.label}</Badge>
              <div className="text-2xl font-bold mt-2">{f.value.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Por status" data={porStatus} kind="bar" />
        <ChartCard title="Por tipo" data={porTipo} kind="pie" />
        <ChartCard title="Top 10 cidades" data={porCidade} kind="bar" />
        <ChartCard title="Top 10 bairros" data={porBairro} kind="bar" />
        <ChartCard title="Faixa de preço" data={porFaixa} kind="bar" />
      </div>
    </div>
  );
}

function ChartCard({ title, data, kind }: { title: string; data: { name: string; value: number }[]; kind: "bar" | "pie" }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={11} angle={-15} textAnchor="end" height={50} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
