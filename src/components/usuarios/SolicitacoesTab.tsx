import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Check, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listarSolicitacoes,
  aprovarSolicitacao,
  recusarSolicitacao,
} from "@/lib/solicitacoes.functions";

type Solicitacao = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  creci: string | null;
  cidade: string | null;
  status: "pendente" | "aprovado" | "recusado";
  motivo_recusa: string | null;
  created_at: string;
};

type Plano = { id: string; nome: string; preco_mensal: number; preco_anual: number | null };

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const statusBadge: Record<string, string> = {
  pendente: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  aprovado: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  recusado: "bg-destructive/15 text-destructive",
};

export function SolicitacoesTab() {
  const listar = useServerFn(listarSolicitacoes);
  const [rows, setRows] = useState<Solicitacao[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [alvo, setAlvo] = useState<Solicitacao | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const token = await getToken();
      const data = await listar({ data: { _token: token } });
      setRows((data ?? []) as unknown as Solicitacao[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    supabase
      .from("planos")
      .select("id, nome, preco_mensal, preco_anual")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setPlanos((data ?? []) as Plano[]));
  }, []);

  const pendentes = rows.filter((r) => r.status === "pendente");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pendentes.length} solicitação(ões) aguardando aprovação.
        </p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corretor</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>CRECI</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma solicitação de cadastro.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {(r as any).tipo === "imobiliaria" ? "Imobiliária" : "Corretor"}
                    {(r as any).cnpj ? ` · CNPJ ${(r as any).cnpj}` : ""}
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </TableCell>

                <TableCell className="text-sm">
                  <div>{r.email}</div>
                  <div className="text-muted-foreground">{r.telefone}</div>
                </TableCell>
                <TableCell className="text-sm">{r.creci || "—"}</TableCell>
                <TableCell className="text-sm">{r.cidade || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusBadge[r.status]}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "pendente" ? (
                    <Button size="sm" onClick={() => setAlvo(r)} className="gap-2">
                      <Check className="h-4 w-4" /> Analisar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{r.motivo_recusa || "—"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {alvo && (
        <AnalisarDialog
          solicitacao={alvo}
          planos={planos}
          onClose={() => setAlvo(null)}
          onDone={() => {
            setAlvo(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AnalisarDialog({
  solicitacao,
  planos,
  onClose,
  onDone,
}: {
  solicitacao: Solicitacao;
  planos: Plano[];
  onClose: () => void;
  onDone: () => void;
}) {
  const aprovar = useServerFn(aprovarSolicitacao);
  const recusar = useServerFn(recusarSolicitacao);
  const [planoId, setPlanoId] = useState<string>(planos[0]?.id ?? "");
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [valor, setValor] = useState<string>("");
  const [venc, setVenc] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const plano = planos.find((p) => p.id === planoId);
  const valorSugerido = plano
    ? ciclo === "anual"
      ? Number(plano.preco_anual ?? plano.preco_mensal * 12)
      : Number(plano.preco_mensal)
    : 0;

  async function handleAprovar() {
    if (!planoId) return toast.error("Selecione um plano.");
    setBusy(true);
    try {
      const token = await getToken();
      const res = await aprovar({
        data: {
          _token: token,
          solicitacao_id: solicitacao.id,
          plano_id: planoId,
          ciclo,
          valor: valor === "" ? valorSugerido : Number(valor),
          ...(venc ? { proximo_vencimento: venc } : {}),
        },
      });
      toast.success(
        res?.emailEnviado
          ? "Conta aprovada e e-mail enviado."
          : "Conta aprovada. (E-mail de aviso não enviado.)",
      );
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aprovar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecusar() {
    if (motivo.trim().length < 3) return toast.error("Informe o motivo da recusa.");
    setBusy(true);
    try {
      const token = await getToken();
      await recusar({ data: { _token: token, solicitacao_id: solicitacao.id, motivo: motivo.trim() } });
      toast.success("Solicitação recusada.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao recusar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Analisar cadastro — {solicitacao.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div>{solicitacao.email}</div>
            <div className="text-muted-foreground">
              {solicitacao.telefone} · CRECI {solicitacao.creci} · {solicitacao.cidade}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={planoId} onValueChange={setPlanoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ciclo</Label>
              <Select value={ciclo} onValueChange={(v) => setCiclo(v as "mensal" | "anual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder={String(valorSugerido)}
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(",", "."))}
              />
            </div>
            <div className="space-y-2">
              <Label>Próximo vencimento</Label>
              <Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo (apenas se recusar)</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={handleRecusar} disabled={busy} className="gap-2">
            <X className="h-4 w-4" /> Recusar
          </Button>
          <Button onClick={handleAprovar} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar e vincular plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
