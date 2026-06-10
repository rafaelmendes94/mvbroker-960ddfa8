import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Building2, User as UserIcon, Loader2, Repeat, Copy, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { criarAcessoCliente } from "@/lib/clientes-auth.functions";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <ClientesPage />
    </RoleGate>
  ),
});

type Plano = {
  id: string; nome: string; tipo: "individual" | "imobiliaria";
  preco_mensal: number; preco_anual: number | null; limite_usuarios: number | null; ativo: boolean;
};
type Assinatura = {
  id: string; plano_id: string; imobiliaria_id: string | null; usuario_id: string | null;
  status: string; ciclo: "mensal" | "anual"; valor: number;
};
type ClienteRow = {
  key: string;
  tipo: "imobiliaria" | "corretor";
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cnpj?: string | null;
  creci?: string | null;
  imobiliaria_id?: string | null;
  user_id?: string | null;
  assinatura?: Assinatura;
  plano?: Plano;
  corretores_ativos?: number; // só imobiliária
};

const emptyForm = {
  tipo: "imobiliaria" as "imobiliaria" | "corretor",
  nome: "", email: "", telefone: "",
  cnpj: "", razao_social: "",
  creci: "",
  plano_id: "", ciclo: "mensal" as "mensal" | "anual",
  modoAcesso: "senha" as "senha" | "convite",
};

