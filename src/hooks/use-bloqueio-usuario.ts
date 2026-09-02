import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useBloqueioUsuario() {
  const { user, loading: authLoading } = useAuth();
  const [bloqueado, setBloqueado] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setBloqueado(false); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("bloqueado, bloqueio_motivo")
        .eq("id", user.id)
        .maybeSingle();
      if (cancel) return;
      setBloqueado(!!data?.bloqueado);
      setMotivo(data?.bloqueio_motivo ?? null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user, authLoading]);

  return { bloqueado, motivo, loading: loading || authLoading };
}
