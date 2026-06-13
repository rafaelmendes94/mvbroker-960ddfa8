import type { SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type RealtimeTransport = NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"];

async function getWsTransport(): Promise<RealtimeTransport | undefined> {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  try {
    const ws = await import("ws");
    return (ws.default ?? (ws as unknown as { WebSocket?: unknown }).WebSocket ?? ws) as unknown as RealtimeTransport;
  } catch {
    return undefined;
  }
}

export async function createNodeSafeSupabaseClient(
  key: string,
  token?: string,
): Promise<SupabaseClient<Database>> {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !key) {
    const missing = [...(!SUPABASE_URL ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_KEY"] : [])];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }
  const transport = await getWsTransport();
  return createClient<Database>(SUPABASE_URL, key, {
    ...(transport ? { realtime: { transport } } : {}),
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getNodeSafeSupabaseAdmin(): Promise<SupabaseClient<Database>> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.");
  return createNodeSafeSupabaseClient(key);
}
