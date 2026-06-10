import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, Search, Rss, RefreshCw, Settings2, Users2, BarChart3, Power } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  getCarteira, listCarteiraItems, addCarteiraItems, removeCarteiraItems, getFeedLogs,
} from "@/lib/carteiras.functions";
import {
  listPortais, listCarteiraPortais, conectarPortal, desconectarPortal, togglePortalAtivo,
  listCompartilhamentos, compartilharCarteira, removerCompartilhamento,
  updateRegrasCarteira, getSyncStats,
} from "@/lib/portais.functions";

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
  const fnListPortais = useServerFn(listPortais);
  const fnListCP = useServerFn(listCarteiraPortais);
  const fnConectar = useServerFn(conectarPortal);
  const fnDesconectar = useServerFn(desconectarPortal);
  const fnTogglePortal = useServerFn(togglePortalAtivo);
  const fnListShares = useServerFn(listCompartilhamentos);
  const fnShare = useServerFn(compartilharCarteira);
  const fnUnshare = useServerFn(removerCompartilhamento);
  const fnUpdateRegras = useServerFn(updateRegrasCarteira);
  const fnStats = useServerFn(getSyncStats);

  const [carteira, setCarteira] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [portais, setPortais] = useState<any[]>([]);
  const [cps, setCps] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [stats, setStats] = useState<{ leituras_24h: number; leituras_7d: number; leituras_30d: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewXml, setPreviewXml] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);

  const feedUrl = useMemo(
    () => (carteira ? `${window.location.origin}/api/public/feed/${carteira.slug}.xml` : ""),
    [carteira],
  );
  const portalUrl = (portalSlug: string) =>
    `${window.location.origin}/api/public/portal/${portalSlug}/${carteira?.slug}.xml`;

  const reload = async () => {
    setLoading(true);
    try {
      const [c, its, lg, pts, cp, sh, st] = await Promise.all([
        fnGet({ data: { id } }),
        fnItems({ data: { carteira_id: id } }),
        fnLogs({ data: { carteira_id: id } }),
        fnListPortais(),
        fnListCP({ data: { carteira_id: id } }),
        fnListShares({ data: { carteira_id: id } }),
        fnStats({ data: { carteira_id: id } }),
      ]);
      setCarteira(c); setItems(its ?? []); setLogs(lg ?? []);
      setPortais(pts ?? []); setCps(cp ?? []); setShares(sh ?? []); setStats(st);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao carregar"); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  const removeItem = async (imovelId: string) => {
    await fnRemove({ data: { carteira_id: id, imovel_ids: [imovelId] } });
    toast.success("Removido"); reload();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada");
  };

  const previewFeed = async (url?: string) => {
    setPreviewing(true); setPreviewOpen(true);
    try {
      const r = await fetch(url ?? feedUrl);
      setPreviewXml(await r.text());
    } catch (e: any) {
      setPreviewXml(`Erro: ${e?.message ?? e}`);
    } finally { setPreviewing(false); }
  };

  if (loading || !carteira) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  const connectedIds = new Set(cps.map((c) => c.portal_id));
  const disponiveis = portais.filter((p) => p.ativo && !connectedIds.has(p.id));

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Rss className="h-4 w-4" />URL Universal (VRSync)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{feedUrl}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyUrl(feedUrl)}><Copy className="h-3.5 w-3.5 mr-1" />Copiar</Button>
              <Button size="sm" variant="outline" onClick={() => previewFeed()}><ExternalLink className="h-3.5 w-3.5 mr-1" />Visualizar</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Leituras 24h" value={stats?.leituras_24h ?? 0} />
            <Stat label="Leituras 7d" value={stats?.leituras_7d ?? 0} />
            <Stat label="Leituras 30d" value={stats?.leituras_30d ?? 0} />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{items.length} imóvel(is)</span>
            <span>Status: <Badge variant={carteira.status === "ativa" ? "default" : "secondary"} className="ml-1">{carteira.status}</Badge></span>
            <span>Visibilidade: <Badge variant="outline" className="ml-1">{carteira.visibilidade}</Badge></span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="imoveis" className="mt-4">
        <TabsList>
          <TabsTrigger value="imoveis">Imóveis ({items.length})</TabsTrigger>
          <TabsTrigger value="portais"><Rss className="h-3.5 w-3.5 mr-1" />Portais ({cps.length})</TabsTrigger>
          <TabsTrigger value="compartilhamento"><Users2 className="h-3.5 w-3.5 mr-1" />Compartilhamento ({shares.length})</TabsTrigger>
          <TabsTrigger value="regras"><Settings2 className="h-3.5 w-3.5 mr-1" />Regras</TabsTrigger>
          <TabsTrigger value="logs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Histórico ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="imoveis">
          {items.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum imóvel nesta carteira.
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Título</TableHead><TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Preço</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
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

        <TabsContent value="portais" className="space-y-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Portais conectados</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum portal conectado ainda.</p>
              ) : cps.map((cp) => (
                <div key={cp.id} className="flex items-center gap-3 p-3 rounded border">
                  <div className="h-9 w-9 rounded grid place-items-center text-white shrink-0"
                       style={{ background: cp.portais?.cor ?? "#64748b" }}>
                    <Rss className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {cp.portais?.nome}
                      <Badge variant={cp.status_sincronizacao === "ok" ? "default" : cp.status_sincronizacao === "erro" ? "destructive" : "secondary"}>
                        {cp.status_sincronizacao}
                      </Badge>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono truncate block">
                      {portalUrl(cp.portais?.slug)}
                    </code>
                    <div className="text-[11px] text-muted-foreground">
                      {cp.total_leituras ?? 0} leitura(s) · última: {cp.ultima_leitura ? new Date(cp.ultima_leitura).toLocaleString("pt-BR") : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={!!cp.ativo} onCheckedChange={async (v) => {
                      await fnTogglePortal({ data: { id: cp.id, ativo: v } });
                      reload();
                    }} />
                    <Button size="sm" variant="outline" onClick={() => copyUrl(portalUrl(cp.portais?.slug))}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => previewFeed(portalUrl(cp.portais?.slug))}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm(`Desconectar ${cp.portais?.nome}?`)) return;
                      await fnDesconectar({ data: { carteira_id: id, portal_id: cp.portal_id } });
                      toast.success("Desconectado"); reload();
                    }}><Power className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {disponiveis.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Adicionar portal</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {disponiveis.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded border hover:bg-accent transition">
                    <div className="h-9 w-9 rounded grid place-items-center text-white shrink-0"
                         style={{ background: p.cor ?? "#64748b" }}><Rss className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{p.nome}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">{p.descricao}</div>
                    </div>
                    <Button size="sm" onClick={async () => {
                      await fnConectar({ data: { carteira_id: id, portal_id: p.id } });
                      toast.success(`${p.nome} conectado`); reload();
                    }}><Plus className="h-3.5 w-3.5 mr-1" />Conectar</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compartilhamento" className="space-y-3">
          <CompartilhamentoBlock
            carteiraId={id}
            shares={shares}
            onShare={async (email, permissao) => {
              try {
                await fnShare({ data: { carteira_id: id, email, permissao } });
                toast.success("Compartilhado");
                reload();
              } catch (e: any) { toast.error(e?.message ?? "Erro"); }
            }}
            onUnshare={async (shareId) => {
              await fnUnshare({ data: { id: shareId } });
              toast.success("Removido"); reload();
            }}
          />
        </TabsContent>

        <TabsContent value="regras">
          <RegrasBlock
            carteira={carteira}
            onSave={async (updates) => {
              await fnUpdateRegras({ data: { id, ...updates } });
              toast.success("Regras atualizadas");
              reload();
            }}
          />
        </TabsContent>

        <TabsContent value="logs">
          {logs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum evento.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Detalhes</TableHead><TableHead>IP</TableHead>
                </TableRow></TableHeader>
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
          setPickerOpen(false); reload();
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Preview do Feed XML</DialogTitle></DialogHeader>
          {previewing ? (
            <p className="text-sm text-muted-foreground py-8 text-center"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Gerando...</p>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function CompartilhamentoBlock({
  carteiraId, shares, onShare, onUnshare,
}: {
  carteiraId: string;
  shares: any[];
  onShare: (email: string, permissao: "leitura" | "edicao") => Promise<void>;
  onUnshare: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [permissao, setPermissao] = useState<"leitura" | "edicao">("leitura");
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Compartilhar com outros usuários</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
          <Select value={permissao} onValueChange={(v: any) => setPermissao(v)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="leitura">Leitura</SelectItem>
              <SelectItem value="edicao">Edição</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={saving || !email.includes("@")} onClick={async () => {
            setSaving(true); try { await onShare(email.trim(), permissao); setEmail(""); } finally { setSaving(false); }
          }}><Plus className="h-4 w-4 mr-1" />Compartilhar</Button>
        </div>

        {shares.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carteira ainda não foi compartilhada.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>E-mail</TableHead><TableHead>Permissão</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {shares.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.profiles?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.email ?? "—"}</TableCell>
                  <TableCell><Badge variant={s.permissao === "edicao" ? "default" : "secondary"}>{s.permissao}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => onUnshare(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RegrasBlock({
  carteira, onSave,
}: { carteira: any; onSave: (u: any) => Promise<void> }) {
  const regras = carteira.regra_filtros ?? {};
  const [form, setForm] = useState({
    visibilidade: carteira.visibilidade ?? "privada",
    limite_imoveis: carteira.limite_imoveis ?? "",
    marca_dagua: !!carteira.marca_dagua,
    cidades: (regras.cidades ?? []).join(", "),
    tipos: (regras.tipos ?? []).join(", "),
    preco_min: regras.preco_min ?? "",
    preco_max: regras.preco_max ?? "",
    dormitorios_min: regras.dormitorios_min ?? "",
    somente_disponiveis: !!regras.somente_disponiveis,
  });

  const save = () => onSave({
    visibilidade: form.visibilidade,
    limite_imoveis: form.limite_imoveis === "" ? null : Number(form.limite_imoveis),
    marca_dagua: form.marca_dagua,
    regra_filtros: {
      cidades: form.cidades.split(",").map((s: string) => s.trim()).filter(Boolean),
      tipos: form.tipos.split(",").map((s: string) => s.trim()).filter(Boolean),
      preco_min: form.preco_min === "" ? undefined : Number(form.preco_min),
      preco_max: form.preco_max === "" ? undefined : Number(form.preco_max),
      dormitorios_min: form.dormitorios_min === "" ? undefined : Number(form.dormitorios_min),
      somente_disponiveis: form.somente_disponiveis,
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Regras e configurações</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Visibilidade</Label>
            <Select value={form.visibilidade} onValueChange={(v) => setForm({ ...form, visibilidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="privada">Privada</SelectItem>
                <SelectItem value="compartilhada">Compartilhada</SelectItem>
                <SelectItem value="publica">Pública</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Limite de imóveis no feed</Label>
            <Input type="number" placeholder="Sem limite" value={form.limite_imoveis}
                   onChange={(e) => setForm({ ...form, limite_imoveis: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <Switch checked={form.marca_dagua} onCheckedChange={(v) => setForm({ ...form, marca_dagua: v })} />
            <Label>Aplicar marca d'água nas fotos</Label>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Filtros automáticos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cidades (separadas por vírgula)</Label>
              <Input placeholder="São Paulo, Campinas" value={form.cidades}
                     onChange={(e) => setForm({ ...form, cidades: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipos (apartamento, casa, ...)</Label>
              <Input placeholder="apartamento, cobertura" value={form.tipos}
                     onChange={(e) => setForm({ ...form, tipos: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço mínimo (R$)</Label>
              <Input type="number" value={form.preco_min}
                     onChange={(e) => setForm({ ...form, preco_min: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço máximo (R$)</Label>
              <Input type="number" value={form.preco_max}
                     onChange={(e) => setForm({ ...form, preco_max: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Dormitórios mínimos</Label>
              <Input type="number" value={form.dormitorios_min}
                     onChange={(e) => setForm({ ...form, dormitorios_min: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={form.somente_disponiveis}
                      onCheckedChange={(v) => setForm({ ...form, somente_disponiveis: v })} />
              <Label>Somente imóveis "disponíveis"</Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save}>Salvar regras</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ImovelPicker({
  open, onClose, existingIds, onAdd,
}: { open: boolean; onClose: () => void; existingIds: Set<string>; onAdd: (ids: string[]) => void }) {
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
      let q = supabase.from("imoveis")
        .select("id, codigo_interno, titulo, cidade, bairro, preco, status, tipo")
        .eq("arquivado", false).order("created_at", { ascending: false }).limit(50);
      if (busca.trim()) q = q.or(`titulo.ilike.%${busca}%,codigo_interno.ilike.%${busca}%,cidade.ilike.%${busca}%`);
      const { data } = await q;
      if (cancel) return;
      setImoveis(data ?? []); setLoading(false);
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
        <DialogHeader><DialogTitle>Adicionar imóveis</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="max-h-[50vh] overflow-auto border rounded">
          {loading ? <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
            : imoveis.length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">Nenhum imóvel.</p>
            : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"></TableHead><TableHead>Código</TableHead><TableHead>Título</TableHead>
                  <TableHead>Cidade</TableHead><TableHead className="text-right">Preço</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {imoveis.map((im) => {
                    const already = existingIds.has(im.id);
                    return (
                      <TableRow key={im.id} className={already ? "opacity-50" : ""}>
                        <TableCell><Checkbox checked={selected.has(im.id)} disabled={already} onCheckedChange={() => toggle(im.id)} /></TableCell>
                        <TableCell className="font-mono text-xs">{im.codigo_interno ?? "—"}</TableCell>
                        <TableCell className="max-w-xs truncate">{im.titulo ?? "—"} {already && <span className="text-[10px] text-muted-foreground">(já)</span>}</TableCell>
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
