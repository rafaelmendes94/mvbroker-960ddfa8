import { Clock, XCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MinhaSolicitacao } from "@/hooks/use-minha-solicitacao";

export function AprovacaoPendentePanel({ solicitacao }: { solicitacao: MinhaSolicitacao }) {
  const recusado = solicitacao.status === "recusado";

  return (
    <div className="mx-auto max-w-2xl py-12">
      <Card className={recusado ? "border-destructive/40" : "border-primary/30"}>
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              {recusado ? <XCircle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {recusado ? "Cadastro não aprovado" : "Cadastro em análise"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {recusado
                  ? solicitacao.motivo_recusa || "Sua solicitação foi recusada pela nossa equipe."
                  : "Recebemos seu cadastro. Nossa equipe vai analisar e vincular o seu plano. Você receberá um e-mail assim que a conta for aprovada."}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Enviado em {new Date(solicitacao.created_at).toLocaleDateString("pt-BR")}
              </p>

              <div className="mt-8">
                <a
                  href={`https://wa.me/5551983282535?text=${encodeURIComponent(
                    `Olá! Sou ${solicitacao.nome} e gostaria de falar sobre meu cadastro no MV BROKER.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <Phone className="h-4 w-4" /> Falar com o comercial
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
