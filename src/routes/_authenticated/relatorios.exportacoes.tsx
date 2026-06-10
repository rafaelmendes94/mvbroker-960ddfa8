import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { logRelatorioAccess } from "@/hooks/use-relatorios";
import { useRelFilters } from "@/hooks/use-rel-filters";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Legend,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/relatorios/exportacoes")({
  component: RelExportacoes,
});

type Carteira = { id: string; nome: string; status: string; ultima_atualizacao: string | null; created_at: string };
type CarteiraItem = { carteira_id: string; imovel_id: string };
type CartPortal = { id: string; carteira_id: string; portal_id: string; ativo: boolean; ultima_leitura: string | null; total_leituras: number | null; status_sincronizacao: string | null };
type Portal = { id: string; nome: string; slug: string; cor: string | null };
type FeedLog = { created_at: string; ip: string | null; user_agent: string | null };

function RelExportacoes() {
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [items, setItems] = useState<CarteiraItem[]>([]);
  const [cartPortais, setCartPortais] = useState<CartPortal[]>([]);
  const [portais, setPortais] = useState<Portal[]>([]);
  const [logs, setLogs] = useState<FeedLog[]>([]);

  const { filters } = useRelFilters();

  useEffect(() => {
    logRelatorioAccess("exportacoes", filters as any);
    (async () => {
      const since = filters.periodoDias ? new Date(Date.now() - filters.periodoDias * 86400000).toISOString() : null;
      let cpQ: any = supabase.from("carteira_portais").select("id, carteira_id, portal_id, ativo, ultima_leitura, total_leituras, status_sincronizacao");
      if (filters.portalId) cpQ = cpQ.eq("portal_id", filters.portalId);
      let flQ: any = supabase.from("feed_logs").select("created_at, ip, user_agent").order("created_at", { ascending: false }).limit(2000);
      if (since) flQ = flQ.gte("created_at", since);
      const [c, ci, cp, p, fl] = await Promise.all([
        supabase.from("carteiras").select("id, nome, status, ultima_atualizacao, created_at"),
        supabase.from("carteira_imoveis").select("carteira_id, imovel_id"),
        cpQ,
        supabase.from("portais").select("id, nome, slug, cor"),
        flQ,
      ]);
      setCarteiras((c.data ?? []) as Carteira[]);
      setItems((ci.data ?? []) as CarteiraItem[]);
      setCartPortais((cp.data ?? []) as CartPortal[]);
      setPortais((p.data ?? []) as Portal[]);
      setLogs((fl.data ?? []) as FeedLog[]);
    })();
  }, [filters]);

  const itemsByCart = new Map<string, number>();
  for (const i of items) itemsByCart.set(i.carteira_id, (itemsByCart.get(i.carteira_id) ?? 0) + 1);

  const topCarteiras = [...carteiras]
    .map((c) => ({ nome: c.nome, value: itemsByCart.get(c.id) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const portalMap = new Map(portais.map((p) => [p.id, p]));
  const porPortal = new Map<string, { nome: string; cor: string; leituras: number; carteiras: number; erros: number }>();
  for (const cp of cartPortais) {
    const p = portalMap.get(cp.portal_id);
    if (!p) continue;
    const cur = porPortal.get(p.id) ?? { nome: p.nome, cor: p.cor ?? "hsl(var(--primary))", leituras: 0, carteiras: 0, erros: 0 };
    cur.leituras += cp.total_leituras ?? 0;
    cur.carteiras += 1;
    if (cp.status_sincronizacao === "erro") cur.erros += 1;
    porPortal.set(p.id, cur);
  }
  const portalRows = [...porPortal.values()];

  // Atividade 30 dias
  const days = new Map<string, number>();
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.set(d, 0);
  }
  for (const l of logs) {
    if (new Date(l.created_at).getTime() < cutoff) continue;
    const d = l.created_at.slice(0, 10);
    if (days.has(d)) days.set(d, (days.get(d) ?? 0) + 1);
  }
  const atividade = [...days.entries()].map(([dia, leituras]) => ({ dia: dia.slice(5), leituras }));

  const xmlAtivos = cartPortais.filter((c) => c.ativo).length;
  const xmlInativos = cartPortais.length - xmlAtivos;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Carteiras" value={carteiras.length} />
        <Kpi label="Itens em carteiras" value={items.length} />
        <Kpi label="XML ativos" value={xmlAtivos} />
        <Kpi label="XML inativos" value={xmlInativos} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Leituras de feed (30 dias)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={atividade}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="leituras" stroke="hsl(var(--primary))" fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Top carteiras por imóveis</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCarteiras} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="nome" type="category" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Leituras por portal</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portalRows.map((r) => ({ name: r.nome, leituras: r.leituras }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leituras" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Conexões de portal — sincronização</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portal</TableHead>
                <TableHead>Carteiras ativas</TableHead>
                <TableHead>Leituras</TableHead>
                <TableHead>Erros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portalRows.map((p) => (
                <TableRow key={p.nome}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.carteiras}</TableCell>
                  <TableCell>{p.leituras.toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{p.erros > 0 ? <Badge variant="destructive">{p.erros}</Badge> : <Badge variant="secondary">0</Badge>}</TableCell>
                </TableRow>
              ))}
              {portalRows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum portal conectado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Carteiras — última atualização</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Imóveis</TableHead>
                <TableHead>Atualizada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carteiras.slice(0, 15).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell><Badge variant={c.status === "ativa" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell>{itemsByCart.get(c.id) ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.ultima_atualizacao
                      ? formatDistanceToNow(new Date(c.ultima_atualizacao), { addSuffix: true, locale: ptBR })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
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
