import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAssinatura } from "./use-assinatura";

/**
 * Indica se o usuário pode exportar imóveis.
 * Super_admin/secretaria sempre podem.
 * Demais perfis: precisa ter assinatura ativa em um plano com `permite_exportacao = true`.
 */
export function usePodeExportar() {
  const { assinatura, isAdmin, loading: loadingAssin } = useAssinatura();
  const [permite, setPermite] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loadingAssin) return;
    if (isAdmin) { setPermite(true); setLoading(false); return; }
    if (!assinatura?.plano_id) { setPermite(false); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("planos")
        .select("permite_exportacao")
        .eq("id", assinatura.plano_id)
        .maybeSingle();
      if (cancel) return;
      setPermite(!!(data as any)?.permite_exportacao);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [assinatura?.plano_id, isAdmin, loadingAssin]);

  return { podeExportar: permite ?? false, loading: loading || loadingAssin, isAdmin };
}
