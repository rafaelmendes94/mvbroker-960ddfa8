import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  id: string; valor: number; metodo: string; status: string;
  vencimento: string | null; pago_em: string | null; competencia: string | null;
  assinaturas?: {
    planos?: { nome: string } | null;
    imobiliarias?: { nome_fantasia: string } | null;
    usuario_id: string | null;
  } | null;
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PagamentosPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("todos");
  const [comp, setComp] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*, assinaturas(usuario_id, planos(nome), imobiliarias(nome_fantasia))")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setItems(((data ?? []) as unknown as Row[]));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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
                <TableHead>Pago em</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>{r.pago_em ? new Date(r.pago_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
