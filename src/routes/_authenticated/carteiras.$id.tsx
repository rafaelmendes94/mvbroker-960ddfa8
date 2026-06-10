import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, Search, Rss, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  getCarteira,
  listCarteiraItems,
  addCarteiraItems,
  removeCarteiraItems,
  getFeedLogs,
} from "@/lib/carteiras.functions";

export const Route = createFileRoute("/_authenticated/carteiras/$id")({
  head: () => ({ meta: [{ title: "Carteira — MV Broker" }] }),
  component: CarteiraDetalhe,
});

function CarteiraDetalhe() {
  const { id } = Route.useParams();
  const fnGet = useServerFn(getCarteira);
  const fnItems = useServerFn(listCarteiraItems);
  const fnAdd = useServerFn(addCarteiraItems);
  const fnRemove = useServerFn(removeCarteiraItems);
  const fnLogs = useServerFn(getFeedLogs);

  const [carteira, setCarteira] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewXml, setPreviewXml] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);

  const feedUrl = useMemo(
    () => (carteira ? `${window.location.origin}/api/public/feed/${carteira.slug}.xml` : ""),
    [carteira],
  );

  const reload = async () => {
    setLoading(true);
    try {
      const [c, its, lg] = await Promise.all([
        fnGet({ data: { id } }),
        fnItems({ data: { carteira_id: id } }),
        fnLogs({ data: { carteira_id: id } }),
      ]);
      setCarteira(c);
      setItems(its ?? []);
      setLogs(lg ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  const removeItem = async (imovelId: string) => {
    await fnRemove({ data: { carteira_id: id, imovel_ids: [imovelId] } });
    toast.success("Removido");
    reload();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    toast.success("URL XML copiada");
  };

  const previewFeed = async () => {
    setPreviewing(true);
    setPreviewOpen(true);
    try {
      const r = await fetch(feedUrl);
      const t = await r.text();
      setPreviewXml(t);
    } catch (e: any) {
      setPreviewXml(`Erro: ${e?.message ?? e}`);
    } finally {
      setPreviewing(false);
    }
  };

  if (loading || !carteira) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <>
      <PageHeader
        title={carteira.nome}
        description={carteira.descricao || "Carteira de distribuição XML"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/carteiras"><ArrowLeft className="h-4 w-4 mr-1.5" />Voltar</Link>
            </Button>
            <Button onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Adicionar imóveis</Button>
          </div>
        }
      />

      {/* Feed card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Rss className="h-4 w-4" />URL do Feed XML</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{feedUrl}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyUrl}><Copy className="h-3.5 w-3.5 mr-1" />Copiar</Button>
              <Button size="sm" variant="outline" onClick={previewFeed}><ExternalLink className="h-3.5 w-3.5 mr-1" />Visualizar</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole esta URL nos portais (OLX, Viva Real, ZAP, ImovelWeb, etc) para distribuir automaticamente os imóveis desta carteira.
            Formato VRSync (universal). Atualizado a cada acesso.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{items.length} imóvel(is) na carteira</span>
            <span>Status: <Badge variant={carteira.status === "ativa" ? "default" : "secondary"} className="ml-1">{carteira.status}</Badge></span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="imoveis" className="mt-4">
        <TabsList>
          <TabsTrigger value="imoveis">Imóveis ({items.length})</TabsTrigger>
          <TabsTrigger value="logs">Histórico ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="imoveis">
          {items.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum imóvel nesta carteira. Clique em "Adicionar imóveis".
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.imoveis?.codigo_interno ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{it.imoveis?.titulo ?? "—"}</TableCell>
                      <TableCell>{it.imoveis?.cidade ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{it.imoveis?.status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {it.imoveis?.preco != null
                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(it.imoveis.preco)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => removeItem(it.imovel_id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          {logs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline">{l.acao}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{l.detalhes ? JSON.stringify(l.detalhes) : "—"}</TableCell>
                      <TableCell className="text-xs">{l.ip ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ImovelPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={new Set(items.map((i) => i.imovel_id))}
        onAdd={async (ids) => {
          await fnAdd({ data: { carteira_id: id, imovel_ids: ids } });
          toast.success(`${ids.length} imóvel(is) adicionado(s)`);
          setPickerOpen(false);
          reload();
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Preview do Feed XML</DialogTitle></DialogHeader>
          {previewing ? (
            <p className="text-sm text-muted-foreground py-8 text-center"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Gerando feed...</p>
          ) : (
            <pre className="bg-muted rounded p-3 text-[11px] font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">{previewXml}</pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(previewXml); toast.success("XML copiado"); }}>Copiar XML</Button>
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImovelPicker({
  open, onClose, existingIds, onAdd,
}: {
  open: boolean; onClose: () => void; existingIds: Set<string>; onAdd: (ids: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("imoveis")
        .select("id, codigo_interno, titulo, cidade, bairro, preco, status, tipo")
        .eq("arquivado", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (busca.trim()) {
        q = q.or(`titulo.ilike.%${busca}%,codigo_interno.ilike.%${busca}%,cidade.ilike.%${busca}%`);
      }
      const { data } = await q;
      if (cancel) return;
      setImoveis(data ?? []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, busca]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Adicionar imóveis à carteira</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por código, título ou cidade..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="max-h-[50vh] overflow-auto border rounded">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
          ) : imoveis.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhum imóvel encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imoveis.map((im) => {
                  const already = existingIds.has(im.id);
                  return (
                    <TableRow key={im.id} className={already ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(im.id)}
                          disabled={already}
                          onCheckedChange={() => toggle(im.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{im.codigo_interno ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{im.titulo ?? "—"} {already && <span className="text-[10px] text-muted-foreground">(já na carteira)</span>}</TableCell>
                      <TableCell>{im.cidade ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {im.preco != null
                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(im.preco)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <span className="text-sm text-muted-foreground mr-auto">{selected.size} selecionado(s)</span>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!selected.size} onClick={() => onAdd(Array.from(selected))}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
