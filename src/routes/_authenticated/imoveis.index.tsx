import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Pencil, Copy, Archive, Trash2, LayoutGrid, List as ListIcon, Map as MapIcon,
  Home, Heart, MapPin, Bed, Bath, Car, Ruler, Star, Waves, Palette, ShieldCheck, Repeat as RepeatIcon,
  SlidersHorizontal, X, Eye, CheckCircle2, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { canWriteImovel } from "@/lib/permissions";
import { logAudit, logImovel } from "@/lib/audit";
import { useFavoritos } from "@/hooks/use-favoritos";
import { ImoveisMap } from "@/components/imoveis/ImoveisMap";

export const Route = createFileRoute("/_authenticated/imoveis/")({
  head: () => ({ meta: [{ title: "Imóveis — MV Broker" }] }),
  component: ImoveisDashboard,
});

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido", alugado: "Alugado", suspenso: "Suspenso",
};
const STATUS_COLOR: Record<string, string> = {
  disponivel: "bg-emerald-500 text-white",
  reservado: "bg-amber-500 text-white",
  vendido: "bg-rose-500 text-white",
  alugado: "bg-blue-500 text-white",
  suspenso: "bg-slate-500 text-white",
};

type Categoria = {
  key: string;
  label: string;
  test: (i: any) => boolean;
};
const CATEGORIAS: Categoria[] = [
  { key: "todos", label: "Todos", test: () => true },
  { key: "apartamento", label: "Apartamentos", test: (i) => /apart/i.test(i.tipo_imovel ?? "") },
  { key: "casa", label: "Casas", test: (i) => /casa/i.test(i.tipo_imovel ?? "") },
  { key: "terreno", label: "Terrenos", test: (i) => /terreno/i.test(i.tipo_imovel ?? "") },
  { key: "lote", label: "Lotes", test: (i) => /lote/i.test(i.tipo_imovel ?? "") },
  { key: "condominio", label: "Condomínios", test: (i) => !!i.condominio_id },
  { key: "decorado", label: "Decorados", test: (i) => !!i.decorado },
  { key: "vista_mar", label: "Vista Mar", test: (i) => !!i.vista_mar },
  { key: "permuta", label: "Permuta", test: (i) => !!i.aceita_permuta },
  { key: "vendidos", label: "Vendidos", test: (i) => i.status_imovel === "vendido" },
];

const ORDER_KEY = "mv-category-order";
const VIEW_KEY = "mv-imoveis-view";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return CATEGORIAS.map((c) => c.key);
    const parsed = JSON.parse(raw) as string[];
    const known = CATEGORIAS.map((c) => c.key);
    const merged = [...parsed.filter((k) => known.includes(k))];
    for (const k of known) if (!merged.includes(k)) merged.push(k);
    return merged;
  } catch { return CATEGORIAS.map((c) => c.key); }
}

const fmtBRL = (n: number | null | undefined) =>
  n == null ? "Sob consulta" : `R$ ${Number(n).toLocaleString("pt-BR")}`;

