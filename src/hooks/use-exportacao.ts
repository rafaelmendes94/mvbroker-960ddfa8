import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

type Item = { id: string; imovel_id: string };

let cache: Set<string> = new Set();
const listeners = new Set<(s: Set<string>) => void>();

function notify() {
  for (const l of listeners) l(new Set(cache));
}

export function useExportacao() {
  const [ids, setIds] = useState<Set<string>>(cache);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setLoading(true);
    const { data } = await supabase
      .from("exportacao_itens")
      .select("imovel_id")
      .eq("usuario_id", u.user.id);
    cache = new Set((data ?? []).map((d: any) => d.imovel_id));
    notify();
    setLoading(false);
  }, []);

  useEffect(() => {
    const sub = (s: Set<string>) => setIds(s);
    listeners.add(sub);
    if (cache.size === 0) load();
    return () => {
      listeners.delete(sub);
    };
  }, [load]);

  const add = useCallback(async (imovelId: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("exportacao_itens")
      .insert({ usuario_id: u.user.id, imovel_id: imovelId } as never);
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    cache.add(imovelId);
    notify();
    logAudit("imovel_atualizado", `Adicionado à exportação`, { imovel_id: imovelId });
    toast.success("Adicionado à exportação");
  }, []);

  const remove = useCallback(async (imovelId: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("exportacao_itens")
      .delete()
      .eq("usuario_id", u.user.id)
      .eq("imovel_id", imovelId);
    if (error) {
      toast.error(error.message);
      return;
    }
    cache.delete(imovelId);
    notify();
    logAudit("imovel_atualizado", `Removido da exportação`, { imovel_id: imovelId });
  }, []);

  const toggle = useCallback(
    async (imovelId: string) => {
      if (cache.has(imovelId)) await remove(imovelId);
      else await add(imovelId);
    },
    [add, remove],
  );

  const clear = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("exportacao_itens").delete().eq("usuario_id", u.user.id);
    cache.clear();
    notify();
  }, []);

  return { ids, has: (id: string) => ids.has(id), count: ids.size, add, remove, toggle, clear, reload: load, loading };
}

export type ExportacaoItem = Item;
