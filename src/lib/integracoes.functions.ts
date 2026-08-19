import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Resolve a imobiliária do usuário (null = credencial global de administrador). */
async function resolveAgency(supabase: any, userId: string) {
  const [{ data: roleRows }, { data: owned }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("imobiliarias").select("id").eq("owner_id", userId).maybeSingle(),
  ]);
  const roles: string[] = (roleRows ?? []).map((r: any) => r.role);
  return { isAdmin: roles.includes("super_admin"), agencyId: owned?.id ?? null };
}

// ============ API KEYS ============
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("api_keys")
      .select("id, name, key_prefix, permissions, active, expires_at, last_used_at, rate_limit, agency_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; permissions: string[]; expires_at?: string | null }) => {
    if (!input?.name?.trim()) throw new Error("Informe um nome para a chave");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { randomBytes, createHash } = await import("crypto");
    const { agencyId, isAdmin } = await resolveAgency(context.supabase, context.userId);
    if (!isAdmin && !agencyId) throw new Error("Somente administradores ou imobiliárias podem criar chaves");

    const raw = `mvb_live_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(raw).digest("hex");

    const { data: row, error } = await (context.supabase as any)
      .from("api_keys")
      .insert({
        agency_id: agencyId,
        name: data.name.trim(),
        key_prefix: raw.slice(0, 16),
        key_hash: keyHash,
        permissions: data.permissions?.length ? data.permissions : ["developments:read", "typologies:read", "units:read", "offers:read"],
        expires_at: data.expires_at || null,
        created_by: context.userId,
      })
      .select("id, name, key_prefix, permissions, active, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    // A chave em texto puro é retornada uma única vez.
    return { ...row, key: raw };
  });

export const setApiKeyActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("api_keys").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ WEBHOOKS ============
export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("webhooks")
      .select("id, name, url, events, active, last_delivery_at, failure_count, secret, agency_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; url: string; events: string[] }) => {
    if (!input?.name?.trim()) throw new Error("Informe um nome");
    if (!/^https?:\/\/.+/i.test(input?.url ?? "")) throw new Error("Informe uma URL válida (https://...)");
    if (!input.events?.length) throw new Error("Selecione ao menos um evento");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { randomBytes } = await import("crypto");
    const { agencyId, isAdmin } = await resolveAgency(context.supabase, context.userId);
    if (!isAdmin && !agencyId) throw new Error("Sem permissão para criar webhooks");

    const { data: row, error } = await (context.supabase as any)
      .from("webhooks")
      .insert({
        agency_id: agencyId,
        name: data.name.trim(),
        url: data.url.trim(),
        events: data.events,
        secret: `whsec_${randomBytes(24).toString("hex")}`,
        created_by: context.userId,
      })
      .select("id, name, url, events, active, secret, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setWebhookActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("webhooks").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    // Confirma que o usuário enxerga este webhook (RLS) antes de disparar.
    const { data: row } = await (context.supabase as any).from("webhooks").select("id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Webhook não encontrado");
    const { sendTestWebhook } = await import("@/lib/api/v1/webhooks.server");
    return sendTestWebhook(data.id);
  });

export const listWebhookDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { webhook_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("webhook_deliveries")
      .select("id, event, status, attempts, response_status, error, created_at")
      .eq("webhook_id", data.webhook_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
