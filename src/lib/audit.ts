import { supabase } from "@/integrations/supabase/client";

export type AuditEvento =
  | "login"
  | "logout"
  | "perfil_alterado"
  | "usuario_criado"
  | "usuario_inativado";

export async function logAudit(evento: AuditEvento, descricao?: string, metadata?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("auditoria_acessos").insert({
      user_id: data.user.id,
      evento,
      descricao: descricao ?? null,
      metadata: (metadata ?? null) as never,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // silencioso
  }
}
