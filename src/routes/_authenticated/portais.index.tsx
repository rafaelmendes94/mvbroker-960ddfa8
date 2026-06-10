import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Rss } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPortais, upsertPortal, deletePortal } from "@/lib/portais.functions";

export const Route = createFileRoute("/_authenticated/portais/")({
  head: () => ({ meta: [{ title: "Portais Imobiliários — MV Broker" }] }),
  component: PortaisAdmin,
});

const FORMATOS = [
  { v: "vrsync", l: "VRSync (universal)" },
  { v: "olx", l: "OLX" },
  { v: "imovelweb", l: "ImovelWeb" },
];

function PortaisAdmin() {
  const fnList = useServerFn(listPortais);
  const fnUpsert = useServerFn(upsertPortal);
  const fnDelete = useServerFn(deletePortal);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setItems(await fnList() ?? []); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const openNew = () => { setEditing({ slug: "", nome: "", formato_xml: "vrsync", ordem: 99, ativo: true }); setOpen(true); };
  const openEdit = (p: any) => { setEditing({ ...p }); setOpen(true); };

  const save = async () => {
    if (!editing.nome || !editing.slug) { toast.error("Nome e slug obrigatórios"); return; }
    try {
      await fnUpsert({ data: editing });
      toast.success("Portal salvo");
      setOpen(false); reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este portal? Todas as conexões com carteiras serão removidas.")) return;
    await fnDelete({ data: { id } });
    toast.success("Portal excluído");
    reload();
  };

  return (
    <>
      <PageHeader
        title="Portais Imobiliários"
        description="Catálogo de portais para distribuição XML. Carteiras conectam-se a estes portais."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Novo portal</Button>}
      />

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-md grid place-items-center text-white shrink-0"
                         style={{ background: p.cor ?? "#64748b" }}>
                      <Rss className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.nome}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{p.slug}</div>
                    </div>
                  </div>
                  <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{p.descricao || "—"}</p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Formato: <code className="bg-muted px-1 rounded">{p.formato_xml}</code></span>
                  <span>Ordem: {p.ordem}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar portal" : "Novo portal"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug *</Label>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Formato XML</Label>
                  <Select value={editing.formato_xml} onValueChange={(v) => setEditing({ ...editing, formato_xml: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMATOS.map(f => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <Input type="color" value={editing.cor ?? "#64748b"} onChange={(e) => setEditing({ ...editing, cor: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Site URL</Label>
                  <Input value={editing.site_url ?? ""} onChange={(e) => setEditing({ ...editing, site_url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.ordem ?? 0} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Instruções de conexão</Label>
                <Textarea value={editing.instrucoes ?? ""} onChange={(e) => setEditing({ ...editing, instrucoes: e.target.value })} rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                <Label>Portal ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
