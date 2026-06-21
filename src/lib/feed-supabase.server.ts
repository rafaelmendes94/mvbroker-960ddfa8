import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import ws from "ws";

let _client: ReturnType<typeof createClient<Database>> | null = null;
let _missing: string | null = null;

export function getFeedSupabase(): { client: ReturnType<typeof createClient<Database>> | null; error: string | null } {
  if (_client) return { client: _client, error: null };
  if (_missing) return { client: null, error: _missing };

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    _missing = `Missing env: ${!url ? "SUPABASE_URL " : ""}${!key ? "SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PUBLISHABLE_KEY" : ""}`.trim();
    console.error("[feed-supabase]", _missing);
    return { client: null, error: _missing };
  }

  _client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    realtime: {
      // @ts-ignore ws polyfill obrigatório para Node.js < 22
      transport: ws,
    },
  });
  return { client: _client, error: null };
}
