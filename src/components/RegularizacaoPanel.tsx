import { AlertCircle, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MinhaAssinatura } from "@/hooks/use-assinatura";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function RegularizacaoPanel({ assinatura }: { assinatura: MinhaAssinatura | null }) {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {assinatura ? "Acesso temporariamente bloqueado" : "Sem assinatura ativa"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {assinatura
                  ? "Sua assinatura está com pendência. Regularize para liberar o acesso completo ao MV BROKER."
                  : "Sua conta ainda não está vinculada a um plano. Fale com o comercial para ativar seu acesso."}
              </p>

              {assinatura && (
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Plano</dt>
                    <dd className="font-semibold">{assinatura.plano_nome}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                    <dd className="font-semibold capitalize">{assinatura.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Valor ({assinatura.ciclo})</dt>
                    <dd className="font-semibold">{fmtBRL(Number(assinatura.valor))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Próximo vencimento</dt>
                    <dd className="font-semibold">
                      {assinatura.proximo_vencimento
                        ? new Date(assinatura.proximo_vencimento).toLocaleDateString("pt-BR")
                        : "—"}
                    </dd>
                  </div>
                  {assinatura.bloqueio_motivo && (
                    <div className="col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Motivo</dt>
                      <dd>{assinatura.bloqueio_motivo}</dd>
                    </div>
                  )}
                </dl>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="mailto:comercial@mvbroker.com.br">
                  <Button className="gap-2"><Mail className="h-4 w-4" /> Falar com comercial</Button>
                </a>
                <a
                  href={`https://wa.me/5551983282535?text=${encodeURIComponent(
                    assinatura
                      ? `Olá Patrique! Preciso regularizar minha assinatura do MV BROKER (Plano ${assinatura.plano_nome}).`
                      : "Olá Patrique! Quero contratar um plano do MV BROKER."
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" className="gap-2"><Phone className="h-4 w-4" /> WhatsApp (Patrique)</Button>
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
