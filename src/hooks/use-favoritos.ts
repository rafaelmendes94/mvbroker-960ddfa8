import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let cache: Set<string> = new Set();
const listeners = new Set<(s: Set<string>) => void>();
function notify() { for (const l of listeners) l(new Set(cache)); }

export function useFavoritos() {
  const [ids, setIds] = useState<Set<string>>(cache);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("imoveis_favoritos").select("imovel_id").eq("usuario_id", u.user.id);
    cache = new Set((data ?? []).map((d: any) => d.imovel_id));
    notify();
  }, []);

  useEffect(() => {
    const sub = (s: Set<string>) => setIds(s);
    listeners.add(sub);
    if (cache.size === 0) load();
    return () => { listeners.delete(sub); };
  }, [load]);

  const toggle = useCallback(async (imovelId: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (cache.has(imovelId)) {
      await supabase.from("imoveis_favoritos").delete().eq("usuario_id", u.user.id).eq("imovel_id", imovelId);
      cache.delete(imovelId);
    } else {
      const { error } = await supabase.from("imoveis_favoritos").insert({ usuario_id: u.user.id, imovel_id: imovelId } as never);
      if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
      cache.add(imovelId);
      toast.success("Favoritado");
    }
    notify();
  }, []);

  return { ids, has: (id: string) => ids.has(id), count: ids.size, toggle, reload: load };
}
