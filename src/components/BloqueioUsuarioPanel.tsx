import { Lock, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function BloqueioUsuarioPanel({ motivo }: { motivo: string | null }) {
  const navigate = useNavigate();

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid place-items-center p-10">
      <div className="max-w-md w-full text-center rounded-xl border border-border bg-card p-8">
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-destructive/10 text-destructive mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Acesso bloqueado</h2>
        <p className="text-sm text-muted-foreground">
          Seu acesso ao MV Broker foi bloqueado pelo administrador.
        </p>
        {motivo && (
          <p className="mt-3 text-sm rounded-md bg-muted p-3 text-foreground">{motivo}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Entre em contato pelo WhatsApp +55 51 98328-2535 para regularizar.
        </p>
        <Button variant="outline" className="mt-6" onClick={sair}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );
}
