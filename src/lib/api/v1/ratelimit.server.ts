// Rate limit e logging da API — persistidos no banco (o worker é stateless).
import { getFeedSupabase } from "@/lib/feed-supabase.server";
import type { Principal } from "./auth.server";

export type RateInfo = { limit: number; remaining: number; reset: number };

function db(): any {
  const { client } = getFeedSupabase();
  return client as any;
}

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Conta as chamadas da última hora dessa credencial. Nunca lança. */
export async function checkRateLimit(principal: Principal): Promise<RateInfo> {
  const limit = principal.rateLimitPerHour;
  const reset = Math.floor(Date.now() / 1000) + 3600;
  if (principal.kind !== "integration" || !principal.apiKeyId) {
    return { limit, remaining: limit, reset };
  }
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db()
      .from("api_logs")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", principal.apiKeyId)
      .gte("created_at", since);
    const used = count ?? 0;
    return { limit, remaining: Math.max(0, limit - used), reset };
  } catch {
    return { limit, remaining: limit, reset };
  }
}

export type LogEntry = {
  requestId: string;
  principal: Principal | null;
  endpoint: string;
  method: string;
  statusCode: number;
  errorCode?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  responseTimeMs: number;
};

/** Registra a chamada. Nunca guarda a chave em texto puro. Nunca lança. */
export async function logApiRequest(entry: LogEntry): Promise<void> {
  try {
    const client = db();
    if (!client) return;
    await client.from("api_logs").insert({
      request_id: entry.requestId,
      api_key_id: entry.principal?.apiKeyId ?? null,
      user_id: entry.principal?.userId ?? null,
      agency_id: entry.principal?.agencyId ?? null,
      environment: entry.principal?.environment ?? "live",
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.statusCode,
      error_code: entry.errorCode ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent?.slice(0, 400) ?? null,
      response_time_ms: entry.responseTimeMs,
    });
    if (entry.principal?.apiKeyId) {
      await client
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", entry.principal.apiKeyId);
    }
  } catch {
    /* logging nunca derruba a requisição */
  }
}
