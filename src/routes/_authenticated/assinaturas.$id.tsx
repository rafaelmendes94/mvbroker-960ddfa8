import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, ArrowLeft, Trash2, AlertTriangle, Lock, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/assinaturas/$id")({
  head: () => ({ meta: [{ title: "Detalhe da assinatura — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <AssinaturaDetalhe />
    </RoleGate>
  ),
});

type Assinatura = {
  id: string; valor: number; ciclo: string; status: string;
  proximo_vencimento: string | null; ultimo_pagamento_em: string | null;
  bloqueio_motivo: string | null;
  planos?: { nome: string } | null;
  imobiliarias?: { nome_fantasia: string } | null;
  usuario_id: string | null;
};
type Pagamento = {
  id: string; valor: number; metodo: string; status: string;
  vencimento: string | null; pago_em: string | null;
  competencia: string | null; observacao: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  pago: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  pendente: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  atrasado: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  estornado: "bg-orange-500/15 text-orange-700 border-orange-500/30",
};

const empty = {
  valor: 0, metodo: "pix", status: "pago",
  vencimento: "", pago_em: new Date().toISOString().slice(0, 10),
  competencia: new Date().toISOString().slice(0, 7), observacao: "",
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function addOneCycle(date: string, ciclo: string) {
  const d = new Date(date);
  if (ciclo === "anual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function AssinaturaDetalhe() {
  const { id } = useParams({ from: "/_authenticated/assinaturas/$id" });
  const [ass, setAss] = useState<Assinatura | null>(null);
  const [pags, setPags] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const formRef = useRef<HTMLDivElement>(null);

  const [bloqOpen, setBloqOpen] = useState(false);
  const [bloqMotivo, setBloqMotivo] = useState("");

  async function load() {
    setLoading(true);
    const [a, p] = await Promise.all([
      supabase.from("assinaturas").select("*, planos(nome), imobiliarias(nome_fantasia)").eq("id", id).single(),
      supabase.from("pagamentos").select("*").eq("assinatura_id", id).order("created_at", { ascending: false }),
    ]);
    if (a.error) toast.error(a.error.message);
    setAss(((a.data ?? null) as unknown as Assinatura | null));
    setPags(((p.data ?? []) as unknown as Pagamento[]));
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  function openNew() {
    setForm({ ...empty, valor: ass ? Number(ass.valor) : 0 });
    setOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }

  async function gerarCobranca() {
    if (!ass) return;
    const venc = ass.proximo_vencimento ?? new Date().toISOString().slice(0, 10);
    const comp = venc.slice(0, 7);
    // TODO_GATEWAY: integrar com API do gateway aqui (Stripe/Asaas/Pagar.me)
    const { error } = await supabase.from("pagamentos").insert({
      assinatura_id: id,
      valor: Number(ass.valor) || 0,
      metodo: "pix",
      status: "pendente",
      vencimento: venc,
      competencia: comp,
    });
    if (error) return toast.error(error.message);
    toast.success("Cobrança gerada");
    load();
  }

  async function savePagamento() {
    const { data: userData } = await supabase.auth.getUser();
    // TODO_GATEWAY: integrar com API do gateway aqui (Stripe/Asaas/Pagar.me)
    const payload = {
      assinatura_id: id,
      valor: Number(form.valor) || 0,
      metodo: form.metodo, status: form.status,
      vencimento: form.vencimento || null,
      pago_em: form.status === "pago" ? (form.pago_em || null) : null,
      competencia: form.competencia || null,
      observacao: form.observacao || null,
      registrado_por: userData.user?.id,
    };
    const { error } = await supabase.from("pagamentos").insert(payload);
    if (error) return toast.error(error.message);

    if (form.status === "pago" && ass) {
      const base = ass.proximo_vencimento ?? form.pago_em;
      // TODO_GATEWAY: integrar com API do gateway aqui (Stripe/Asaas/Pagar.me)
      await supabase.from("assinaturas").update({
        ultimo_pagamento_em: form.pago_em,
        proximo_vencimento: addOneCycle(base, ass.ciclo),
        status: ass.status === "bloqueada" ? "ativa" : ass.status,
        bloqueio_motivo: null,
      }).eq("id", id);
    }
    toast.success("Pagamento registrado");
    setOpen(false); load();
  }

  async function removePag(p: Pagamento) {
    if (!confirm("Excluir este pagamento?")) return;
    const { error } = await supabase.from("pagamentos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento excluído"); load();
  }

  async function confirmarBloqueio() {
    if (!bloqMotivo.trim()) { toast.error("Informe o motivo"); return; }
    const { error } = await supabase.from("assinaturas")
      .update({ status: "bloqueada", bloqueio_motivo: bloqMotivo.trim() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Assinatura bloqueada");
    setBloqOpen(false); setBloqMotivo(""); load();
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!ass) return <p className="text-sm text-muted-foreground">Assinatura não encontrada.</p>;

  const titular = ass.imobiliarias?.nome_fantasia ?? (ass.usuario_id ? "Corretor autônomo" : "—");
  const hoje = startOfToday();
  const venc = ass.proximo_vencimento ? new Date(ass.proximo_vencimento) : null;
  if (venc) venc.setHours(0,0,0,0);
  const atrasado = !!venc && venc < hoje && ass.status !== "cancelada" && ass.status !== "bloqueada";
  const diasAtraso = atrasado && venc ? Math.floor((hoje.getTime() - venc.getTime()) / 86400000) : 0;

  return (
    <>
      <Link to="/assinaturas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageHeader title={titular} description={`${ass.planos?.nome ?? "Plano"} · ${ass.ciclo}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={gerarCobranca}><FileText className="h-4 w-4" /> Gerar cobrança</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Registrar pagamento</Button>
          </div>
        } />

      {atrasado && (
        <div className="mb-4 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-orange-900">
                Esta assinatura está em atraso há {diasAtraso} dia{diasAtraso !== 1 ? "s" : ""}.
              </div>
              <div className="text-sm text-orange-800">
                Vencimento era {venc!.toLocaleDateString("pt-BR")}.
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => { setBloqMotivo(`Inadimplência: ${diasAtraso} dias de atraso`); setBloqOpen(true); }}>
                  <Lock className="h-4 w-4" /> Bloquear acesso
                </Button>
                <Button size="sm" onClick={openNew}>
                  <Plus className="h-4 w-4" /> Registrar pagamento
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <div><div className="text-xs uppercase text-muted-foreground">Status</div><Badge>{ass.status}</Badge></div>
          <div><div className="text-xs uppercase text-muted-foreground">Valor</div><div className="font-semibold">{fmtBRL(Number(ass.valor))}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Próx. vencimento</div><div className="font-semibold">{ass.proximo_vencimento ? new Date(ass.proximo_vencimento).toLocaleDateString("pt-BR") : "—"}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Último pagamento</div><div className="font-semibold">{ass.ultimo_pagamento_em ? new Date(ass.ultimo_pagamento_em).toLocaleDateString("pt-BR") : "—"}</div></div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Competência</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pags.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.competencia ?? "—"}</TableCell>
                <TableCell>{fmtBRL(Number(p.valor))}</TableCell>
                <TableCell><Badge variant="secondary">{p.metodo}</Badge></TableCell>
                <TableCell>{p.vencimento ? new Date(p.vencimento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell>{p.pago_em ? new Date(p.pago_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_BADGE[p.status] ?? ""}>{p.status}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => removePag(p)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {pags.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div ref={formRef} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={form.metodo} onValueChange={(v) => setForm({ ...form, metodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="estornado">Estornado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competência (AAAA-MM)</Label>
              <Input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pago em</Label>
              <Input type="date" value={form.pago_em} onChange={(e) => setForm({ ...form, pago_em: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={savePagamento}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bloqOpen} onOpenChange={setBloqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear assinatura</DialogTitle>
            <DialogDescription>O cliente perderá acesso até ser desbloqueado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo do bloqueio *</Label>
            <Textarea rows={3} value={bloqMotivo} onChange={(e) => setBloqMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBloqOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarBloqueio}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
