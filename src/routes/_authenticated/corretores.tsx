import { CORRETOR_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Briefcase, Search, Pencil, Power, PowerOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/corretores")({
  head: () => ({ meta: [{ title: "Corretores — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "imobiliaria"]}>
      <CorretoresPage />
    </RoleGate>
  ),
});

type Corretor = {
  id: string;
  imobiliaria_id: string | null;
  nome: string;
  creci: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  foto_url: string | null;
  status: string;
};
type Imob = { id: string; nome_fantasia: string };

const empty = { nome: "", creci: "", email: "", telefone: "", whatsapp: "", foto_url: "", status: "ativo", imobiliaria_id: "" };

function CorretoresPage() {
  const [items, setItems] = useState<Corretor[]>([]);
  const [imobs, setImobs] = useState<Imob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Corretor | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const [{ data: c, error }, { data: i }] = await Promise.all([
      supabase.from("corretores").select(CORRETOR_PUBLIC_COLUMNS).order("created_at", { ascending: false }),
      supabase.from("imobiliarias").select("id, nome_fantasia").order("nome_fantasia"),
    ]);
    if (error) toast.error(error.message);
    setItems((c ?? []) as Corretor[]);
    setImobs((i ?? []) as Imob[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(it: Corretor) {
    setEditing(it);
    setForm({
      nome: it.nome, creci: it.creci ?? "", email: it.email ?? "",
      telefone: it.telefone ?? "", whatsapp: it.whatsapp ?? "",
      foto_url: it.foto_url ?? "", status: it.status,
      imobiliaria_id: it.imobiliaria_id ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: form.nome,
      creci: form.creci || null,
      email: form.email || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      foto_url: form.foto_url || null,
      status: form.status,
      imobiliaria_id: form.imobiliaria_id || null,
    };
    const { error } = editing
      ? await supabase.from("corretores").update(payload).eq("id", editing.id)
      : await supabase.from("corretores").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Corretor atualizado" : "Corretor cadastrado");
    setOpen(false); load();
  }

  async function toggleStatus(it: Corretor) {
    const next = it.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase.from("corretores").update({ status: next }).eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Corretor ${next === "ativo" ? "reativado" : "inativado"}`);
    load();
  }

  const filtered = items.filter((i) =>
    [i.nome, i.creci, i.email].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );
  const imobName = (id: string | null) => imobs.find((x) => x.id === id)?.nome_fantasia ?? "Autônomo";

  return (
    <>
      <PageHeader
        title="Corretores"
        description="Gestão de corretores vinculados a imobiliárias ou autônomos."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Novo corretor</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar corretor" : "Novo corretor"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <Field label="Nome *"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
                <Field label="CRECI"><Input value={form.creci} onChange={(e) => setForm({ ...form, creci: e.target.value })} /></Field>
                <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
                <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
                <Field label="Foto (URL)"><Input value={form.foto_url} onChange={(e) => setForm({ ...form, foto_url: e.target.value })} /></Field>
                <Field label="Imobiliária">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={form.imobiliaria_id}
                    onChange={(e) => setForm({ ...form, imobiliaria_id: e.target.value })}
                  >
                    <option value="">— Autônomo —</option>
                    {imobs.map((i) => <option key={i.id} value={i.id}>{i.nome_fantasia}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </Field>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar corretor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum corretor cadastrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead>CRECI</TableHead>
                  <TableHead>Imobiliária</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {c.foto_url && <AvatarImage src={c.foto_url} />}
                          <AvatarFallback className="text-xs">
                            {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{c.nome}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.creci ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{imobName(c.imobiliaria_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? c.telefone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleStatus(c)}>
                          {c.status === "ativo" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
