import { supabase } from "@/integrations/supabase/client";

export type AuditEvento =
  | "login"
  | "logout"
  | "perfil_alterado"
  | "usuario_criado"
  | "usuario_inativado"
  | "edificio_criado" | "edificio_atualizado" | "edificio_excluido"
  | "condominio_criado" | "condominio_atualizado" | "condominio_excluido"
  | "empreendimento_criado" | "empreendimento_atualizado" | "empreendimento_excluido"
  | "loteamento_criado" | "loteamento_atualizado" | "loteamento_excluido"
  | "imagem_upload"
  | "imovel_criado" | "imovel_atualizado" | "imovel_excluido" | "imovel_duplicado" | "imovel_arquivado"
  | "imovel_upload" | "imovel_xml_publicado"
  | "acesso_negado" | "relatorio_visualizado";

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

/** Log granular por imóvel — também grava em imovel_logs para histórico no cadastro. */
export async function logImovel(
  imovelId: string,
  acao: string,
  descricao?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("imovel_logs").insert({
      imovel_id: imovelId,
      user_id: data.user?.id ?? null,
      acao,
      descricao: descricao ?? null,
      metadata: (metadata ?? null) as never,
    });
  } catch {
    // silencioso
  }
}

// ============== Novo log central (audit_logs) ==============

export type LogStatus = "sucesso" | "erro" | "negado" | "alerta";

export async function logAction(opts: {
  modulo: string;
  acao: string;
  registro_tipo?: string | null;
  registro_id?: string | null;
  status?: LogStatus;
  descricao?: string;
  dados_anteriores?: unknown;
  dados_novos?: unknown;
}) {
  try {
    await supabase.rpc("log_action", {
      p_modulo: opts.modulo,
      p_acao: opts.acao,
      p_registro_tipo: opts.registro_tipo ?? undefined,
      p_registro_id: (opts.registro_id ?? undefined) as never,
      p_status: opts.status ?? "sucesso",
      p_descricao: opts.descricao ?? undefined,
      p_dados_anteriores: (opts.dados_anteriores ?? undefined) as never,
      p_dados_novos: (opts.dados_novos ?? undefined) as never,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  } catch {
    // silencioso
  }
}

export async function createSecurityAlert(opts: {
  tipo: string;
  severidade?: "baixa" | "media" | "alta" | "critica";
  descricao: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("create_security_alert", {
      p_tipo: opts.tipo,
      p_severidade: opts.severidade ?? "media",
      p_descricao: opts.descricao,
      p_metadata: (opts.metadata ?? {}) as never,
    });
  } catch {
    // silencioso
  }
}

export async function registerSession() {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const device =
      /Mobi|Android/i.test(ua) ? "Mobile" :
      /Tablet|iPad/i.test(ua) ? "Tablet" : "Desktop";
    await supabase.from("active_sessions").insert({
      usuario_id: data.user.id,
      user_agent: ua,
      device,
      last_seen: new Date().toISOString(),
    });
  } catch {
    // silencioso
  }
}

export async function heartbeatSession(sessionId: string) {
  try {
    await supabase.from("active_sessions")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", sessionId);
  } catch {
    // silencioso
  }
}
