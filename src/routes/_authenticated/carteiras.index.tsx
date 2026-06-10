import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FolderOpen, Trash2, Copy, ExternalLink, Rss } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listCarteiras,
  createCarteira,
  deleteCarteira,
} from "@/lib/carteiras.functions";

export const Route = createFileRoute("/_authenticated/carteiras/")({
  head: () => ({ meta: [{ title: "Minhas Carteiras — MV Broker" }] }),
  component: CarteirasList,
});

function CarteirasList() {
  const nav = useNavigate();
  const list = useServerFn(listCarteiras);
  const create = useServerFn(createCarteira);
  const remove = useServerFn(deleteCarteira);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await list();
      setItems(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const feedUrl = (slug: string) => `${window.location.origin}/api/public/feed/${slug}.xml`;

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      const created = await create({ data: { nome: nome.trim(), descricao: descricao.trim() || undefined } });
      toast.success("Carteira criada");
      setOpen(false);
      setNome(""); setDescricao("");
      nav({ to: "/carteiras/$id", params: { id: created.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar carteira");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta carteira? O feed XML será desativado.")) return;
    await remove({ data: { id } });
    toast.success("Carteira excluída");
    reload();
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(feedUrl(slug));
    toast.success("URL XML copiada");
  };

  return (
    <>
      <PageHeader
        title="Minhas Carteiras"
        description="Crie carteiras de imóveis e distribua via XML para os portais."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" />Nova carteira</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova carteira</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Venda Alto Padrão" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={saving || !nome.trim()}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Rss className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Você ainda não tem carteiras.</p>
            <p className="text-xs text-muted-foreground mb-4">
              Crie uma carteira, adicione imóveis e gere uma URL XML para conectar aos portais.
            </p>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Criar primeira carteira</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to="/carteiras/$id" params={{ id: c.id }} className="font-semibold hover:underline truncate block">
                      {c.nome}
                    </Link>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {c.descricao || <span className="italic">Sem descrição</span>}
                    </p>
                  </div>
                  <Badge variant={c.status === "ativa" ? "default" : "secondary"}>{c.status}</Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" />{c.total_imoveis} imóvel(is)</span>
                </div>

                <div className="rounded bg-muted px-2 py-1.5 text-[11px] font-mono truncate" title={feedUrl(c.slug)}>
                  /api/public/feed/{c.slug}.xml
                </div>

                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => copyUrl(c.slug)} className="flex-1">
                    <Copy className="h-3.5 w-3.5 mr-1" />Copiar XML
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={feedUrl(c.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
