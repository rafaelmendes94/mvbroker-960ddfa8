import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAssinatura } from "@/hooks/use-assinatura";
import { useMinhaSolicitacao } from "@/hooks/use-minha-solicitacao";
import { RegularizacaoPanel } from "./RegularizacaoPanel";
import { AprovacaoPendentePanel } from "./AprovacaoPendentePanel";

// Rotas que sempre são liberadas (perfil, regularização)
const ALWAYS_ALLOWED = ["/perfil", "/regularizacao", "/acesso-negado"];

export function AssinaturaGate({ children }: { children: ReactNode }) {
  const { assinatura, loading, bloqueado } = useAssinatura();
  const { solicitacao, loading: solLoading } = useMinhaSolicitacao();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || solLoading) return <>{children}</>;
  if (ALWAYS_ALLOWED.some((p) => pathname.startsWith(p))) return <>{children}</>;
  if (!bloqueado) return <>{children}</>;

  if (solicitacao && solicitacao.status !== "aprovado") {
    return <AprovacaoPendentePanel solicitacao={solicitacao} />;
  }

  return <RegularizacaoPanel assinatura={assinatura} />;
}

