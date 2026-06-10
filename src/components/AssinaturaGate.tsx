import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAssinatura } from "@/hooks/use-assinatura";
import { RegularizacaoPanel } from "./RegularizacaoPanel";

// Rotas que sempre são liberadas (perfil, regularização)
const ALWAYS_ALLOWED = ["/perfil", "/regularizacao", "/acesso-negado"];

export function AssinaturaGate({ children }: { children: ReactNode }) {
  const { assinatura, loading, bloqueado } = useAssinatura();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return <>{children}</>;
  if (ALWAYS_ALLOWED.some((p) => pathname.startsWith(p))) return <>{children}</>;
  if (!bloqueado) return <>{children}</>;

  return <RegularizacaoPanel assinatura={assinatura} />;
}
