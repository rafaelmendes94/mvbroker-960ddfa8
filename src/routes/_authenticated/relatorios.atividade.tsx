import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { logRelatorioAccess } from "@/hooks/use-relatorios";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/relatorios/atividade")({
  component: RelAtividade,
});

type ImLog = { acao: string; created_at: string; imovel_id: string; user_id: string | null };
type ArqLog = { acao: string; created_at: string; arquivo_id: string; usuario_id: string | null };
type Audit = { evento: string; descricao: string | null; created_at: string; user_id: string | null; ip: string | null };
type Arquivo = { id: string; nome: string; categoria: string | null };

function RelAtividade() {
  const [imLogs, setImLogs] = useState<ImLog[]>([]);
  const [arqLogs, setArqLogs] = useState<ArqLog[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);

  useEffect(() => {
    logRelatorioAccess("atividade");
    (async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const [il, al, au, ar] = await Promise.all([
        supabase.from("imovel_logs").select("acao, created_at, imovel_id, user_id").gte("created_at", since).limit(5000),
        supabase.from("arquivo_logs").select("acao, created_at, arquivo_id, usuario_id").gte("created_at", since).limit(5000),
        supabase.from("auditoria_acessos").select("evento, descricao, created_at, user_id, ip").order("created_at", { ascending: false }).limit(100),
        supabase.from("arquivos").select("id, nome, categoria"),
      ]);
      setImLogs((il.data ?? []) as ImLog[]);
      setArqLogs((al.data ?? []) as ArqLog[]);
      setAudit((au.data ?? []) as Audit[]);
      setArquivos((ar.data ?? []) as Arquivo[]);
    })();
  }, []);

  // KPIs
  const logins = audit.filter((a) => a.evento === "login").length;
  const visualizacoes = imLogs.filter((l) => l.acao === "visualizacao").length;
  const downloads = arqLogs.filter((l) => l.acao === "download").length;
  const atualizacoes = imLogs.filter((l) => l.acao === "atualizacao").length;

  // Atividade por dia (30d)
  const days = new Map<string, { dia: string; vis: number; down: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.set(d, { dia: d.slice(5), vis: 0, down: 0 });
  }
  for (const l of imLogs) {
    const d = l.created_at.slice(0, 10);
    const row = days.get(d); if (!row) continue;
    if (l.acao === "visualizacao") row.vis += 1;
  }
  for (const l of arqLogs) {
    const d = l.created_at.slice(0, 10);
    const row = days.get(d); if (!row) continue;
    if (l.acao === "download") row.down += 1;
  }
  const ativDiaria = [...days.values()];

  // Top arquivos baixados
  const arqMap = new Map(arquivos.map((a) => [a.id, a]));
  const downByArq = new Map<string, number>();
  for (const l of arqLogs.filter((x) => x.acao === "download")) {
    downByArq.set(l.arquivo_id, (downByArq.get(l.arquivo_id) ?? 0) + 1);
  }
  const topArquivos = [...downByArq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, total]) => ({ nome: arqMap.get(id)?.nome ?? id.slice(0, 8), categoria: arqMap.get(id)?.categoria ?? "—", total }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Logins (30d)" value={logins} />
        <Kpi label="Visualizações" value={visualizacoes} />
        <Kpi label="Downloads" value={downloads} />
        <Kpi label="Atualizações" value={atualizacoes} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Atividade diária (30 dias)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ativDiaria}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="vis" name="Visualizações" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="down" name="Downloads" stackId="a" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Arquivos mais baixados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Arquivo</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Downloads</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topArquivos.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium truncate max-w-[220px]">{a.nome}</TableCell>
                    <TableCell><Badge variant="secondary">{a.categoria}</Badge></TableCell>
                    <TableCell className="text-right">{a.total}</TableCell>
                  </TableRow>
                ))}
                {topArquivos.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem downloads no período.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Auditoria — últimos acessos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Evento</TableHead><TableHead>Detalhe</TableHead><TableHead>Quando</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {audit.slice(0, 15).map((a, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline">{a.evento}</Badge></TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[200px]">{a.descricao ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
                {audit.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem registros.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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
