import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Trash2, KeyRound, ShieldCheck, Loader2, Users as UsersIcon, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RoleGate } from "@/components/RoleGate";
import { ROLE_LABEL, type AppRole } from "@/lib/permissions";
import { MODULOS, type ModuloKey } from "@/lib/modulos";
import {
  listarUsuariosAdmin, criarUsuarioAdmin, atualizarRolesUsuario,
  excluirUsuarioAdmin, resetarSenhaUsuario, definirSenhaUsuario,
  listarPermissoesUsuario, salvarPermissoesUsuario,
} from "@/lib/usuarios-admin.functions";
import { listarPapeis } from "@/lib/papeis-admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { PapeisPermissoesTab } from "@/components/usuarios/PapeisPermissoesTab";

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return token;
}

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <UsuariosPage />
    </RoleGate>
  ),
});

const BUILTIN_ROLES_ENUM: AppRole[] = ["super_admin", "secretaria"];

type Papel = { slug: string; nome: string; descricao: string | null; sistema: boolean };

type UserRow = {
  id: string; email: string; full_name: string | null; avatar_url: string | null;
  created_at: string; last_sign_in_at: string | null; roles: string[];
};

function initials(name?: string | null, email?: string) {
  const base = (name || email || "").trim();
  if (!base) return "?";
  return base.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function UsuariosPage() {
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerencie usuários, papéis e permissões por módulo."
      />
      <Tabs defaultValue="usuarios" className="mt-2">
        <TabsList>
          <TabsTrigger value="usuarios"><UsersIcon className="h-4 w-4 mr-2" />Usuários</TabsTrigger>
          <TabsTrigger value="papeis"><Shield className="h-4 w-4 mr-2" />Papéis & Permissões</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="pt-4">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="papeis" className="pt-4">
          <PapeisPermissoesTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function UsuariosTab() {
  const listar = useServerFn(listarUsuariosAdmin);
  const listarP = useServerFn(listarPapeis);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const _token = await getToken();
      const [data, ps] = await Promise.all([
        listar({ data: { _token } }),
        listarP({ data: { _token } }),
      ]);
      setRows(data as UserRow[]);
      setPapeis(ps as Papel[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao listar");
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const filtered = rows.filter((u) => {
    const t = q.toLowerCase();
    return !t || (u.email?.toLowerCase().includes(t) || u.full_name?.toLowerCase().includes(t));
  });

  const labelFor = (slug: string) =>
    papeis.find((p) => p.slug === slug)?.nome ?? ROLE_LABEL[slug as AppRole] ?? slug;

  return (
    <>
      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou e-mail…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Usuário</TableHead>
              <TableHead>Papéis</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando…
              </TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                Nenhum usuário encontrado.
              </TableCell></TableRow>
            )}
            {!loading && filtered.map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setEditing(u)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials(u.full_name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(u.roles ?? []).length === 0
                      ? <Badge variant="outline">sem papel</Badge>
                      : u.roles.map((r) => (
                          <Badge key={r} variant="secondary">{labelFor(r)}</Badge>
                        ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "—"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <RowMenu user={u} onChanged={refresh} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <NewUserDialog open={openNew} onOpenChange={setOpenNew} onCreated={refresh} papeis={papeis} />
      {editing && (
        <EditUserSheet
          key={editing.id}
          user={editing}
          papeis={papeis}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}

function RowMenu({ user, onChanged }: { user: UserRow; onChanged: () => void }) {
  const reset = useServerFn(resetarSenhaUsuario);
  const excluir = useServerFn(excluirUsuarioAdmin);

  async function handleReset() {
    try {
      const _token = await getToken();
      const { senha } = await reset({ data: { user_id: user.id, _token } });
      navigator.clipboard?.writeText(senha).catch(() => {});
      toast.success(`Nova senha: ${senha} (copiada)`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }
  async function handleDelete() {
    if (!confirm(`Excluir definitivamente o usuário ${user.email}?`)) return;
    try {
      const _token = await getToken();
      await excluir({ data: { user_id: user.id, _token } });
      toast.success("Usuário excluído");
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleReset}><KeyRound className="h-4 w-4 mr-2" /> Resetar senha</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function splitRoles(papeis: Papel[], slugs: string[]) {
  const customSet = new Set(papeis.filter((p) => !p.sistema).map((p) => p.slug));
  const roles: AppRole[] = [];
  const custom: string[] = [];
  slugs.forEach((s) => {
    if (customSet.has(s)) custom.push(s);
    else roles.push(s as AppRole);
  });
  return { roles, custom };
}

function PapeisPicker({
  papeis, selected, onToggle,
}: { papeis: Papel[]; selected: Set<string>; onToggle: (slug: string) => void }) {
  const sistema = papeis.filter((p) => p.sistema && BUILTIN_ROLES_ENUM.includes(p.slug as AppRole));
  const custom = papeis.filter((p) => !p.sistema);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Sistema</p>
        <div className="grid grid-cols-2 gap-2">
          {sistema.map((p) => (
            <label key={p.slug} className="flex items-center gap-2 text-sm rounded-md border p-2.5">
              <Checkbox checked={selected.has(p.slug)} onCheckedChange={() => onToggle(p.slug)} />
              {p.nome}
            </label>
          ))}
        </div>
      </div>
      {custom.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Customizados</p>
          <div className="grid grid-cols-2 gap-2">
            {custom.map((p) => (
              <label key={p.slug} className="flex items-center gap-2 text-sm rounded-md border p-2.5">
                <Checkbox checked={selected.has(p.slug)} onCheckedChange={() => onToggle(p.slug)} />
                {p.nome}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewUserDialog({
  open, onOpenChange, onCreated, papeis,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; papeis: Papel[] }) {
  const criar = useServerFn(criarUsuarioAdmin);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set(["secretaria"]));
  const [modo, setModo] = useState<"senha" | "convite">("senha");
  const [saving, setSaving] = useState(false);

  function toggle(slug: string) {
    setSel((cur) => {
      const n = new Set(cur);
      if (n.has(slug)) n.delete(slug); else n.add(slug);
      return n;
    });
  }

  async function submit() {
    if (!email || !nome || sel.size === 0) {
      toast.error("Preencha nome, e-mail e ao menos um papel."); return;
    }
    setSaving(true);
    try {
      const _token = await getToken();
      const { roles, custom } = splitRoles(papeis, [...sel]);
      const res: any = await criar({ data: { email, nome, roles, custom_role_slugs: custom, modo, _token } });
      if (res?.senha) {
        navigator.clipboard?.writeText(res.senha).catch(() => {});
        toast.success(`Usuário criado. Senha: ${res.senha} (copiada)`);
      } else {
        toast.success("Convite enviado.");
      }
      onOpenChange(false);
      setNome(""); setEmail(""); setSel(new Set(["secretaria"])); setModo("senha");
      onCreated();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao criar"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Cria o acesso e aplica os papéis selecionados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Papéis</Label>
            <PapeisPicker papeis={papeis} selected={sel} onToggle={toggle} />
          </div>
          <div className="space-y-2">
            <Label>Como criar</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={modo === "senha"} onChange={() => setModo("senha")} />
                Definir senha automática
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={modo === "convite"} onChange={() => setModo("convite")} />
                Enviar convite por e-mail
              </label>
            </div>
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

type Perm = { modulo: string; pode_ver: boolean; pode_criar: boolean; pode_editar: boolean; pode_excluir: boolean };

function EditUserSheet({
  user, papeis, onClose, onChanged,
}: { user: UserRow; papeis: Papel[]; onClose: () => void; onChanged: () => void }) {
  const atualizarRoles = useServerFn(atualizarRolesUsuario);
  const listarPerms = useServerFn(listarPermissoesUsuario);
  const salvarPerms = useServerFn(salvarPermissoesUsuario);

  const [sel, setSel] = useState<Set<string>>(new Set(user.roles));
  const [perms, setPerms] = useState<Record<string, Perm>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("papeis");

  useEffect(() => {
    (async () => {
      const _token = await getToken();
      const rows = await listarPerms({ data: { user_id: user.id, _token } });
      const map: Record<string, Perm> = {};
      MODULOS.forEach((m) => { map[m.key] = { modulo: m.key, pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false }; });
      (rows ?? []).forEach((r: Perm) => { map[r.modulo] = r; });
      setPerms(map);
    })();
  }, [user.id]);

  function togglePerm(mod: ModuloKey, key: keyof Omit<Perm, "modulo">) {
    setPerms((cur) => ({ ...cur, [mod]: { ...cur[mod], [key]: !cur[mod][key] } }));
  }
  function setAllInModulo(mod: ModuloKey, value: boolean) {
    setPerms((cur) => ({
      ...cur,
      [mod]: { modulo: mod, pode_ver: value, pode_criar: value, pode_editar: value, pode_excluir: value },
    }));
  }
  function toggleRole(slug: string) {
    setSel((cur) => {
      const n = new Set(cur);
      if (n.has(slug)) n.delete(slug); else n.add(slug);
      return n;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const _token = await getToken();
      const { roles, custom } = splitRoles(papeis, [...sel]);
      await atualizarRoles({ data: { user_id: user.id, roles, custom_role_slugs: custom, _token } });
      await salvarPerms({ data: { user_id: user.id, permissoes: Object.values(perms), _token } });
      toast.success("Alterações salvas");
      onChanged(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  const grupos = Array.from(new Set(MODULOS.map((m) => m.grupo)));

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user.full_name || user.email}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="papeis"><ShieldCheck className="h-4 w-4 mr-2" />Papéis</TabsTrigger>
            <TabsTrigger value="permissoes">Ajustes por módulo</TabsTrigger>
          </TabsList>

          <TabsContent value="papeis" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Os papéis definem o conjunto padrão de permissões.
            </p>
            <PapeisPicker papeis={papeis} selected={sel} onToggle={toggleRole} />
          </TabsContent>

          <TabsContent value="permissoes" className="pt-4 space-y-6">
            <p className="text-sm text-muted-foreground">
              Estes ajustes <strong>somam</strong> ao que o papel já libera. Use para conceder algo extra a este usuário.
            </p>
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
                        <TableHead className="w-24 text-center">Tudo</TableHead>
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
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
