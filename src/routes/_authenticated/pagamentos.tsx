import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <PagamentosPage />
    </RoleGate>
  ),
});

type Row = {
  id: string; assinatura_id: string;
  valor: number; metodo: string; status: string;
  vencimento: string | null; pago_em: string | null; competencia: string | null;
  assinaturas?: {
    planos?: { nome: string } | null;
    imobiliarias?: { nome_fantasia: string } | null;
    usuario_id: string | null;
  } | null;
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_BADGE: Record<string, string> = {
  pago: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  pendente: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  atrasado: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  estornado: "bg-orange-500/15 text-orange-700 border-orange-500/30",
};

function PagamentosPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("todos");
  const [comp, setComp] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pagamentos")
      .select("id, assinatura_id, valor, metodo, status, vencimento, pago_em, competencia, assinaturas(usuario_id, planos(nome), imobiliarias(nome_fantasia))")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setItems(((data ?? []) as unknown as Row[]));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const resumo = useMemo(() => {
    let recebidoMes = 0, pendente = 0, atrasado = 0;
    for (const r of items) {
      const v = Number(r.valor) || 0;
      if (r.status === "pago" && r.competencia === mesAtual) recebidoMes += v;
      if (r.status === "pendente") pendente += v;
      if (r.status === "atrasado") atrasado += v;
    }
    return { recebidoMes, pendente, atrasado };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const filtered = useMemo(() => items.filter((r) => {
    if (status !== "todos" && r.status !== status) return false;
    if (comp && r.competencia !== comp) return false;
    return true;
  }), [items, status, comp]);

  const total = filtered.filter((r) => r.status === "pago").reduce((acc, r) => acc + Number(r.valor), 0);

  return (
    <>
      <PageHeader title="Pagamentos" description="Histórico consolidado de recebimentos das assinaturas." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Recebido no mês ({mesAtual})</div>
          <div className="text-2xl font-bold text-emerald-600">{fmtBRL(resumo.recebidoMes)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Pendente</div>
          <div className="text-2xl font-bold text-slate-700">{fmtBRL(resumo.pendente)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Em atraso</div>
          <div className="text-2xl font-bold text-rose-600">{fmtBRL(resumo.atrasado)}</div>
        </CardContent></Card>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="estornado">Estornado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Competência (AAAA-MM)</Label>
          <Input placeholder="2026-06" value={comp} onChange={(e) => setComp(e.target.value)} />
        </div>
        <Card className="flex items-center justify-center">
          <CardContent className="p-4 text-center">
            <div className="text-xs uppercase text-muted-foreground">Total recebido (filtro)</div>
            <div className="text-2xl font-bold text-primary">{fmtBRL(total)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Competência</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.competencia ?? "—"}</TableCell>
                  <TableCell>{r.assinaturas?.imobiliarias?.nome_fantasia ?? (r.assinaturas?.usuario_id ? "Corretor autônomo" : "—")}</TableCell>
                  <TableCell>{r.assinaturas?.planos?.nome ?? "—"}</TableCell>
                  <TableCell>{fmtBRL(Number(r.valor))}</TableCell>
                  <TableCell><Badge variant="secondary">{r.metodo}</Badge></TableCell>
                  <TableCell>{r.vencimento ? new Date(r.vencimento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>{r.pago_em ? new Date(r.pago_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_BADGE[r.status] ?? ""}>{r.status}</Badge></TableCell>
                  <TableCell>
                    <Link to="/assinaturas/$id" params={{ id: r.assinatura_id }}>
                      <Button variant="ghost" size="icon" title="Abrir assinatura"><ExternalLink className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
