import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, SlidersHorizontal, LayoutGrid, List, Map as MapIcon, Bed, Bath, Car, Ruler, MapPin,
  X, Check, Eye, ShoppingBag, Star, Pencil, Heart, Save, BookmarkCheck, Trash2, ChevronDown,
  Archive, Radio, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { useExportacao } from "@/hooks/use-exportacao";
import { usePodeExportar } from "@/hooks/use-pode-exportar";
import { useFavoritos } from "@/hooks/use-favoritos";
import { useBuscasSalvas } from "@/hooks/use-buscas-salvas";
import { useRoles } from "@/hooks/use-roles";
import { canWriteImovel } from "@/lib/permissions";
import { ImovelDrawer } from "@/components/imoveis/ImovelDrawer";
import { ImoveisMap } from "@/components/imoveis/ImoveisMap";
import { logAudit, logImovel } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/imoveis/")({
  head: () => ({ meta: [{ title: "Imóveis — MV Broker" }] }),
  component: ImoveisLista,
});

type Filters = {
  codigo: string; titulo: string; tipo: string; status: string; cidade: string; bairro: string;
  precoMin: number; precoMax: number;
  dormitorios: string; banheiros: string; vagas: string;
  vistaMar: boolean; decorado: boolean; aceitaPermuta: boolean;
  ativoSite: boolean; publicarXml: boolean; destaqueHome: boolean;
  somenteFavoritos: boolean;
};

const EMPTY: Filters = {
  codigo: "", titulo: "", tipo: "", status: "", cidade: "", bairro: "",
  precoMin: 0, precoMax: 0,
  dormitorios: "", banheiros: "", vagas: "",
  vistaMar: false, decorado: false, aceitaPermuta: false,
  ativoSite: false, publicarXml: false, destaqueHome: false,
  somenteFavoritos: false,
};

const PAGE_SIZE = 24;

