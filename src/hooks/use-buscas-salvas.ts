import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BuscaSalva = { id: string; nome: string; filtros_json: any; created_at: string };

export function useBuscasSalvas() {
  const [items, setItems] = useState<BuscaSalva[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setLoading(true);
    const { data } = await supabase.from("buscas_salvas").select("*").eq("usuario_id", u.user.id).order("created_at", { ascending: false });
    setItems((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (nome: string, filtros: any) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("buscas_salvas").insert({ usuario_id: u.user.id, nome, filtros_json: filtros } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Busca salva");
    load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("buscas_salvas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }, [load]);

  return { items, loading, save, remove, reload: load };
}
