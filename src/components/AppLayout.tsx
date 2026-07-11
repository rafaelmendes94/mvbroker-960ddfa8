import type { ReactNode } from "react";

// O botão Voltar é renderizado pelo AppShell (layout global autenticado).
// Este wrapper existe apenas para compatibilidade — não duplica o botão.
export function AppLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