const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ClientesPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "imobiliaria" | "corretor">("all");

  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [trocaOpen, setTrocaOpen] = useState(false);
  const [trocaRow, setTrocaRow] = useState<ClienteRow | null>(null);
  const [trocaPlanoId, setTrocaPlanoId] = useState("");
  const [trocaCiclo, setTrocaCiclo] = useState<"mensal" | "anual">("mensal");

  const [credOpen, setCredOpen] = useState(false);
  const [cred, setCred] = useState<{ email: string; senha: string } | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: planData }, { data: imobs }, { data: corrs }, { data: ass }, { data: corrCount }] = await Promise.all([
      supabase.from("planos").select("id, nome, tipo, preco_mensal, preco_anual, limite_usuarios, ativo").order("ordem"),
      supabase.from("imobiliarias").select("id, nome_fantasia, cnpj, telefone, email, status").order("nome_fantasia"),
      supabase.from("corretores").select("id, user_id, nome, email, telefone, creci, imobiliaria_id, status").is("imobiliaria_id", null).order("nome"),
      supabase.from("assinaturas").select("id, plano_id, imobiliaria_id, usuario_id, status, ciclo, valor"),
      supabase.from("corretores").select("imobiliaria_id, status").eq("status", "ativo").not("imobiliaria_id", "is", null),
    ]);

    const planList = (planData ?? []) as unknown as Plano[];
    const asList = (ass ?? []) as unknown as Assinatura[];
    const planById = new Map(planList.map((p) => [p.id, p]));
    const counts = new Map<string, number>();
    (corrCount ?? []).forEach((c: any) => counts.set(c.imobiliaria_id, (counts.get(c.imobiliaria_id) ?? 0) + 1));

    const imobRows: ClienteRow[] = (imobs ?? []).map((i: any) => {
      const a = asList.find((x) => x.imobiliaria_id === i.id);
      return {
        key: `i-${i.id}`, tipo: "imobiliaria", id: i.id,
        nome: i.nome_fantasia, email: i.email ?? null, telefone: i.telefone ?? null,
        cnpj: i.cnpj ?? null,
        assinatura: a, plano: a ? planById.get(a.plano_id) : undefined,
        corretores_ativos: counts.get(i.id) ?? 0,
      };
    });
    const corrRows: ClienteRow[] = (corrs ?? []).map((c: any) => {
      const a = c.user_id ? asList.find((x) => x.usuario_id === c.user_id) : undefined;
      return {
        key: `c-${c.id}`, tipo: "corretor", id: c.id,
        nome: c.nome, email: c.email ?? null, telefone: c.telefone ?? null,
        creci: c.creci ?? null, user_id: c.user_id,
        assinatura: a, plano: a ? planById.get(a.plano_id) : undefined,
      };
    });

    setPlanos(planList);
    setRows([...imobRows, ...corrRows]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterTipo !== "all" && r.tipo !== filterTipo) return false;
      if (!term) return true;
      return [r.nome, r.email, r.cnpj, r.creci].some((v) => v?.toLowerCase().includes(term));
    });
  }, [rows, search, filterTipo]);

  const planosFiltered = useMemo(
    () => planos.filter((p) => p.ativo && p.tipo === (form.tipo === "imobiliaria" ? "imobiliaria" : "individual")),
    [planos, form.tipo],
  );

  function openCreate() {
    setForm(emptyForm);
    setOpenNew(true);
  }

  async function salvarNovo() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    if (!form.plano_id) { toast.error("Selecione um plano"); return; }
    const plano = planos.find((p) => p.id === form.plano_id);
    if (!plano) return;
    const valor = form.ciclo === "anual" ? (plano.preco_anual ?? plano.preco_mensal * 12) : plano.preco_mensal;

    setSaving(true);
    try {
      if (form.tipo === "imobiliaria") {
        const { data: imob, error: e1 } = await supabase.from("imobiliarias").insert({
          nome_fantasia: form.nome,
          razao_social: form.razao_social || null,
          cnpj: form.cnpj || null,
          email: form.email || null,
          telefone: form.telefone || null,
        }).select("id").single();
        if (e1 || !imob) throw e1 ?? new Error("Falha ao criar imobiliária");
        const { error: e2 } = await supabase.from("assinaturas").insert({
          plano_id: plano.id, imobiliaria_id: imob.id, ciclo: form.ciclo, valor, status: "ativa",
        });
        if (e2) throw e2;
      } else {
        const { error: e1 } = await supabase.from("corretores").insert({
          nome: form.nome, email: form.email || null, telefone: form.telefone || null,
          creci: form.creci || null, status: "ativo", imobiliaria_id: null,
        });
        if (e1) throw e1;
        // Sem usuário vinculado ainda — a assinatura individual exige usuario_id; fica registrada após o convite.
        toast.message("Corretor autônomo criado. A assinatura individual será ativada após o login (vinculação ao usuário).");
      }
      toast.success("Cliente cadastrado");
      setOpenNew(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  }

  function abrirTroca(r: ClienteRow) {
    setTrocaRow(r);
    setTrocaPlanoId(r.assinatura?.plano_id ?? "");
    setTrocaCiclo((r.assinatura?.ciclo as "mensal" | "anual") ?? "mensal");
    setTrocaOpen(true);
  }
  async function salvarTroca() {
    if (!trocaRow || !trocaPlanoId) return;
    const plano = planos.find((p) => p.id === trocaPlanoId);
    if (!plano) return;
    const valor = trocaCiclo === "anual" ? (plano.preco_anual ?? plano.preco_mensal * 12) : plano.preco_mensal;
    const payload: any = { plano_id: plano.id, ciclo: trocaCiclo, valor };
    let err;
    if (trocaRow.assinatura) {
      ({ error: err } = await supabase.from("assinaturas").update(payload).eq("id", trocaRow.assinatura.id));
    } else {
      const body = trocaRow.tipo === "imobiliaria"
        ? { ...payload, imobiliaria_id: trocaRow.id, status: "ativa" }
        : { ...payload, usuario_id: trocaRow.user_id, status: "ativa" };
      if (trocaRow.tipo === "corretor" && !trocaRow.user_id) {
        toast.error("Este corretor ainda não tem login vinculado.");
        return;
      }
      ({ error: err } = await supabase.from("assinaturas").insert(body));
    }
    if (err) { toast.error(err.message); return; }
    toast.success("Plano atualizado");
    setTrocaOpen(false);
    load();
  }

  async function toggleBloqueio(r: ClienteRow) {
    if (!r.assinatura) return;
    const novo = r.assinatura.status === "ativa" ? "bloqueada" : "ativa";
    const { error } = await supabase.from("assinaturas").update({ status: novo }).eq("id", r.assinatura.id);
    if (error) { toast.error(error.message); return; }
    toast.success(novo === "ativa" ? "Assinatura reativada" : "Assinatura bloqueada");
    load();
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Imobiliárias e corretores autônomos, com plano e limites vinculados."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Novo cliente</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, e-mail, CNPJ ou CRECI..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={filterTipo} onValueChange={(v) => setFilterTipo(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="imobiliaria">Imobiliárias</TabsTrigger>
            <TabsTrigger value="corretor">Corretores</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Corretores</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="w-44 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const limite = r.plano?.limite_usuarios ?? null;
                  const used = r.corretores_ativos ?? 0;
                  const noLimit = r.tipo === "imobiliaria" && limite == null;
                  const reached = r.tipo === "imobiliaria" && limite != null && used >= limite;
                  return (
                    <TableRow key={r.key}>
                      <TableCell>
                        <div className="font-medium">{r.nome}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {r.email ?? r.telefone ?? r.cnpj ?? r.creci ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {r.tipo === "imobiliaria" ? <Building2 className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                          {r.tipo === "imobiliaria" ? "Imobiliária" : "Corretor"}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.plano?.nome ?? <span className="text-muted-foreground">Sem plano</span>}</TableCell>
                      <TableCell>
                        {r.assinatura
                          ? <Badge variant={r.assinatura.status === "ativa" ? "default" : "outline"}>{r.assinatura.status}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {r.tipo === "imobiliaria"
                          ? <span className={reached ? "font-medium text-destructive" : ""}>
                              {used} / {noLimit ? "∞" : limite}
                            </span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{fmtBRL(r.assinatura?.valor)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => abrirTroca(r)} title="Trocar plano">
                          <Repeat className="h-4 w-4" />
                        </Button>
                        {r.assinatura && (
                          <Button size="sm" variant="ghost" onClick={() => toggleBloqueio(r)}>
                            {r.assinatura.status === "ativa" ? "Bloquear" : "Reativar"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: Novo cliente */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Tabs value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any, plano_id: "" })}>
                <TabsList className="w-full">
                  <TabsTrigger value="imobiliaria" className="flex-1"><Building2 className="h-4 w-4 mr-1" /> Imobiliária</TabsTrigger>
                  <TabsTrigger value="corretor" className="flex-1"><UserIcon className="h-4 w-4 mr-1" /> Corretor autônomo</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{form.tipo === "imobiliaria" ? "Nome fantasia" : "Nome do corretor"} *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              {form.tipo === "imobiliaria" ? (
                <>
                  <div className="space-y-2">
                    <Label>Razão social</Label>
                    <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="space-y-2 sm:col-span-2">
                  <Label>CRECI</Label>
                  <Input value={form.creci} onChange={(e) => setForm({ ...form, creci: e.target.value })} />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={form.plano_id} onValueChange={(v) => setForm({ ...form, plano_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                  <SelectContent>
                    {planosFiltered.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Nenhum plano {form.tipo} ativo.</div>}
                    {planosFiltered.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} {p.tipo === "imobiliaria" && p.limite_usuarios != null ? `· até ${p.limite_usuarios} corretores` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select value={form.ciclo} onValueChange={(v: "mensal" | "anual") => setForm({ ...form, ciclo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Trocar plano */}
      <Dialog open={trocaOpen} onOpenChange={setTrocaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Trocar plano — {trocaRow?.nome}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={trocaPlanoId} onValueChange={setTrocaPlanoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {planos
                    .filter((p) => p.ativo && p.tipo === (trocaRow?.tipo === "imobiliaria" ? "imobiliaria" : "individual"))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} {p.tipo === "imobiliaria" && p.limite_usuarios != null ? `· até ${p.limite_usuarios}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ciclo</Label>
              <Select value={trocaCiclo} onValueChange={(v: "mensal" | "anual") => setTrocaCiclo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {trocaRow?.tipo === "imobiliaria" && (() => {
              const novo = planos.find((p) => p.id === trocaPlanoId);
              const used = trocaRow.corretores_ativos ?? 0;
              if (novo?.limite_usuarios != null && used > novo.limite_usuarios) {
                return (
                  <p className="text-xs text-amber-600">
                    Atenção: a imobiliária possui {used} corretores ativos, acima do limite de {novo.limite_usuarios} do plano selecionado. Novos cadastros ficarão bloqueados até regularizar.
                  </p>
                );
              }
              return null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrocaOpen(false)}>Cancelar</Button>
            <Button onClick={salvarTroca}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
