// Helpers server-only para solicitações de cadastro.
import type { SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppSupabaseClient = SupabaseClient<Database>;
type RealtimeTransport = NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"];

export type AuthedContext = {
  supabase: AppSupabaseClient;
  userId: string;
};

async function getWsTransport() {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  try {
    const ws = await import("ws");
    return (ws.default ?? ws.WebSocket ?? ws) as unknown as RealtimeTransport;
  } catch {
    return undefined;
  }
}

export async function createNodeSafeSupabaseClient(key: string, token?: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !key) {
    throw new Error("Configuração do servidor incompleta (Supabase).");
  }
  const transport = await getWsTransport();
  return createClient<Database>(SUPABASE_URL, key, {
    ...(transport ? { realtime: { transport } } : {}),
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function getAuthedContext(token: string): Promise<AuthedContext> {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Configuração do servidor incompleta (chave pública).");
  if (!token) throw new Error("Não autorizado.");

  const supabase = await createNodeSafeSupabaseClient(key, token);

  let userId: string | undefined;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) userId = data.claims.sub as string;
  } catch {
    // fallback abaixo
  }
  if (!userId) {
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user?.id) throw new Error("Não autorizado.");
    userId = u.user.id;
  }
  return { supabase, userId };
}

export async function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Configuração do servidor incompleta (service role).");
  return createNodeSafeSupabaseClient(key);
}

export async function assertAdmin(ctx: AuthedContext) {
  const { data: isSuper } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (isSuper) return;
  const { data: isSec } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "secretaria",
  });
  if (!isSec) throw new Error("Acesso negado: apenas Super Admin ou Secretária.");
}
