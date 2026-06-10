import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CountQuery = { table: string; filter?: (q: any) => any };

export function useCounts(queries: Record<string, CountQuery>) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const entries = Object.entries(queries);
      const results = await Promise.all(
        entries.map(async ([, q]) => {
          let query: any = supabase.from(q.table as any).select("*", { count: "exact", head: true });
          if (q.filter) query = q.filter(query);
          const { count } = await query;
          return count ?? 0;
        })
      );
      if (cancelled) return;
      const out: Record<string, number> = {};
      entries.forEach(([k], i) => (out[k] = results[i]));
      setCounts(out);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { counts, loading };
}

export async function logRelatorioAccess(relatorio: string, filtros?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("auditoria_acessos").insert({
    user_id: user.id,
    evento: "relatorio_visualizado",
    descricao: relatorio,
    metadata: filtros ?? {},
  });
}
