import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { MODULOS, type ModuloKey } from "@/lib/modulos";
import { supabase } from "@/integrations/supabase/client";
import {
  listarPapeis, criarPapel, excluirPapel,
  listarPermissoesPapel, salvarPermissoesPapel,
} from "@/lib/papeis-admin.functions";

async function getToken() {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("Sessão expirada.");
  return t;
}

type Papel = { slug: string; nome: string; descricao: string | null; sistema: boolean };
type Perm = { modulo: string; pode_ver: boolean; pode_criar: boolean; pode_editar: boolean; pode_excluir: boolean };

export function PapeisPermissoesTab() {
  const listar = useServerFn(listarPapeis);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const _token = await getToken();
      const data = await listar({ data: { _token } });
      const list = data as Papel[];
      setPapeis(list);
      if (!selected && list.length > 0) setSelected(list[0].slug);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao listar papéis");
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const sel = papeis.find((p) => p.slug === selected) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <Card className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Papéis</h3>
          <Button size="sm" variant="outline" onClick={() => setOpenNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        </div>
        {loading && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        )}
        <div className="space-y-1">
          {papeis.map((p) => (
            <button
              key={p.slug}
              onClick={() => setSelected(p.slug)}
              className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors ${
                selected === p.slug ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{p.nome}</span>
                {p.sistema ? (
                  <Badge variant="outline" className="text-[10px]"><Lock className="h-2.5 w-2.5 mr-1" />Sistema</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Custom</Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{p.slug}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        {sel ? (
          <PermissoesEditor papel={sel} onDeleted={() => { setSelected(null); void refresh(); }} />
        ) : (
          <div className="text-sm text-muted-foreground py-12 text-center">Selecione um papel</div>
        )}
      </Card>

      <NovoPapelDialog open={openNew} onOpenChange={setOpenNew} onCreated={(slug) => { setSelected(slug); void refresh(); }} />
    </div>
  );
}

function PermissoesEditor({ papel, onDeleted }: { papel: Papel; onDeleted: () => void }) {
  const listarPerms = useServerFn(listarPermissoesPapel);
  const salvar = useServerFn(salvarPermissoesPapel);
  const excluir = useServerFn(excluirPapel);

  const [perms, setPerms] = useState<Record<string, Perm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const _token = await getToken();
        const rows = await listarPerms({ data: { _token, slug: papel.slug } });
        if (cancel) return;
        const map: Record<string, Perm> = {};
        MODULOS.forEach((m) => { map[m.key] = { modulo: m.key, pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false }; });
        (rows ?? []).forEach((r: Perm) => { map[r.modulo] = r; });
        setPerms(map);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao carregar permissões");
      } finally { setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [papel.slug]);

  const grupos = useMemo(() => Array.from(new Set(MODULOS.map((m) => m.grupo))), []);

  function togglePerm(mod: ModuloKey, key: keyof Omit<Perm, "modulo">) {
    setPerms((cur) => ({ ...cur, [mod]: { ...cur[mod], [key]: !cur[mod][key] } }));
  }
  function setAllInModulo(mod: ModuloKey, value: boolean) {
    setPerms((cur) => ({ ...cur, [mod]: { modulo: mod, pode_ver: value, pode_criar: value, pode_editar: value, pode_excluir: value } }));
  }

  async function save() {
    setSaving(true);
    try {
      const _token = await getToken();
      await salvar({ data: { _token, slug: papel.slug, permissoes: Object.values(perms) } });
      toast.success("Permissões salvas");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Excluir o papel "${papel.nome}"?`)) return;
    try {
      const _token = await getToken();
      await excluir({ data: { _token, slug: papel.slug } });
      toast.success("Papel excluído");
      onDeleted();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao excluir"); }
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> {papel.nome}
            {papel.sistema && <Badge variant="outline" className="text-[10px]">Sistema</Badge>}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {papel.descricao || (papel.sistema
              ? "Papel do sistema — controla regras de acesso fixas no código e RLS."
              : "Papel customizado — só controla o que aparece nos módulos.")}
          </p>
        </div>
        {!papel.sistema && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir papel
          </Button>
        )}
      </div>

      {grupos.map((g) => (
        <div key={g}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{g}</h4>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Módulo</TableHead>
                  <TableHead className="w-16 text-center">Ver</TableHead>
                  <TableHead className="w-16 text-center">Criar</TableHead>
                  <TableHead className="w-16 text-center">Editar</TableHead>
                  <TableHead className="w-16 text-center">Excluir</TableHead>
                  <TableHead className="w-20 text-center">Tudo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULOS.filter((m) => m.grupo === g).map((m) => {
                  const p = perms[m.key] ?? { modulo: m.key, pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false };
                  const all = p.pode_ver && p.pode_criar && p.pode_editar && p.pode_excluir;
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.pode_ver} onCheckedChange={() => togglePerm(m.key, "pode_ver")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.pode_criar} onCheckedChange={() => togglePerm(m.key, "pode_criar")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.pode_editar} onCheckedChange={() => togglePerm(m.key, "pode_editar")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.pode_excluir} onCheckedChange={() => togglePerm(m.key, "pode_excluir")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={all} onCheckedChange={() => setAllInModulo(m.key, !all)} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar permissões
        </Button>
      </div>
    </div>
  );
}

function NovoPapelDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (slug: string) => void }) {
  const criar = useServerFn(criarPapel);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  function autoSlug(v: string) {
    return v.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
  }

  async function submit() {
    if (!nome.trim() || !slug.trim()) { toast.error("Informe nome e slug."); return; }
    setSaving(true);
    try {
      const _token = await getToken();
      await criar({ data: { _token, slug: slug.trim(), nome: nome.trim(), descricao: descricao.trim() || null } });
      toast.success("Papel criado");
      onOpenChange(false);
      onCreated(slug.trim());
      setNome(""); setSlug(""); setDescricao("");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao criar"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo papel</DialogTitle>
          <DialogDescription>Crie um papel customizado e atribua suas permissões em seguida.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => { setNome(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Ex.: Gerente de Vendas" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug (identificador)</Label>
            <Input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="ex.: gerente_vendas" />
            <p className="text-[11px] text-muted-foreground">Somente letras minúsculas, números e _.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
