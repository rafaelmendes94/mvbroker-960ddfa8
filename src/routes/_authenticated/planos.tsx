import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({ meta: [{ title: "Planos — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <PlanosPage />
    </RoleGate>
  ),
});

type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: "individual" | "imobiliaria";
  preco_mensal: number;
  preco_anual: number | null;
  recursos: string[];
  limite_usuarios: number | null;
  limite_carteiras: number | null;
  ativo: boolean;
  ordem: number;
};

const empty = {
  nome: "", descricao: "", tipo: "individual" as "individual" | "imobiliaria",
  preco_mensal: 0, preco_anual: 0, recursos: "", limite_usuarios: "",
  limite_carteiras: "", ativo: true, ordem: 0,
};

const fmtBRL = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PlanosPage() {
  const [items, setItems] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plano | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("planos").select("*").order("ordem");
    if (error) toast.error(error.message);
    setItems(((data ?? []) as unknown as Plano[]));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setForm(empty); setOpen(true);
  }
  function openEdit(p: Plano) {
    setEditing(p);
    setForm({
      nome: p.nome, descricao: p.descricao ?? "", tipo: p.tipo,
      preco_mensal: Number(p.preco_mensal), preco_anual: Number(p.preco_anual ?? 0),
      recursos: (p.recursos ?? []).join("\n"),
      limite_usuarios: p.limite_usuarios?.toString() ?? "",
      limite_carteiras: p.limite_carteiras?.toString() ?? "",
      ativo: p.ativo, ordem: p.ordem,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: form.nome, descricao: form.descricao || null, tipo: form.tipo,
      preco_mensal: Number(form.preco_mensal) || 0,
      preco_anual: Number(form.preco_anual) || null,
      recursos: form.recursos.split("\n").map((s) => s.trim()).filter(Boolean),
      limite_usuarios: form.limite_usuarios ? Number(form.limite_usuarios) : null,
      limite_carteiras: form.limite_carteiras ? Number(form.limite_carteiras) : null,
      ativo: form.ativo, ordem: Number(form.ordem) || 0,
    };
    const { error } = editing
      ? await supabase.from("planos").update(payload).eq("id", editing.id)
      : await supabase.from("planos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Plano atualizado" : "Plano criado");
    setOpen(false); load();
  }

  async function remove(p: Plano) {
    if (!confirm(`Excluir plano "${p.nome}"?`)) return;
    const { error } = await supabase.from("planos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Plano excluído"); load();
  }

  return (
    <>
      <PageHeader title="Planos" description="Catálogo de planos comerciais do MV BROKER."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Novo plano</Button>} />

      <Card>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Anual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{p.descricao}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{p.tipo}</Badge></TableCell>
                  <TableCell>{fmtBRL(Number(p.preco_mensal))}</TableCell>
                  <TableCell>{fmtBRL(p.preco_anual == null ? null : Number(p.preco_anual))}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "outline"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum plano cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v: "individual" | "imobiliaria") => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual (Corretor)</SelectItem>
                  <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Preço mensal (R$)</Label>
              <Input type="number" step="0.01" value={form.preco_mensal} onChange={(e) => setForm({ ...form, preco_mensal: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Preço anual (R$)</Label>
              <Input type="number" step="0.01" value={form.preco_anual} onChange={(e) => setForm({ ...form, preco_anual: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>{form.tipo === "imobiliaria" ? "Limite de corretores" : "Limite de usuários"}</Label>
              <Input type="number" placeholder="vazio = ilimitado" value={form.limite_usuarios} onChange={(e) => setForm({ ...form, limite_usuarios: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Limite de carteiras</Label>
              <Input type="number" placeholder="vazio = ilimitado" value={form.limite_carteiras} onChange={(e) => setForm({ ...form, limite_carteiras: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Recursos (um por linha)</Label>
              <Textarea rows={5} value={form.recursos} onChange={(e) => setForm({ ...form, recursos: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Plano ativo</Label>
            </div>
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
