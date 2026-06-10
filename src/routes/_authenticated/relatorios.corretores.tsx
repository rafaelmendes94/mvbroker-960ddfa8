import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { logRelatorioAccess } from "@/hooks/use-relatorios";
import { useRelFilters } from "@/hooks/use-rel-filters";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios/corretores")({
  component: RelCorretores,
});

type Corretor = { id: string; user_id: string | null; imobiliaria_id: string | null; nome: string; status: string };
type Imovel = { id: string; corretor_id: string | null; publicar_xml: boolean | null };
type CartUser = { usuario_id: string; id: string };

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function RelCorretores() {
  const { filters } = useRelFilters();
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [carteiras, setCarteiras] = useState<CartUser[]>([]);

  useEffect(() => {
    logRelatorioAccess("corretores", filters as any);
    (async () => {
      let imvQ: any = supabase.from("imoveis").select("id, corretor_id, publicar_xml").limit(10000);
      if (filters.cidade) imvQ = imvQ.eq("cidade", filters.cidade);
      if (filters.tipo) imvQ = imvQ.eq("tipo_imovel", filters.tipo);
      if (filters.status) imvQ = imvQ.eq("status_imovel", filters.status);
      const [cr, im, ca] = await Promise.all([
        supabase.from("corretores").select("id, user_id, imobiliaria_id, nome, status"),
        imvQ,
        supabase.from("carteiras").select("id, usuario_id"),
      ]);
      setCorretores((cr.data ?? []) as Corretor[]);
      setImoveis((im.data ?? []) as Imovel[]);
      setCarteiras((ca.data ?? []) as CartUser[]);
    })();
  }, [filters]);

  const ativos = corretores.filter((c) => c.status === "ativo").length;
  const inativos = corretores.filter((c) => c.status !== "ativo").length;
  const vinculados = corretores.filter((c) => c.imobiliaria_id).length;
  const autonomos = corretores.length - vinculados;

  const imoveisByCorretor = useMemo(() => {
    const m = new Map<string, { total: number; xml: number }>();
    for (const i of imoveis) {
      if (!i.corretor_id) continue;
      const cur = m.get(i.corretor_id) ?? { total: 0, xml: 0 };
      cur.total += 1;
      if (i.publicar_xml) cur.xml += 1;
      m.set(i.corretor_id, cur);
    }
    return m;
  }, [imoveis]);

  const cartByUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of carteiras) m.set(c.usuario_id, (m.get(c.usuario_id) ?? 0) + 1);
    return m;
  }, [carteiras]);

  const ranking = useMemo(() => {
    return corretores
      .map((c) => {
        const im = imoveisByCorretor.get(c.id) ?? { total: 0, xml: 0 };
        const cart = c.user_id ? cartByUser.get(c.user_id) ?? 0 : 0;
        return { ...c, imoveis: im.total, xml: im.xml, carteiras: cart };
      })
      .sort((a, b) => b.imoveis - a.imoveis);
  }, [corretores, imoveisByCorretor, cartByUser]);

  const distribuicao = [
    { name: "Vinculados", value: vinculados },
    { name: "Autônomos", value: autonomos },
  ];

  const top10 = ranking.slice(0, 10).map((r) => ({ nome: r.nome, imoveis: r.imoveis }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Total" value={corretores.length} />
        <Kpi label="Ativos" value={ativos} />
        <Kpi label="Inativos" value={inativos} />
        <Kpi label="Autônomos" value={autonomos} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Top 10 — imóveis cadastrados</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="nome" type="category" width={140} fontSize={11} />
                <Tooltip />
                <Bar dataKey="imoveis" fill={COLORS[0]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribuicao} dataKey="value" nameKey="name" outerRadius={80} label>
                  {distribuicao.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ranking de corretores</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead className="text-right">Imóveis</TableHead>
                <TableHead className="text-right">XML</TableHead>
                <TableHead className="text-right">Carteiras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.slice(0, 30).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell><Badge variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{r.imobiliaria_id ? "Imobiliária" : "Autônomo"}</Badge></TableCell>
                  <TableCell className="text-right">{r.imoveis}</TableCell>
                  <TableCell className="text-right">{r.xml}</TableCell>
                  <TableCell className="text-right">{r.carteiras}</TableCell>
                </TableRow>
              ))}
              {ranking.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem corretores.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}
