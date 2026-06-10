import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type NotifTipo =
  | "novo_imovel" | "imovel_atualizado" | "novo_exclusivo" | "novo_bonus"
  | "xml_atualizado" | "erro_xml" | "publicacao_aprovada" | "publicacao_rejeitada" | "sistema";

export type NotifCategoria = "imoveis" | "xml" | "portais" | "sistema";

export type Notificacao = {
  id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  tipo: NotifTipo;
  categoria: NotifCategoria;
  lida: boolean;
  link: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function useNotifications(limit = 50) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notificacao[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data ?? []) as Notificacao[]);
    const { data: count } = await supabase.rpc("contar_nao_lidas");
    setUnread((count as number) ?? 0);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    if (!user) return;
    reload();
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `usuario_id=eq.${user.id}` },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, reload]);

  const marcarLida = async (id: string) => {
    await supabase.rpc("marcar_notificacao_lida", { p_id: id });
    reload();
  };

  const marcarTodasLidas = async (categoria?: NotifCategoria) => {
    const args = categoria ? { p_categoria: categoria } : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)("marcar_todas_lidas", args);
    reload();
  };

  const excluir = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    reload();
  };

  return { items, unread, loading, reload, marcarLida, marcarTodasLidas, excluir };
}