function ImoveisLista() {
  const { roles } = useRoles();
  const canWrite = canWriteImovel(roles);
  const exp = useExportacao();
  const { podeExportar } = usePodeExportar();
  const fav = useFavoritos();
  const buscas = useBuscasSalvas();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"cards" | "tabela" | "mapa">("cards");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("imoveis").select(IMOVEL_PUBLIC_COLUMNS).eq("arquivado", false).order("updated_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filters.somenteFavoritos && !fav.has(i.id)) return false;
      if (debounced) {
        const s = debounced.toLowerCase();
        const hay = [i.codigo_interno, i.titulo, i.cidade, i.bairro].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (filters.codigo && !(i.codigo_interno ?? "").toLowerCase().includes(filters.codigo.toLowerCase())) return false;
      if (filters.titulo && !(i.titulo ?? "").toLowerCase().includes(filters.titulo.toLowerCase())) return false;
      if (filters.tipo && i.tipo_imovel !== filters.tipo) return false;
      if (filters.status && i.status_imovel !== filters.status) return false;
      if (filters.cidade && !(i.cidade ?? "").toLowerCase().includes(filters.cidade.toLowerCase())) return false;
      if (filters.bairro && !(i.bairro ?? "").toLowerCase().includes(filters.bairro.toLowerCase())) return false;
      if (filters.precoMin && Number(i.preco ?? 0) < filters.precoMin) return false;
      if (filters.precoMax && Number(i.preco ?? 0) > filters.precoMax) return false;
      if (filters.dormitorios && Number(i.dormitorios ?? 0) < Number(filters.dormitorios)) return false;
      if (filters.banheiros && Number(i.banheiros ?? 0) < Number(filters.banheiros)) return false;
      if (filters.vagas && Number(i.vagas ?? 0) < Number(filters.vagas)) return false;
      if (filters.vistaMar && !i.vista_mar) return false;
      if (filters.decorado && !i.decorado) return false;
      if (filters.aceitaPermuta && !i.aceita_permuta) return false;
      if (filters.ativoSite && !i.ativo_site) return false;
      if (filters.publicarXml && !i.publicar_xml) return false;
      if (filters.destaqueHome && !i.destaque_home) return false;
      return true;
    });
  }, [items, debounced, filters, fav]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const cidadesUnicas = useMemo(() => [...new Set(items.map((i) => i.cidade).filter(Boolean))].sort(), [items]);
  const tiposUnicos = useMemo(() => [...new Set(items.map((i) => i.tipo_imovel).filter(Boolean))].sort(), [items]);
  const activeCount = useMemo(() => Object.entries(filters).filter(([_, v]) => v !== "" && v !== 0 && v !== false).length, [filters]);

  function toggleSel(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelAllPage() {
    const allOnPage = pageItems.every((i) => selected.has(i.id));
    setSelected((p) => {
      const n = new Set(p);
      pageItems.forEach((i) => { allOnPage ? n.delete(i.id) : n.add(i.id); });
      return n;
    });
  }

  async function addSelectedToExport() {
    for (const id of selected) if (!exp.has(id)) await exp.add(id);
    toast.success(`${selected.size} adicionado(s) à exportação`);
    setSelected(new Set());
  }
  async function removeSelectedFromExport() {
    for (const id of selected) if (exp.has(id)) await exp.remove(id);
    setSelected(new Set());
  }

  async function bulkStatus(status: string) {
    const ids = Array.from(selected);
    const { error } = await supabase.from("imoveis").update({ status_imovel: status } as never).in("id", ids);
    if (error) { toast.error(error.message); return; }
    await logAudit("imovel_atualizado", `Status em massa: ${status} (${ids.length})`);
    for (const id of ids) logImovel(id, "status_alterado", status);
    toast.success("Status atualizado");
    setSelected(new Set()); load();
  }
  async function bulkXml(publicar: boolean) {
    const ids = Array.from(selected);
    const { error } = await supabase.from("imoveis").update({ publicar_xml: publicar } as never).in("id", ids);
    if (error) { toast.error(error.message); return; }
    await logAudit("imovel_xml_publicado", `XML ${publicar ? "ativado" : "desativado"} (${ids.length})`);
    toast.success(`XML ${publicar ? "ativado" : "desativado"}`);
    setSelected(new Set()); load();
  }
  async function bulkArquivar() {
    const ids = Array.from(selected);
    if (!confirm(`Arquivar ${ids.length} imóvel(is)?`)) return;
    const { error } = await supabase.from("imoveis").update({ arquivado: true } as never).in("id", ids);
    if (error) { toast.error(error.message); return; }
    await logAudit("imovel_arquivado", `Em massa (${ids.length})`);
    setSelected(new Set()); load();
  }

  function openDrawer(id: string) { setDrawerId(id); logImovel(id, "visualizado_central"); }

  async function salvarBusca() {
    if (!saveName.trim()) return;
    await buscas.save(saveName.trim(), { ...filters, search });
    await logAudit("perfil_alterado", `Busca salva: ${saveName}`);
    setSaveName(""); setSaveOpen(false);
  }
  function carregarBusca(b: any) {
    const f = { ...EMPTY, ...(b.filtros_json ?? {}) };
    setFilters(f);
    setSearch(f.search ?? "");
    toast.success(`Busca "${b.nome}" carregada`);
  }

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Busque, visualize e selecione imóveis para exportação."
        actions={
          <div className="flex gap-2">
            {canWrite && (
              <Button asChild size="sm">
                <Link to="/imoveis/novo"><Plus className="h-4 w-4 mr-1.5" />Novo imóvel</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/favoritos"><Heart className="h-4 w-4 mr-1.5" />Favoritos <Badge className="ml-2">{fav.count}</Badge></Link>
            </Button>
            {podeExportar && (
              <Button asChild variant="outline" size="sm">
                <Link to="/imoveis/exportacao"><ShoppingBag className="h-4 w-4 mr-1.5" />Exportação <Badge className="ml-2">{exp.count}</Badge></Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Top toolbar */}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Busca rápida: código, título, cidade, bairro..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline"><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filtros {activeCount > 0 && <Badge className="ml-2">{activeCount}</Badge>}</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader><SheetTitle>Filtros avançados</SheetTitle></SheetHeader>
              <FiltersPanel filters={filters} setFilters={setFilters} cidades={cidadesUnicas} tipos={tiposUnicos} onClear={() => setFilters(EMPTY)} />
            </SheetContent>
          </Sheet>

          {/* Buscas salvas */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><BookmarkCheck className="h-4 w-4 mr-1.5" />Buscas {buscas.items.length > 0 && <Badge className="ml-2">{buscas.items.length}</Badge>}<ChevronDown className="h-3 w-3 ml-1" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Minhas buscas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {buscas.items.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma busca salva.</p>}
              {buscas.items.map((b) => (
                <DropdownMenuItem key={b.id} onSelect={(e) => e.preventDefault()} className="flex justify-between gap-2">
                  <button className="flex-1 text-left truncate" onClick={() => carregarBusca(b)}>{b.nome}</button>
                  <Trash2 className="h-3.5 w-3.5 text-destructive cursor-pointer shrink-0" onClick={() => buscas.remove(b.id)} />
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start"><Save className="h-3.5 w-3.5 mr-1.5" />Salvar busca atual</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Salvar busca</DialogTitle></DialogHeader>
                  <Input placeholder="Nome da busca" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancelar</Button>
                    <Button onClick={salvarBusca} disabled={!saveName.trim()}>Salvar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </DropdownMenuContent>
          </DropdownMenu>

          {(activeCount > 0 || search) && (
            <Button variant="ghost" onClick={() => { setFilters(EMPTY); setSearch(""); }}><X className="h-4 w-4 mr-1.5" />Limpar</Button>
          )}

          <div className="flex gap-1 border rounded-md p-0.5">
            <Button size="sm" variant={view === "cards" ? "default" : "ghost"} onClick={() => setView("cards")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button size="sm" variant={view === "tabela" ? "default" : "ghost"} onClick={() => setView("tabela")}><List className="h-4 w-4" /></Button>
            <Button size="sm" variant={view === "mapa" ? "default" : "ghost"} onClick={() => setView("mapa")}><MapIcon className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <Card className="mb-4 border-primary/40">
          <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">{selected.size} selecionado(s)</p>
            <div className="flex gap-2 flex-wrap">
              {podeExportar && (
                <>
                  <Button size="sm" onClick={addSelectedToExport}><ShoppingBag className="h-4 w-4 mr-1.5" />+ Exportação</Button>
                  <Button size="sm" variant="outline" onClick={removeSelectedFromExport}>– Exportação</Button>
                </>
              )}
              {canWrite && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">Status <ChevronDown className="h-3 w-3 ml-1" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {["disponivel", "reservado", "vendido", "alugado", "suspenso"].map((s) => (
                        <DropdownMenuItem key={s} onClick={() => bulkStatus(s)}>{s}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="outline" onClick={() => bulkXml(true)}><Radio className="h-4 w-4 mr-1.5" />Ativar XML</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkXml(false)}>Desativar XML</Button>
                  <Button size="sm" variant="destructive" onClick={bulkArquivar}><Archive className="h-4 w-4 mr-1.5" />Arquivar</Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="h-4 w-4 mr-1.5" />Limpar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground mb-3">{loading ? "Carregando..." : `${filtered.length} imóvel(is) encontrado(s)`}</p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-0"><Skeleton className="aspect-video" /><div className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></CardContent></Card>
          ))}
        </div>
      ) : pageItems.length === 0 && view !== "mapa" ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Nenhum imóvel encontrado.</CardContent></Card>
      ) : view === "mapa" ? (
        <ImoveisMap items={filtered} onSelect={openDrawer} />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((i) => (
            <ImovelCard
              key={i.id} imovel={i}
              selected={selected.has(i.id)} inExport={exp.has(i.id)} isFav={fav.has(i.id)} canWrite={canWrite}
              podeExportar={podeExportar}
              onToggleSel={() => toggleSel(i.id)} onView={() => openDrawer(i.id)}
              onToggleExport={() => exp.toggle(i.id)} onToggleFav={() => fav.toggle(i.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={pageItems.length > 0 && pageItems.every((i) => selected.has(i.id))} onCheckedChange={toggleSelAllPage} /></TableHead>
                <TableHead>Código</TableHead><TableHead>Título</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Cidade/Bairro</TableHead><TableHead>Preço</TableHead>
                <TableHead>Q</TableHead><TableHead>V</TableHead><TableHead>Área</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggleSel(i.id)} /></TableCell>
                  <TableCell className="font-mono text-xs">{i.codigo_interno}</TableCell>
                  <TableCell className="font-medium">{i.titulo}</TableCell>
                  <TableCell className="text-muted-foreground">{i.tipo_imovel ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{[i.bairro, i.cidade].filter(Boolean).join(" / ") || "—"}</TableCell>
                  <TableCell>{i.preco ? `R$ ${Number(i.preco).toLocaleString("pt-BR")}` : "—"}</TableCell>
                  <TableCell>{i.dormitorios ?? "—"}</TableCell>
                  <TableCell>{i.vagas ?? "—"}</TableCell>
                  <TableCell>{i.area_privativa ? `${i.area_privativa}m²` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => fav.toggle(i.id)}>
                        <Heart className={`h-4 w-4 ${fav.has(i.id) ? "fill-destructive text-destructive" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openDrawer(i.id)}><Eye className="h-4 w-4" /></Button>
                      {podeExportar && (
                        <Button size="icon" variant={exp.has(i.id) ? "secondary" : "ghost"} onClick={() => exp.toggle(i.id)} disabled={i.exportacao_liberada === false} title={i.exportacao_liberada === false ? "Imóvel não liberado para exportação" : undefined}>
                          {exp.has(i.id) ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {view !== "mapa" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <ImovelDrawer id={drawerId} open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)} />
    </>
  );
}

function ImovelCard({ imovel, selected, inExport, isFav, canWrite, podeExportar, onToggleSel, onView, onToggleExport, onToggleFav }: any) {
  const liberado = imovel.exportacao_liberada !== false;
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative aspect-video bg-muted">
        {imovel.foto_capa_url ? (
          <img src={imovel.foto_capa_url} alt={imovel.titulo} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>
        )}
        <div className="absolute top-2 left-2"><Checkbox checked={selected} onCheckedChange={onToggleSel} className="bg-background" /></div>
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <Button size="icon" variant="secondary" className="h-7 w-7" onClick={onToggleFav}>
            <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-destructive text-destructive" : ""}`} />
          </Button>
          <Badge variant="secondary">{imovel.status_imovel}</Badge>
          {imovel.destaque_home && <Badge><Star className="h-3 w-3 mr-1" />Destaque</Badge>}
        </div>
        {(imovel.vista_mar || imovel.decorado || imovel.publicar_xml) && (
          <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap">
            {imovel.vista_mar && <Badge variant="secondary" className="text-[10px]">Vista Mar</Badge>}
            {imovel.decorado && <Badge variant="secondary" className="text-[10px]">Decorado</Badge>}
            {imovel.publicar_xml && <Badge variant="outline" className="text-[10px] bg-background/80">XML</Badge>}
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted-foreground">{imovel.codigo_interno}</p>
          <h3 className="font-semibold truncate">{imovel.titulo}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{[imovel.bairro, imovel.cidade].filter(Boolean).join(", ") || "—"}</p>
        </div>
        <p className="text-lg font-bold">{imovel.preco ? `R$ ${Number(imovel.preco).toLocaleString("pt-BR")}` : "Sob consulta"}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          {imovel.dormitorios != null && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{imovel.dormitorios}</span>}
          {imovel.banheiros != null && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{imovel.banheiros}</span>}
          {imovel.vagas != null && <span className="flex items-center gap-1"><Car className="h-3 w-3" />{imovel.vagas}</span>}
          {imovel.area_privativa != null && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{imovel.area_privativa}m²</span>}
        </div>
        <div className="flex gap-1.5 pt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onView}><Eye className="h-3.5 w-3.5 mr-1" />Visualizar</Button>
          {podeExportar && (
            <Button size="sm" variant={inExport ? "secondary" : "default"} className="flex-1" onClick={onToggleExport} disabled={!liberado} title={!liberado ? "Imóvel não liberado para exportação" : undefined}>
              {inExport ? <><Check className="h-3.5 w-3.5 mr-1" />Na lista</> : "+ Exportação"}
            </Button>
          )}
          {canWrite && (
            <Button size="icon" variant="ghost" asChild><Link to="/imoveis/$id/editar" params={{ id: imovel.id }}><Pencil className="h-3.5 w-3.5" /></Link></Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FiltersPanel({ filters, setFilters, cidades, tipos, onClear }: any) {
  function set<K extends keyof Filters>(k: K, v: Filters[K]) { setFilters((f: Filters) => ({ ...f, [k]: v })); }
  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Código</Label><Input value={filters.codigo} onChange={(e) => set("codigo", e.target.value)} /></div>
        <div><Label className="text-xs">Título</Label><Input value={filters.titulo} onChange={(e) => set("titulo", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Tipo</Label>
          <Select value={filters.tipo || "all"} onValueChange={(v) => set("tipo", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{tipos.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={filters.status || "all"} onValueChange={(v) => set("status", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {["disponivel","reservado","vendido","alugado","suspenso"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Cidade</Label>
          <Select value={filters.cidade || "all"} onValueChange={(v) => set("cidade", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{cidades.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Bairro</Label><Input value={filters.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
      </div>
      <div>
        <Label className="text-xs">Faixa de preço (R$)</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Input type="number" placeholder="Mínimo" value={filters.precoMin || ""} onChange={(e) => set("precoMin", Number(e.target.value) || 0)} />
          <Input type="number" placeholder="Máximo" value={filters.precoMax || ""} onChange={(e) => set("precoMax", Number(e.target.value) || 0)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Dorm. (mín.)</Label><Input type="number" value={filters.dormitorios} onChange={(e) => set("dormitorios", e.target.value)} /></div>
        <div><Label className="text-xs">Banh. (mín.)</Label><Input type="number" value={filters.banheiros} onChange={(e) => set("banheiros", e.target.value)} /></div>
        <div><Label className="text-xs">Vagas (mín.)</Label><Input type="number" value={filters.vagas} onChange={(e) => set("vagas", e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Características</Label>
        {([
          ["vistaMar","Vista Mar"],["decorado","Decorado"],["aceitaPermuta","Aceita Permuta"],
          ["ativoSite","Ativo no site"],["publicarXml","Publicar XML"],["destaqueHome","Destaque home"],
          ["somenteFavoritos","Somente favoritos"],
        ] as const).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <Switch checked={filters[k] as boolean} onCheckedChange={(v) => set(k, v as never)} />
          </div>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={onClear}><X className="h-4 w-4 mr-1.5" />Limpar filtros</Button>
    </div>
  );
}
