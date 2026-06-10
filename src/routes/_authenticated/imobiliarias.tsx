import { IMOBILIARIA_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Building, Search, Pencil, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imobiliarias")({
  head: () => ({ meta: [{ title: "Imobiliárias — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin"]}>
      <ImobiliariasPage />
    </RoleGate>
  ),
});

type Imobiliaria = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  status: string;
  created_at: string;
};

const empty = { nome_fantasia: "", razao_social: "", cnpj: "", telefone: "", email: "", site: "", status: "ativa" };

function ImobiliariasPage() {
  const [items, setItems] = useState<Imobiliaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Imobiliaria | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imobiliarias").select(IMOBILIARIA_PUBLIC_COLUMNS).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as unknown as Imobiliaria[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null); setForm(empty); setOpen(true);
  }
  function openEdit(it: Imobiliaria) {
    setEditing(it);
    setForm({
      nome_fantasia: it.nome_fantasia, razao_social: it.razao_social ?? "",
      cnpj: it.cnpj ?? "", telefone: it.telefone ?? "", email: it.email ?? "",
      site: it.site ?? "", status: it.status,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.nome_fantasia.trim()) { toast.error("Nome fantasia obrigatório"); return; }
    const payload = { ...form, cnpj: form.cnpj || null, email: form.email || null };
    const { error } = editing
      ? await supabase.from("imobiliarias").update(payload).eq("id", editing.id)
      : await supabase.from("imobiliarias").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Imobiliária atualizada" : "Imobiliária criada");
    setOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir imobiliária?")) return;
    const { error } = await supabase.from("imobiliarias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída"); load();
  }

  const filtered = items.filter((i) =>
    [i.nome_fantasia, i.razao_social, i.cnpj, i.email].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <>
      <PageHeader
        title="Imobiliárias"
        description="Empresas cadastradas na plataforma."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Nova imobiliária</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar imobiliária" : "Nova imobiliária"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <Field label="Nome Fantasia *">
                  <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                </Field>
                <Field label="Razão Social">
                  <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                </Field>
                <Field label="CNPJ">
                  <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                </Field>
                <Field label="Telefone">
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Site">
                  <Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
                </Field>
                <Field label="Status">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </Field>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Building className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma imobiliária cadastrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.nome_fantasia}</TableCell>
                    <TableCell className="text-muted-foreground">{i.cnpj ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={i.status === "ativa" ? "default" : "secondary"}>{i.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
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