function ImoveisDashboard() {
  const navigate = useNavigate();
  const { roles } = useRoles();
  const canWrite = canWriteImovel(roles);
  const { has: isFav, toggle: toggleFav } = useFavoritos();

  const [items, setItems] = useState<any[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"grid" | "lista" | "mapa">(() => {
    try { return (localStorage.getItem(VIEW_KEY) as any) || "grid"; } catch { return "grid"; }
  });
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ } }, [view]);

  const [catOrder, setCatOrder] = useState<string[]>(loadOrder);
  const [catActive, setCatActive] = useState<string>("todos");

  // filtros
  const [search, setSearch] = useState("");
  const [advOpen, setAdvOpen] = useState(false);
  const [fStatus, setFStatus] = useState<string>("");
  const [fTipo, setFTipo] = useState<string>("");
  const [fCidade, setFCidade] = useState<string>("");
  const [fBairro, setFBairro] = useState<string>("");
  const [fEmpreendId, setFEmpreendId] = useState<string>("");
  const [fMin, setFMin] = useState<string>("");
  const [fMax, setFMax] = useState<string>("");
  const [fAreaMin, setFAreaMin] = useState<string>("");
  const [fAreaMax, setFAreaMax] = useState<string>("");
  const [fDorm, setFDorm] = useState<number | null>(null);
  const [fBanh, setFBanh] = useState<number | null>(null);
  const [fVagas, setFVagas] = useState<number | null>(null);
  const [fVistaMar, setFVistaMar] = useState(false);
  const [fDecorado, setFDecorado] = useState(false);
  const [fPermuta, setFPermuta] = useState(false);
  const [fExclus, setFExclus] = useState(false);
  const [fDestaque, setFDestaque] = useState(false);
  const [ordem, setOrdem] = useState<"recentes" | "preco_asc" | "preco_desc" | "area_asc" | "area_desc">("recentes");

  const [mapaSelecionado, setMapaSelecionado] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imoveis")
      .select(IMOVEL_PUBLIC_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = data ?? [];
    setItems(list);

    // capas
    const ids = list.map((i: any) => i.id);
    if (ids.length) {
      const { data: imgs } = await supabase
        .from("imovel_imagens")
        .select("imovel_id, url, ordem, capa")
        .in("imovel_id", ids)
        .order("ordem", { ascending: true });
      const map: Record<string, string> = {};
      (imgs ?? []).forEach((g: any) => {
        if (!map[g.imovel_id]) map[g.imovel_id] = g.url;
        if (g.capa) map[g.imovel_id] = g.url;
      });
      setCovers(map);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const cidadesUnicas = useMemo(() => [...new Set(items.map((i) => i.cidade).filter(Boolean))], [items]);
  const bairrosUnicos = useMemo(() => [...new Set(items.map((i) => i.bairro).filter(Boolean))], [items]);
  const tiposUnicos = useMemo(() => [...new Set(items.map((i) => i.tipo_imovel).filter(Boolean))], [items]);
  const empreendUnicos = useMemo(() => [...new Set(items.map((i) => i.empreendimento_id).filter(Boolean))], [items]);

  const filtered = useMemo(() => {
    const cat = CATEGORIAS.find((c) => c.key === catActive);
    let arr = items.filter((i) => !i.arquivado);
    if (cat) arr = arr.filter((i) => cat.test(i));
    if (fStatus) arr = arr.filter((i) => i.status_imovel === fStatus);
    if (fTipo) arr = arr.filter((i) => i.tipo_imovel === fTipo);
    if (fCidade) arr = arr.filter((i) => i.cidade === fCidade);
    if (fBairro) arr = arr.filter((i) => i.bairro === fBairro);
    if (fEmpreendId) arr = arr.filter((i) => i.empreendimento_id === fEmpreendId);
    if (fMin) arr = arr.filter((i) => Number(i.preco ?? 0) >= Number(fMin));
    if (fMax) arr = arr.filter((i) => Number(i.preco ?? 0) <= Number(fMax));
    if (fAreaMin) arr = arr.filter((i) => Number(i.area_privativa ?? i.area_total ?? 0) >= Number(fAreaMin));
    if (fAreaMax) arr = arr.filter((i) => Number(i.area_privativa ?? i.area_total ?? 0) <= Number(fAreaMax));
    if (fDorm) arr = arr.filter((i) => Number(i.dormitorios ?? 0) >= fDorm);
    if (fBanh) arr = arr.filter((i) => Number(i.banheiros ?? 0) >= fBanh);
    if (fVagas) arr = arr.filter((i) => Number(i.vagas ?? 0) >= fVagas);
    if (fVistaMar) arr = arr.filter((i) => !!i.vista_mar);
    if (fDecorado) arr = arr.filter((i) => !!i.decorado);
    if (fPermuta) arr = arr.filter((i) => !!i.aceita_permuta);
    if (fExclus) arr = arr.filter((i) => !!i.exclusividade || !!i.exclusivo);
    if (fDestaque) arr = arr.filter((i) => !!i.destaque_home);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((i) => [i.codigo_interno, i.titulo, i.logradouro, i.bairro, i.cidade, i.responsavel_captacao]
        .filter(Boolean).join(" ").toLowerCase().includes(s));
    }
    arr = [...arr].sort((a, b) => {
      switch (ordem) {
        case "preco_asc": return Number(a.preco ?? 0) - Number(b.preco ?? 0);
        case "preco_desc": return Number(b.preco ?? 0) - Number(a.preco ?? 0);
        case "area_asc": return Number(a.area_privativa ?? 0) - Number(b.area_privativa ?? 0);
        case "area_desc": return Number(b.area_privativa ?? 0) - Number(a.area_privativa ?? 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return arr;
  }, [items, catActive, fStatus, fTipo, fCidade, fBairro, fEmpreendId, fMin, fMax, fAreaMin, fAreaMax,
      fDorm, fBanh, fVagas, fVistaMar, fDecorado, fPermuta, fExclus, fDestaque, search, ordem]);

  const kpis = useMemo(() => {
    const ativos = items.filter((i) => !i.arquivado);
    const vgv = ativos.filter((i) => i.status_imovel === "disponivel").reduce((s, i) => s + Number(i.preco ?? 0), 0);
    const ticket = ativos.length ? vgv / Math.max(1, ativos.filter((i) => i.preco).length) : 0;
    return {
      total: ativos.length,
      disponivel: ativos.filter((i) => i.status_imovel === "disponivel").length,
      reservado: ativos.filter((i) => i.status_imovel === "reservado").length,
      vendido: ativos.filter((i) => i.status_imovel === "vendido").length,
      vgv, ticket,
    };
  }, [items]);

  function limparFiltros() {
    setFStatus(""); setFTipo(""); setFCidade(""); setFBairro(""); setFEmpreendId("");
    setFMin(""); setFMax(""); setFAreaMin(""); setFAreaMax("");
    setFDorm(null); setFBanh(null); setFVagas(null);
    setFVistaMar(false); setFDecorado(false); setFPermuta(false); setFExclus(false); setFDestaque(false);
    setOrdem("recentes"); setSearch(""); setCatActive("todos");
  }

  function moveChip(key: string, dir: -1 | 1) {
    const i = catOrder.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= catOrder.length) return;
    const arr = [...catOrder];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setCatOrder(arr);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  }

  async function arquivar(it: any) {
    if (!canWrite) return;
    const novo = !it.arquivado;
    const { error } = await supabase.from("imoveis").update({ arquivado: novo } as never).eq("id", it.id);
    if (error) return toast.error(error.message);
    await logAudit("imovel_arquivado", `${novo ? "Arquivado" : "Restaurado"}: ${it.codigo_interno}`);
    await logImovel(it.id, novo ? "arquivado" : "restaurado");
    toast.success(novo ? "Arquivado" : "Restaurado");
    load();
  }
  async function excluir(it: any) {
    if (!canWrite) return;
    if (!confirm(`Excluir ${it.codigo_interno}? Esta ação é permanente.`)) return;
    const { error } = await supabase.from("imoveis").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    await logAudit("imovel_excluido", `${it.codigo_interno} - ${it.titulo}`);
    toast.success("Excluído");
    load();
  }
  async function marcarVendido(it: any) {
    if (!canWrite) return;
    const valor = prompt("Valor de venda (R$):", String(it.preco ?? ""));
    if (valor === null) return;
    const { error } = await supabase.from("imoveis")
      .update({ status_imovel: "vendido", preco: Number(valor) || it.preco } as never)
      .eq("id", it.id);
    if (error) return toast.error(error.message);
    await logImovel(it.id, "vendido", `Valor: R$ ${valor}`);
    toast.success("Marcado como vendido");
    load();
  }
  async function duplicar(it: any) {
    if (!canWrite) return;
    const { id, codigo_interno, created_at, updated_at, created_by, ...rest } = it;
    const copy = { ...rest, titulo: `${it.titulo} (cópia)`, status_imovel: "disponivel" };
    const { data: u } = await supabase.auth.getUser();
    (copy as any).created_by = u.user?.id ?? null;
    const { data, error } = await supabase.from("imoveis").insert(copy as never).select().single();
    if (error) return toast.error(error.message);
    await logImovel(data.id, "duplicado", `Cópia de ${codigo_interno}`);
    toast.success(`Duplicado — ${data.codigo_interno}`);
    load();
  }

  const orderedCats = useMemo(() => catOrder.map((k) => CATEGORIAS.find((c) => c.key === k)!).filter(Boolean), [catOrder]);

  return (
    <>
      <PageHeader
        title={`Imóveis · ${kpis.total}`}
        description="Catálogo completo com cards, lista e mapa."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/importacoes/imoveis" })}>
              <Upload className="h-4 w-4 mr-1.5" /> Importar
            </Button>
            {canWrite && (
              <Button onClick={() => navigate({ to: "/imoveis/novo" })}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo Imóvel
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Disponíveis", value: kpis.disponivel, color: "text-emerald-600" },
          { label: "Reservados", value: kpis.reservado, color: "text-amber-600" },
          { label: "Vendidos", value: kpis.vendido, color: "text-rose-600" },
          { label: "VGV", value: fmtBRL(kpis.vgv), color: "text-blue-600", small: true },
          { label: "Ticket médio", value: fmtBRL(Math.round(kpis.ticket)), color: "text-purple-600", small: true },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 font-bold ${k.color} ${k.small ? "text-sm" : "text-2xl"}`}>{k.value as any}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Busca + filtros + view modes */}
      <Card className="mb-4">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Código, título, endereço, bairro, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={ordem} onValueChange={(v: any) => setOrdem(v)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="preco_asc">Preço ↑</SelectItem>
                <SelectItem value="preco_desc">Preço ↓</SelectItem>
                <SelectItem value="area_asc">Área ↑</SelectItem>
                <SelectItem value="area_desc">Área ↓</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setAdvOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filtros
            </Button>
            <Button variant="ghost" size="icon" onClick={limparFiltros} title="Limpar filtros"><X className="h-4 w-4" /></Button>
            <div className="ml-auto flex rounded-md border bg-background">
              <Button size="sm" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")} title="Cards"><LayoutGrid className="h-4 w-4" /></Button>
              <Button size="sm" variant={view === "lista" ? "default" : "ghost"} onClick={() => setView("lista")} title="Lista"><ListIcon className="h-4 w-4" /></Button>
              <Button size="sm" variant={view === "mapa" ? "default" : "ghost"} onClick={() => setView("mapa")} title="Mapa"><MapIcon className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Chips de categorias */}
          <div className="flex flex-wrap gap-1.5">
            {orderedCats.map((c) => {
              const active = catActive === c.key;
              return (
                <div key={c.key} className="group flex items-center">
                  <button
                    onClick={() => setCatActive(c.key)}
                    className={`px-3 h-8 rounded-full text-xs font-medium border transition ${active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"}`}
                  >
                    {c.label}
                  </button>
                  <div className="hidden group-hover:flex ml-0.5">
                    <button className="text-[10px] px-1 text-muted-foreground hover:text-foreground" onClick={() => moveChip(c.key, -1)} title="Mover ←">‹</button>
                    <button className="text-[10px] px-1 text-muted-foreground hover:text-foreground" onClick={() => moveChip(c.key, 1)} title="Mover →">›</button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mb-2">{filtered.length} imóvel(is)</p>

      {/* Conteúdo */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Home className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((i) => (
            <ImovelCard
              key={i.id}
              imovel={i}
              cover={covers[i.id]}
              fav={isFav(i.id)}
              onFav={() => toggleFav(i.id)}
              onEdit={() => navigate({ to: "/imoveis/$id/editar", params: { id: i.id } })}
              onDuplicate={() => duplicar(i)}
              onArchive={() => arquivar(i)}
              onDelete={() => excluir(i)}
              onSold={() => marcarVendido(i)}
              canWrite={canWrite}
            />
          ))}
        </div>
      ) : view === "lista" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cidade/Bairro</TableHead>
                  <TableHead className="text-center">D/B/V</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="h-10 w-14 rounded bg-muted overflow-hidden">
                        {covers[i.id] && <img src={covers[i.id]} alt="" className="h-full w-full object-cover" />}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{i.codigo_interno}</TableCell>
                    <TableCell className="font-medium">
                      <Link to="/imoveis/$id/editar" params={{ id: i.id }} className="hover:underline">{i.titulo}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{i.tipo_imovel ?? "—"}</TableCell>
                    <TableCell className="text-sm">{[i.bairro, i.cidade].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {i.dormitorios ?? 0}/{i.banheiros ?? 0}/{i.vagas ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">{i.area_privativa ? `${i.area_privativa} m²` : "—"}</TableCell>
                    <TableCell className="font-semibold">{fmtBRL(i.preco)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 text-[11px] rounded-full ${STATUS_COLOR[i.status_imovel] ?? "bg-muted"}`}>
                        {STATUS_LABEL[i.status_imovel] ?? i.status_imovel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon" variant="ghost" onClick={() => toggleFav(i.id)} title="Favoritar">
                          <Heart className={`h-4 w-4 ${isFav(i.id) ? "fill-rose-500 text-rose-500" : ""}`} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/imoveis/$id/editar", params: { id: i.id } })}><Pencil className="h-4 w-4" /></Button>
                        {canWrite && <Button size="icon" variant="ghost" onClick={() => duplicar(i)} title="Duplicar"><Copy className="h-4 w-4" /></Button>}
                        {canWrite && <Button size="icon" variant="ghost" onClick={() => arquivar(i)} title={i.arquivado ? "Restaurar" : "Arquivar"}><Archive className="h-4 w-4" /></Button>}
                        {canWrite && <Button size="icon" variant="ghost" onClick={() => excluir(i)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        // Mapa + sidebar
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <ImoveisMap
            items={filtered.map((i) => ({
              id: i.id, titulo: i.titulo, preco: i.preco,
              bairro: i.bairro, cidade: i.cidade,
              latitude: i.latitude, longitude: i.longitude,
              foto_capa_url: covers[i.id] ?? null,
            }))}
            onSelect={(id) => { setMapaSelecionado(id); navigate({ to: "/imoveis/$id/editar", params: { id } }); }}
          />
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((i) => (
              <button
                key={i.id}
                onClick={() => setMapaSelecionado(i.id)}
                className={`w-full text-left flex gap-3 rounded-md border bg-card p-2 hover:bg-accent/40 transition ${mapaSelecionado === i.id ? "ring-2 ring-primary" : ""}`}
              >
                <div className="h-14 w-20 rounded bg-muted overflow-hidden flex-shrink-0">
                  {covers[i.id] && <img src={covers[i.id]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono text-muted-foreground">{i.codigo_interno}</p>
                    <span className={`px-1.5 py-px text-[10px] rounded-full ${STATUS_COLOR[i.status_imovel] ?? "bg-muted"}`}>
                      {STATUS_LABEL[i.status_imovel] ?? i.status_imovel}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{i.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{[i.bairro, i.cidade].filter(Boolean).join(" / ")}</p>
                  <p className="text-sm font-semibold mt-0.5">{fmtBRL(i.preco)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Painel filtros avançados */}
      <Sheet open={advOpen} onOpenChange={setAdvOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Filtros avançados</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-2">
              <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={[
                { v: "disponivel", l: "Disponível" }, { v: "reservado", l: "Reservado" },
                { v: "vendido", l: "Vendido" }, { v: "alugado", l: "Alugado" }, { v: "suspenso", l: "Suspenso" },
              ]} />
              <FilterSelect label="Tipo" value={fTipo} onChange={setFTipo} options={tiposUnicos.map((t) => ({ v: t, l: t }))} />
              <FilterSelect label="Cidade" value={fCidade} onChange={setFCidade} options={cidadesUnicas.map((c) => ({ v: c, l: c }))} />
              <FilterSelect label="Bairro" value={fBairro} onChange={setFBairro} options={bairrosUnicos.map((b) => ({ v: b, l: b }))} />
              <FilterSelect label="Empreendimento" value={fEmpreendId} onChange={setFEmpreendId} options={empreendUnicos.map((e) => ({ v: e, l: e }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Faixa de preço (R$)</Label>
              <div className="flex gap-2">
                <Input placeholder="Mín" value={fMin} onChange={(e) => setFMin(e.target.value)} />
                <Input placeholder="Máx" value={fMax} onChange={(e) => setFMax(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Área (m²)</Label>
              <div className="flex gap-2">
                <Input placeholder="Mín" value={fAreaMin} onChange={(e) => setFAreaMin(e.target.value)} />
                <Input placeholder="Máx" value={fAreaMax} onChange={(e) => setFAreaMax(e.target.value)} />
              </div>
            </div>

            <CountFilter label="Dormitórios" value={fDorm} setValue={setFDorm} />
            <CountFilter label="Banheiros" value={fBanh} setValue={setFBanh} />
            <CountFilter label="Vagas" value={fVagas} setValue={setFVagas} />

            <div className="space-y-2 pt-2 border-t">
              <SwitchRow label="Vista mar" checked={fVistaMar} onChange={setFVistaMar} />
              <SwitchRow label="Decorado" checked={fDecorado} onChange={setFDecorado} />
              <SwitchRow label="Aceita permuta" checked={fPermuta} onChange={setFPermuta} />
              <SwitchRow label="Exclusividade" checked={fExclus} onChange={setFExclus} />
              <SwitchRow label="Destaque" checked={fDestaque} onChange={setFDestaque} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={limparFiltros} className="flex-1">Limpar</Button>
              <Button onClick={() => setAdvOpen(false)} className="flex-1">Aplicar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ImovelCard({
  imovel: i, cover, fav, onFav, onEdit, onDuplicate, onArchive, onDelete, onSold, canWrite,
}: {
  imovel: any; cover?: string; fav: boolean;
  onFav: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void; onSold: () => void;
  canWrite: boolean;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative aspect-[4/3] bg-muted">
        {cover ? (
          <img src={cover} alt={i.titulo} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Home className="h-10 w-10" />
          </div>
        )}
        {/* badges sobrepostos */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${STATUS_COLOR[i.status_imovel] ?? "bg-muted"}`}>
            {STATUS_LABEL[i.status_imovel] ?? i.status_imovel}
          </span>
          {i.destaque_home && <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-500 text-white flex items-center gap-0.5"><Star className="h-2.5 w-2.5" /> Destaque</span>}
          {i.vista_mar && <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-500 text-white flex items-center gap-0.5"><Waves className="h-2.5 w-2.5" /></span>}
          {i.decorado && <span className="px-1.5 py-0.5 text-[10px] rounded bg-pink-500 text-white flex items-center gap-0.5"><Palette className="h-2.5 w-2.5" /></span>}
          {(i.exclusividade || i.exclusivo) && <span className="px-1.5 py-0.5 text-[10px] rounded bg-violet-600 text-white flex items-center gap-0.5"><ShieldCheck className="h-2.5 w-2.5" /></span>}
          {i.aceita_permuta && <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-500 text-white flex items-center gap-0.5"><RepeatIcon className="h-2.5 w-2.5" /></span>}
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-black/60 text-white">{i.codigo_interno}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFav(); }}
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:scale-110 transition"
          title="Favoritar"
        >
          <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
      </div>

      <CardContent className="p-3 space-y-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{i.tipo_imovel ?? "Imóvel"}</p>
          </div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 mt-0.5">{i.titulo}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {[i.bairro, i.cidade].filter(Boolean).join(", ") || "—"}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground border-y py-2">
          {i.dormitorios != null && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{i.dormitorios}</span>}
          {i.banheiros != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{i.banheiros}</span>}
          {i.vagas != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{i.vagas}</span>}
          {(i.area_privativa || i.area_total) && (
            <span className="flex items-center gap-1 ml-auto"><Ruler className="h-3.5 w-3.5" />{i.area_privativa ?? i.area_total} m²</span>
          )}
        </div>

        <div>
          <p className="text-lg font-bold">{fmtBRL(i.preco)}</p>
          {i.preco_parcelado && <p className="text-[11px] text-muted-foreground">ou {i.preco_parcelado}</p>}
          {i.bonus && <p className="text-[11px] text-emerald-600 font-medium">Bônus: {i.bonus}</p>}
        </div>

        <div className="flex items-center gap-1 pt-1 border-t">
          <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs" onClick={onEdit}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
          </Button>
          {canWrite && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDuplicate} title="Duplicar"><Copy className="h-3.5 w-3.5" /></Button>
              {i.status_imovel !== "vendido" && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={onSold} title="Marcar vendido"><CheckCircle2 className="h-3.5 w-3.5" /></Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onArchive} title={i.arquivado ? "Restaurar" : "Arquivar"}><Archive className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function CountFilter({ label, value, setValue }: { label: string; value: number | null; setValue: (v: number | null) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} (mín)</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Button key={n} type="button" size="sm" variant={value === n ? "default" : "outline"} className="flex-1 h-8" onClick={() => setValue(value === n ? null : n)}>{n}+</Button>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-normal cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
