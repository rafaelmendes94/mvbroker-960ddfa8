import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Copy, Archive, Trash2, LayoutGrid, List, Home, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { canWriteImovel } from "@/lib/permissions";
import { logAudit, logImovel } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/imoveis/")({
  head: () => ({ meta: [{ title: "Imóveis — MV Broker" }] }),
  component: ImoveisList,
});

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido", alugado: "Alugado", suspenso: "Suspenso",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  disponivel: "default", reservado: "secondary", vendido: "outline", alugado: "outline", suspenso: "destructive",
};

function ImoveisList() {
  const navigate = useNavigate();
  const { roles } = useRoles();
  const canWrite = canWriteImovel(roles);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"tabela" | "cards">("tabela");
  const [statusTab, setStatusTab] = useState<string>("todos");

  // filters
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState<string>("");
  const [fCidade, setFCidade] = useState<string>("");
  const [fBairro, setFBairro] = useState<string>("");
  const [fPubXml, setFPubXml] = useState<string>("");
  const [fAtivoSite, setFAtivoSite] = useState<string>("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("imoveis").select(IMOVEL_PUBLIC_COLUMNS).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusTab !== "todos" && i.status_imovel !== statusTab) return false;
      if (i.arquivado && statusTab !== "arquivados") return false;
      if (statusTab === "arquivados" && !i.arquivado) return false;
      if (fTipo && i.tipo_imovel !== fTipo) return false;
      if (fCidade && !(i.cidade ?? "").toLowerCase().includes(fCidade.toLowerCase())) return false;
      if (fBairro && !(i.bairro ?? "").toLowerCase().includes(fBairro.toLowerCase())) return false;
      if (fPubXml === "sim" && !i.publicar_xml) return false;
      if (fPubXml === "nao" && i.publicar_xml) return false;
      if (fAtivoSite === "sim" && !i.ativo_site) return false;
      if (fAtivoSite === "nao" && i.ativo_site) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [i.codigo_interno, i.titulo, i.cidade, i.bairro, i.responsavel_nome].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, statusTab, fTipo, fCidade, fBairro, fPubXml, fAtivoSite, search]);

  // KPIs
  const kpis = useMemo(() => {
    const active = items.filter((i) => !i.arquivado);
    return {
      total: active.length,
      disponivel: active.filter((i) => i.status_imovel === "disponivel").length,
      reservado: active.filter((i) => i.status_imovel === "reservado").length,
      vendido: active.filter((i) => i.status_imovel === "vendido").length,
      suspenso: active.filter((i) => i.status_imovel === "suspenso").length,
    };
  }, [items]);

  const byTipo = useMemo(() => {
    const m = new Map<string, number>();
    items.filter((i) => !i.arquivado).forEach((i) => m.set(i.tipo_imovel ?? "—", (m.get(i.tipo_imovel ?? "—") ?? 0) + 1));
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, [items]);

  const byCidade = useMemo(() => {
    const m = new Map<string, number>();
    items.filter((i) => !i.arquivado).forEach((i) => m.set(i.cidade ?? "—", (m.get(i.cidade ?? "—") ?? 0) + 1));
    return Array.from(m, ([name, value]) => ({ name, value })).slice(0, 8);
  }, [items]);

  async function duplicar(it: any) {
    if (!canWrite) return;
    const { id, codigo_interno, created_at, updated_at, created_by, ...rest } = it;
    const copy = { ...rest, titulo: `${it.titulo} (cópia)`, status_imovel: "disponivel" };
    const { data: u } = await supabase.auth.getUser();
    (copy as any).created_by = u.user?.id ?? null;
    const { data, error } = await supabase.from("imoveis").insert(copy as never).select().single();
    if (error) { toast.error(error.message); return; }
    // copy images
    const { data: imgs } = await supabase.from("imovel_imagens").select("*").eq("imovel_id", id);
    if (imgs?.length) {
      await supabase.from("imovel_imagens").insert(imgs.map((g: any) => ({
        imovel_id: data.id, storage_path: g.storage_path, url: g.url, ordem: g.ordem, capa: g.capa, created_by: u.user?.id ?? null,
      })) as never);
    }
    await logAudit("imovel_duplicado", `Duplicado de ${codigo_interno}`);
    await logImovel(data.id, "duplicado", `Duplicado a partir de ${codigo_interno}`);
    toast.success(`Duplicado — ${data.codigo_interno}`);
    load();
  }

  async function arquivar(it: any) {
    if (!canWrite) return;
    const novo = !it.arquivado;
    const { error } = await supabase.from("imoveis").update({ arquivado: novo } as never).eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("imovel_arquivado", `${novo ? "Arquivado" : "Restaurado"}: ${it.codigo_interno}`);
    await logImovel(it.id, novo ? "arquivado" : "restaurado");
    toast.success(novo ? "Arquivado" : "Restaurado");
    load();
  }

  async function excluir(it: any) {
    if (!canWrite) return;
    if (!confirm(`Excluir imóvel ${it.codigo_interno}? Esta ação é permanente.`)) return;
    const { error } = await supabase.from("imoveis").delete().eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("imovel_excluido", `${it.codigo_interno} - ${it.titulo}`);
    toast.success("Excluído");
    load();
  }

  const cidadesUnicas = useMemo(() => [...new Set(items.map((i) => i.cidade).filter(Boolean))], [items]);
  const tiposUnicos = useMemo(() => [...new Set(items.map((i) => i.tipo_imovel).filter(Boolean))], [items]);

  const pieColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Gestão completa do portfólio imobiliário."
        actions={canWrite ? (
          <Button onClick={() => navigate({ to: "/imoveis/novo" })}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Imóvel
          </Button>
        ) : undefined}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Disponíveis", value: kpis.disponivel, color: "text-[oklch(0.68_0.16_152)]" },
          { label: "Reservados", value: kpis.reservado, color: "text-amber-600" },
          { label: "Vendidos", value: kpis.vendido, color: "text-blue-600" },
          { label: "Suspensos", value: kpis.suspenso, color: "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Por tipo</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byTipo} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
                    {byTipo.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Por cidade (top 8)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCidade}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status tabs */}
      <Tabs value={statusTab} onValueChange={setStatusTab} className="mb-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="disponivel">Ativos</TabsTrigger>
          <TabsTrigger value="reservado">Reservados</TabsTrigger>
          <TabsTrigger value="vendido">Vendidos</TabsTrigger>
          <TabsTrigger value="suspenso">Suspensos</TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Código, título, responsável..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={fTipo || "all"} onValueChange={(v) => setFTipo(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {tiposUnicos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fCidade || "all"} onValueChange={(v) => setFCidade(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cidadesUnicas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fPubXml || "all"} onValueChange={(v) => setFPubXml(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="XML" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">XML (todos)</SelectItem>
                <SelectItem value="sim">Publicar XML</SelectItem>
                <SelectItem value="nao">Não publicar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fAtivoSite || "all"} onValueChange={(v) => setFAtivoSite(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Site (todos)</SelectItem>
                <SelectItem value="sim">Ativo no site</SelectItem>
                <SelectItem value="nao">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} imóvel(is)</p>
            <div className="flex gap-1">
              <Button size="sm" variant={view === "tabela" ? "default" : "ghost"} onClick={() => setView("tabela")}><List className="h-4 w-4" /></Button>
              <Button size="sm" variant={view === "cards" ? "default" : "ghost"} onClick={() => setView("cards")}><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Home className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
            </div>
          ) : view === "tabela" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cidade/Bairro</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.codigo_interno}</TableCell>
                    <TableCell className="font-medium">
                      <Link to="/imoveis/$id/editar" params={{ id: i.id }} className="hover:underline">{i.titulo}</Link>
                      <div className="flex gap-1 mt-1">
                        {i.publicar_xml && <Badge variant="outline" className="text-[10px]">XML</Badge>}
                        {i.ativo_site && <Badge variant="outline" className="text-[10px]">Site</Badge>}
                        {i.destaque_home && <Badge variant="secondary" className="text-[10px]">Destaque</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.tipo_imovel ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{[i.bairro, i.cidade].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell>{i.preco ? `R$ ${Number(i.preco).toLocaleString("pt-BR")}` : "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[i.status_imovel] ?? "secondary"}>{STATUS_LABEL[i.status_imovel] ?? i.status_imovel}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((i) => (
                <Card key={i.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-muted-foreground">{i.codigo_interno}</p>
                        <Link to="/imoveis/$id/editar" params={{ id: i.id }} className="font-semibold hover:underline block truncate">{i.titulo}</Link>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{[i.bairro, i.cidade].filter(Boolean).join(" / ") || "—"}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[i.status_imovel] ?? "secondary"}>{STATUS_LABEL[i.status_imovel] ?? i.status_imovel}</Badge>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-lg font-bold">{i.preco ? `R$ ${Number(i.preco).toLocaleString("pt-BR")}` : "—"}</p>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/imoveis/$id/editar", params: { id: i.id } })}><Pencil className="h-4 w-4" /></Button>
                        {canWrite && <Button size="icon" variant="ghost" onClick={() => duplicar(i)}><Copy className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
