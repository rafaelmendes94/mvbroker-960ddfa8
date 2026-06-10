import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Loader2, Lock, Unlock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  head: () => ({ meta: [{ title: "Assinaturas — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <AssinaturasPage />
    </RoleGate>
  ),
});

type Row = {
  id: string;
  plano_id: string;
  imobiliaria_id: string | null;
  usuario_id: string | null;
  ciclo: "mensal" | "anual";
  valor: number;
  status: "ativa" | "bloqueada" | "cancelada" | "trial";
  bloqueio_motivo: string | null;
  proximo_vencimento: string | null;
  planos?: { nome: string } | null;
  imobiliarias?: { nome_fantasia: string } | null;
};

type Plano = { id: string; nome: string; tipo: string; preco_mensal: number; preco_anual: number | null };
type Imob = { id: string; nome_fantasia: string };
type Profile = { id: string; full_name: string | null };

const empty = {
  plano_id: "", titular_tipo: "imobiliaria" as "imobiliaria" | "usuario",
  imobiliaria_id: "", usuario_id: "",
  ciclo: "mensal" as "mensal" | "anual",
  valor: 0, status: "ativa" as Row["status"],
  bloqueio_motivo: "", proximo_vencimento: "",
};

const STATUS_STYLE: Record<Row["status"], string> = {
  ativa: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  trial: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  bloqueada: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  cancelada: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AssinaturasPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [imobs, setImobs] = useState<Imob[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  async function load() {
    setLoading(true);
    const [a, p, i, u] = await Promise.all([
      supabase.from("assinaturas").select("*, planos(nome), imobiliarias(nome_fantasia)").order("created_at", { ascending: false }),
      supabase.from("planos").select("id, nome, tipo, preco_mensal, preco_anual").eq("ativo", true).order("ordem"),
      supabase.from("imobiliarias").select("id, nome_fantasia").order("nome_fantasia"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);
    if (a.error) toast.error(a.error.message);
    setItems(((a.data ?? []) as unknown as Row[]));
    setPlanos(((p.data ?? []) as unknown as Plano[]));
    setImobs(((i.data ?? []) as unknown as Imob[]));
    setUsers(((u.data ?? []) as unknown as Profile[]));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setForm(empty); setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      plano_id: r.plano_id,
      titular_tipo: r.usuario_id ? "usuario" : "imobiliaria",
      imobiliaria_id: r.imobiliaria_id ?? "",
      usuario_id: r.usuario_id ?? "",
      ciclo: r.ciclo, valor: Number(r.valor), status: r.status,
      bloqueio_motivo: r.bloqueio_motivo ?? "",
      proximo_vencimento: r.proximo_vencimento ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.plano_id) { toast.error("Selecione um plano"); return; }
    if (form.titular_tipo === "imobiliaria" && !form.imobiliaria_id) { toast.error("Selecione a imobiliária"); return; }
    if (form.titular_tipo === "usuario" && !form.usuario_id) { toast.error("Selecione o corretor"); return; }
    const payload = {
      plano_id: form.plano_id,
      imobiliaria_id: form.titular_tipo === "imobiliaria" ? form.imobiliaria_id : null,
      usuario_id: form.titular_tipo === "usuario" ? form.usuario_id : null,
      ciclo: form.ciclo, valor: Number(form.valor) || 0,
      status: form.status,
      bloqueio_motivo: form.status === "bloqueada" ? (form.bloqueio_motivo || null) : null,
      proximo_vencimento: form.proximo_vencimento || null,
    };
    const { error } = editing
      ? await supabase.from("assinaturas").update(payload).eq("id", editing.id)
      : await supabase.from("assinaturas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Assinatura atualizada" : "Assinatura criada");
    setOpen(false); load();
  }

  async function toggleStatus(r: Row) {
    const novo = r.status === "ativa" ? "bloqueada" : "ativa";
    const motivo = novo === "bloqueada" ? (prompt("Motivo do bloqueio:") ?? "") : null;
    const { error } = await supabase.from("assinaturas").update({ status: novo, bloqueio_motivo: motivo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(novo === "ativa" ? "Assinatura liberada" : "Assinatura bloqueada");
    load();
  }

  const filtered = statusFilter === "todos" ? items : items.filter((r) => r.status === statusFilter);

  return (
    <>
      <PageHeader title="Assinaturas" description="Vincule planos a imobiliárias ou corretores e controle o acesso."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova assinatura</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="bloqueada">Bloqueadas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Titular</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const titular = r.imobiliaria_id
                  ? r.imobiliarias?.nome_fantasia ?? "Imobiliária"
                  : users.find((u) => u.id === r.usuario_id)?.full_name ?? "Corretor";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{titular}</div>
                      <div className="text-xs text-muted-foreground">{r.imobiliaria_id ? "Imobiliária" : "Individual"}</div>
                    </TableCell>
                    <TableCell>{r.planos?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{r.ciclo}</Badge></TableCell>
                    <TableCell>{fmtBRL(Number(r.valor))}</TableCell>
                    <TableCell>{r.proximo_vencimento ? new Date(r.proximo_vencimento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLE[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Link to="/assinaturas/$id" params={{ id: r.id }}>
                        <Button variant="ghost" size="icon" title="Detalhes"><ExternalLink className="h-4 w-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => toggleStatus(r)} title={r.status === "ativa" ? "Bloquear" : "Liberar"}>
                        {r.status === "ativa" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma assinatura.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar assinatura" : "Nova assinatura"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={form.plano_id} onValueChange={(v) => {
                const pl = planos.find((p) => p.id === v);
                setForm({
                  ...form, plano_id: v,
                  valor: pl ? (form.ciclo === "anual" ? Number(pl.preco_anual ?? 0) : Number(pl.preco_mensal)) : form.valor,
                  titular_tipo: pl?.tipo === "individual" ? "usuario" : "imobiliaria",
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.tipo})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ciclo</Label>
              <Select value={form.ciclo} onValueChange={(v: "mensal" | "anual") => {
                const pl = planos.find((p) => p.id === form.plano_id);
                setForm({ ...form, ciclo: v, valor: pl ? (v === "anual" ? Number(pl.preco_anual ?? 0) : Number(pl.preco_mensal)) : form.valor });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label>Titular</Label>
              <Select value={form.titular_tipo} onValueChange={(v: "imobiliaria" | "usuario") => setForm({ ...form, titular_tipo: v, imobiliaria_id: "", usuario_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                  <SelectItem value="usuario">Corretor autônomo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.titular_tipo === "imobiliaria" ? (
              <div className="sm:col-span-2 space-y-2">
                <Label>Imobiliária</Label>
                <Select value={form.imobiliaria_id} onValueChange={(v) => setForm({ ...form, imobiliaria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {imobs.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome_fantasia}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="sm:col-span-2 space-y-2">
                <Label>Usuário (corretor)</Label>
                <Select value={form.usuario_id} onValueChange={(v) => setForm({ ...form, usuario_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Próximo vencimento</Label>
              <Input type="date" value={form.proximo_vencimento} onChange={(e) => setForm({ ...form, proximo_vencimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: Row["status"]) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="bloqueada">Bloqueada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "bloqueada" && (
              <div className="sm:col-span-2 space-y-2">
                <Label>Motivo do bloqueio</Label>
                <Textarea rows={2} value={form.bloqueio_motivo} onChange={(e) => setForm({ ...form, bloqueio_motivo: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
