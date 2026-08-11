import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type MinhaSolicitacao = {
  id: string;
  status: "pendente" | "aprovado" | "recusado";
  motivo_recusa: string | null;
  nome: string;
  created_at: string;
};

export function useMinhaSolicitacao() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<MinhaSolicitacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setData(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data: row } = await supabase
        .from("solicitacoes_cadastro")
        .select("id, status, motivo_recusa, nome, created_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancel) return;
      setData((row as unknown as MinhaSolicitacao) ?? null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user, authLoading]);

  return { solicitacao: data, loading: loading || authLoading };
}
