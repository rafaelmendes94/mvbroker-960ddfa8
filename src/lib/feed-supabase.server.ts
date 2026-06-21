// Cliente Supabase dedicado para feeds XML públicos.
// Robusto: aceita SUPABASE_* (Lovable Cloud / VPS) ou VITE_SUPABASE_* (fallback)
// e prefere SERVICE_ROLE quando disponível; senão cai para PUBLISHABLE/ANON.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Node 20 não tem WebSocket nativo — supabase-js v2 cria um RealtimeClient
// no construtor e quebra mesmo se a gente não usar realtime. Polyfill best-effort.
async function ensureWebSocket() {
  const g = globalThis as any;
  if (typeof g.WebSocket !== "undefined") return;
  try {
    const mod = await import("ws");
    g.WebSocket = (mod as any).WebSocket ?? (mod as any).default;
  } catch {
    // ws não instalado (runtime tipo Workers já tem WebSocket nativo)
  }
}

let _client: ReturnType<typeof createClient<Database>> | null = null;
let _missing: string | null = null;

export async function getFeedSupabase(): Promise<{
  client: ReturnType<typeof createClient<Database>> | null;
  error: string | null;
}> {
  if (_client) return { client: _client, error: null };
  if (_missing) return { client: null, error: _missing };

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    _missing = `Missing env: ${!url ? "SUPABASE_URL " : ""}${
      !key ? "SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PUBLISHABLE_KEY" : ""
    }`.trim();
    console.error("[feed-supabase]", _missing);
    return { client: null, error: _missing };
  }

  await ensureWebSocket();

  _client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { client: _client, error: null };
}
