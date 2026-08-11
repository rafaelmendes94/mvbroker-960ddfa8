import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Plus, Loader2, Copy, KeyRound, Lock, Unlock, Trash2, Users,
} from "lucide-react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listarMeusCorretores, criarCorretorImobiliaria, alterarStatusCorretor,
  resetarSenhaCorretor, excluirCorretorImobiliaria,
} from "@/lib/corretores-imobiliaria.functions";

export const Route = createFileRoute("/_authenticated/meus-corretores")({
  head: () => ({
    meta: [
      { title: "Meus Corretores — MV Broker" },
      { name: "description", content: "Cadastre, bloqueie e gerencie os corretores da sua imobiliária." },
      { property: "og:title", content: "Meus Corretores — MV Broker" },
      { property: "og:description", content: "Cadastre, bloqueie e gerencie os corretores da sua imobiliária." },
    ],
  }),
  component: () => (
    <RoleGate allow={["imobiliaria", "super_admin"]}>
      <MeusCorretoresPage />
    </RoleGate>
  ),
});

type Corretor = {
  id: string; user_id: string | null; nome: string; email: string | null;
  creci: string | null; telefone: string | null; status: string; created_at: string;
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return token;
}

function MeusCorretoresPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<Corretor[]>([]);
  const [usados, setUsados] = useState(0);
  const [limite, setLimite] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", creci: "", telefone: "" });
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Corretor | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const _token = await getToken();
      const res = await listarMeusCorretores({ data: { _token } });
      setRows(res.corretores as Corretor[]);
      setUsados(res.usados ?? 0);
      setLimite(res.limite ?? null);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar corretores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cheio = limite != null && usados >= limite;
  const semPlano = limite == null;

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Informe nome e e-mail.");
      return;
    }
    if (form.senha && form.senha.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const _token = await getToken();
      const res = await criarCorretorImobiliaria({
        data: {
          _token,
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha || undefined,
          creci: form.creci || undefined,
          telefone: form.telefone || undefined,
        },
      });
      toast.success("Corretor cadastrado.");
      setSenhaGerada(res.senha ?? null);
      setOpen(false);
      setForm({ nome: "", email: "", senha: "", creci: "", telefone: "" });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cadastrar corretor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: Corretor) {
    setBusy(c.id);
    try {
      const _token = await getToken();
      await alterarStatusCorretor({
        data: { _token, corretor_id: c.id, bloquear: c.status !== "bloqueado" },
      });
      toast.success(c.status === "bloqueado" ? "Corretor desbloqueado." : "Corretor bloqueado.");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar status.");
    } finally {
      setBusy(null);
    }
  }

  async function resetSenha(c: Corretor) {
    setBusy(c.id);
    try {
      const _token = await getToken();
      const res = await resetarSenhaCorretor({ data: { _token, corretor_id: c.id } });
      setSenhaGerada(res.senha);
      toast.success("Senha redefinida.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao redefinir senha.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setBusy(excluir.id);
    try {
      const _token = await getToken();
      await excluirCorretorImobiliaria({ data: { _token, corretor_id: excluir.id } });
      toast.success("Corretor excluído.");
      setExcluir(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir corretor.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Meus corretores"
        description="Cadastre os corretores da sua imobiliária conforme o limite do seu plano."
        actions={
          <Button onClick={() => setOpen(true)} disabled={cheio || semPlano || !!erro}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo corretor
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Corretores ativos</p>
            <p className="text-xl font-bold">
              {usados} {limite != null ? `de ${limite}` : "— sem plano ativo"}
            </p>
          </div>
          {cheio && (
            <Badge variant="destructive" className="ml-auto">Limite do plano atingido</Badge>
          )}
        </CardContent>
      </Card>

      {erro ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{erro}</CardContent></Card>
      ) : loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
          Nenhum corretor cadastrado ainda.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CRECI</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell>{c.creci ?? "—"}</TableCell>
                    <TableCell>{c.telefone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "bloqueado" ? "destructive" : "secondary"}>
                        {c.status === "bloqueado" ? "Bloqueado" : "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => resetSenha(c)} title="Redefinir senha">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => toggleStatus(c)} title={c.status === "bloqueado" ? "Desbloquear" : "Bloquear"}>
                        {c.status === "bloqueado" ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === c.id} onClick={() => setExcluir(c)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Novo corretor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo corretor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} maxLength={200} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} maxLength={255} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Senha (opcional — gerada automaticamente se vazio)</Label>
              <Input type="text" value={form.senha} maxLength={72} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CRECI</Label>
                <Input value={form.creci} maxLength={50} onChange={(e) => setForm({ ...form, creci: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} maxLength={30} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senha gerada */}
      <Dialog open={!!senhaGerada} onOpenChange={(o) => !o && setSenhaGerada(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Senha de acesso</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Copie e envie ao corretor. Ela não será exibida novamente.</p>
          <div className="flex gap-2">
            <Input readOnly value={senhaGerada ?? ""} className="font-mono" />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(senhaGerada ?? ""); toast.success("Copiado"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSenhaGerada(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir corretor?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.nome} será removido e o login dele será excluído. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
