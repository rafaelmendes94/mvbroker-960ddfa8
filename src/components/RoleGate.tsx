import type { ReactNode } from "react";
import { useRoles } from "@/hooks/use-roles";
import type { AppRole } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";

export function RoleGate({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { roles, loading } = useRoles();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando permissões…</div>;
  const ok = roles.some((r) => allow.includes(r));
  if (!ok) {
    return (
      <div className="grid place-items-center p-16">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Seu perfil não tem permissão para visualizar esta área.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
