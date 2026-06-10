import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Increments view counter for a property — only once per browser session
 * per property. Used by PUBLIC pages only (not admin/broker management views).
 */
export function trackPropertyView(id?: string | null) {
  if (!id || !UUID_RE.test(id)) return;
  try {
    const key = `imovel-view:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage may be unavailable (private mode, SSR) — continue anyway
  }
  // fire-and-forget
  supabase.rpc("increment_imovel_views", { imovel_id: id }).then(({ error }) => {
    if (error) console.warn("[views] increment failed:", error.message);
  });
}
