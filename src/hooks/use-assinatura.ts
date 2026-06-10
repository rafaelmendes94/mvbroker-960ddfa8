import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useRoles } from "./use-roles";

export type MinhaAssinatura = {
  assinatura_id: string;
  plano_id: string;
  plano_nome: string;
  status: "ativa" | "bloqueada" | "cancelada" | "trial";
  ciclo: "mensal" | "anual";
  valor: number;
  proximo_vencimento: string | null;
  bloqueio_motivo: string | null;
  titular: "individual" | "imobiliaria";
};

export function useAssinatura() {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  const [data, setData] = useState<MinhaAssinatura | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles.includes("super_admin") || roles.includes("secretaria");

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user || isAdmin) { setData(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data: rows } = await supabase.rpc("get_minha_assinatura");
      if (cancel) return;
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      setData((row as unknown as MinhaAssinatura) ?? null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user, authLoading, rolesLoading, isAdmin]);

  // bloqueado se: tem assinatura e status != ativa/trial OU não tem assinatura nenhuma
  const bloqueado = !isAdmin && (!data || (data.status !== "ativa" && data.status !== "trial"));

  return { assinatura: data, loading: loading || authLoading || rolesLoading, isAdmin, bloqueado };
}
