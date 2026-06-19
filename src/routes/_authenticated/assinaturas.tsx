import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Lock, Unlock, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  observacao?: string | null;
  proximo_vencimento: string | null;
  ultimo_pagamento_em: string | null;
  planos?: { nome: string } | null;
  imobiliarias?: { nome_fantasia: string } | null;
};

type Plano = { id: string; nome: string; tipo: string; preco_mensal: number; preco_anual: number | null };
type Imob = { id: string; nome_fantasia: string };
type Profile = { id: string; full_name: string | null };

type FiltroResumo = "todos" | "ativa" | "trial" | "bloqueada" | "cancelada" | "inadimplentes" | "a_vencer";

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

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function parseDate(s: string | null) {
  if (!s) return null;
  const d = new Date(s); d.setHours(0, 0, 0, 0); return d;
}
function diasEntre(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function AssinaturasPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [imobs, setImobs] = useState<Imob[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [filtro, setFiltro] = useState<FiltroResumo>("todos");

  // dialogs de ações
  const [bloqueioAlvo, setBloqueioAlvo] = useState<Row | null>(null);
  const [bloqueioMotivo, setBloqueioMotivo] = useState("");
  const [desbloqueioAlvo, setDesbloqueioAlvo] = useState<Row | null>(null);
  const [cancelAlvo, setCancelAlvo] = useState<Row | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);

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

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
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

  async function confirmarBloqueio() {
    if (!bloqueioAlvo) return;
    if (!bloqueioMotivo.trim()) { toast.error("Informe o motivo do bloqueio"); return; }
    const { error } = await supabase.from("assinaturas")
      .update({ status: "bloqueada", bloqueio_motivo: bloqueioMotivo.trim() })
      .eq("id", bloqueioAlvo.id);
    if (error) return toast.error(error.message);
    toast.success("Assinatura bloqueada");
    setBloqueioAlvo(null); setBloqueioMotivo(""); load();
  }

  async function confirmarDesbloqueio() {
    if (!desbloqueioAlvo) return;
    const { error } = await supabase.from("assinaturas")
      .update({ status: "ativa", bloqueio_motivo: null })
      .eq("id", desbloqueioAlvo.id);
    if (error) return toast.error(error.message);
    toast.success("Assinatura liberada");
    setDesbloqueioAlvo(null); load();
  }

  async function confirmarCancelamento() {
    if (!cancelAlvo) return;
    if (!cancelMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    if (!cancelConfirm) { toast.error("Confirme o cancelamento"); return; }
    const { error } = await supabase.from("assinaturas")
      .update({ status: "cancelada", observacao: cancelMotivo.trim() })
      .eq("id", cancelAlvo.id);
    if (error) return toast.error(error.message);
    toast.success("Assinatura cancelada");
    setCancelAlvo(null); setCancelMotivo(""); setCancelConfirm(false); load();
  }

  const hoje = startOfToday();
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);

  const resumo = useMemo(() => {
    let ativas = 0, trial = 0, inadimplentes = 0, bloqueadas = 0, aVencer = 0;
    for (const r of items) {
      const venc = parseDate(r.proximo_vencimento);
      if (r.status === "ativa" && venc && venc >= hoje) ativas++;
      if (r.status === "trial") trial++;
      if (r.status === "bloqueada") bloqueadas++;
      if ((r.status === "ativa" || r.status === "trial") && venc && venc < hoje) inadimplentes++;
      if ((r.status === "ativa" || r.status === "trial") && venc && venc >= hoje && venc <= em7) aVencer++;
    }
    return { ativas, trial, inadimplentes, bloqueadas, aVencer };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const filtered = useMemo(() => items.filter((r) => {
    const venc = parseDate(r.proximo_vencimento);
    switch (filtro) {
      case "todos": return true;
      case "ativa": return r.status === "ativa" && !!venc && venc >= hoje;
      case "trial": return r.status === "trial";
      case "bloqueada": return r.status === "bloqueada";
      case "cancelada": return r.status === "cancelada";
      case "inadimplentes":
        return (r.status === "ativa" || r.status === "trial") && !!venc && venc < hoje;
      case "a_vencer":
        return (r.status === "ativa" || r.status === "trial") && !!venc && venc >= hoje && venc <= em7;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, filtro]);

  const cards: { key: FiltroResumo; label: string; value: number; tone: string }[] = [
    { key: "ativa", label: "Ativas em dia", value: resumo.ativas, tone: "text-emerald-600" },
    { key: "trial", label: "Em trial", value: resumo.trial, tone: "text-blue-600" },
    { key: "inadimplentes", label: "Inadimplentes", value: resumo.inadimplentes, tone: "text-rose-600" },
    { key: "bloqueada", label: "Bloqueadas", value: resumo.bloqueadas, tone: "text-amber-600" },
    { key: "a_vencer", label: "A vencer em 7 dias", value: resumo.aVencer, tone: "text-yellow-600" },
  ];

  return (
    <>
      <PageHeader title="Assinaturas" description="Vincule planos a imobiliárias ou corretores e controle o acesso."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova assinatura</Button>} />

      <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => setFiltro((cur) => cur === c.key ? "todos" : c.key)}
            className={cn(
              "rounded-lg border bg-card p-4 text-left transition hover:shadow-sm",
              filtro === c.key && "ring-2 ring-primary border-primary"
            )}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={cn("mt-1 text-2xl font-bold", c.tone)}>{c.value}</div>
          </button>
        ))}
      </div>

      {filtro !== "todos" && (
        <div className="mb-3">
          <Button variant="ghost" size="sm" onClick={() => setFiltro("todos")}>Limpar filtro</Button>
        </div>
      )}

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
                <TableHead>Próx. vencimento</TableHead>
                <TableHead>Último pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const titular = r.imobiliaria_id
                  ? r.imobiliarias?.nome_fantasia ?? "Imobiliária"
                  : users.find((u) => u.id === r.usuario_id)?.full_name ?? "Corretor";
                const venc = parseDate(r.proximo_vencimento);
                const atrasado = !!venc && venc < hoje && (r.status === "ativa" || r.status === "trial");
                const aVencer = !!venc && venc >= hoje && venc <= em7 && (r.status === "ativa" || r.status === "trial");
                const vencColor = atrasado ? "text-rose-600 font-medium"
                  : aVencer ? "text-yellow-600 font-medium"
                  : venc ? "text-emerald-700" : "text-muted-foreground";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{titular}</div>
                      <div className="text-xs text-muted-foreground">{r.imobiliaria_id ? "Imobiliária" : "Individual"}</div>
                    </TableCell>
                    <TableCell>{r.planos?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{r.ciclo}</Badge></TableCell>
                    <TableCell>{fmtBRL(Number(r.valor))}</TableCell>
                    <TableCell>
                      <div className={cn("flex items-center gap-2", vencColor)}>
                        {venc ? venc.toLocaleDateString("pt-BR") : "—"}
                        {atrasado && (
                          <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-700">Em atraso</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.ultimo_pagamento_em ? new Date(r.ultimo_pagamento_em).toLocaleDateString("pt-BR") : <span className="text-muted-foreground">Nunca</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLE[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Link to="/assinaturas/$id" params={{ id: r.id }}>
                        <Button variant="ghost" size="icon" title="Detalhes"><ExternalLink className="h-4 w-4" /></Button>
                      </Link>
                      {r.status === "bloqueada" ? (
                        <Button variant="ghost" size="icon" onClick={() => setDesbloqueioAlvo(r)} title="Liberar">
                          <Unlock className="h-4 w-4" />
                        </Button>
                      ) : r.status !== "cancelada" && (
                        <Button variant="ghost" size="icon" onClick={() => { setBloqueioAlvo(r); setBloqueioMotivo(""); }} title="Bloquear">
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                      {r.status !== "cancelada" && (
                        <Button variant="ghost" size="icon" onClick={() => { setCancelAlvo(r); setCancelMotivo(""); setCancelConfirm(false); }} title="Cancelar">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhuma assinatura.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog editar/criar */}
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

      {/* Dialog bloqueio */}
      <Dialog open={!!bloqueioAlvo} onOpenChange={(o) => !o && setBloqueioAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear assinatura</DialogTitle>
            <DialogDescription>O cliente perderá acesso até ser desbloqueado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo do bloqueio *</Label>
            <Textarea rows={3} value={bloqueioMotivo} onChange={(e) => setBloqueioMotivo(e.target.value)} placeholder="Ex.: inadimplência há 30 dias" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBloqueioAlvo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarBloqueio}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog desbloqueio */}
      <Dialog open={!!desbloqueioAlvo} onOpenChange={(o) => !o && setDesbloqueioAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desbloquear assinatura</DialogTitle>
            <DialogDescription>Liberar o acesso desta assinatura agora?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesbloqueioAlvo(null)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmarDesbloqueio}>Desbloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog cancelamento */}
      <Dialog open={!!cancelAlvo} onOpenChange={(o) => !o && setCancelAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar assinatura</DialogTitle>
            <DialogDescription className="text-rose-600">O cliente perderá acesso imediatamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea rows={3} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cancelConfirm} onCheckedChange={(v) => setCancelConfirm(!!v)} />
              Confirmo o cancelamento
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelAlvo(null)}>Voltar</Button>
            <Button variant="destructive" onClick={confirmarCancelamento}>Cancelar assinatura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
