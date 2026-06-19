import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SLUG_PREFIX = "personalizado";

function shortId(uid: string) {
  return uid.replace(/-/g, "").slice(0, 8);
}

async function ensureFeed(ctx: { supabase: any; userId: string }) {
  const desiredSlug = `${SLUG_PREFIX}-${shortId(ctx.userId)}`;
  const { data: existing } = await ctx.supabase
    .from("carteiras")
    .select("id, slug, nome, status")
    .eq("usuario_id", ctx.userId)
    .eq("slug", desiredSlug)
    .maybeSingle();
  if (existing) return existing;

  // fallback: try any carteira marcada como personalizada (caso slug antigo)
  const { data: anyPersonal } = await ctx.supabase
    .from("carteiras")
    .select("id, slug, nome, status")
    .eq("usuario_id", ctx.userId)
    .like("slug", `${SLUG_PREFIX}-%`)
    .limit(1)
    .maybeSingle();
  if (anyPersonal) return anyPersonal;

  const { data: created, error } = await ctx.supabase
    .from("carteiras")
    .insert({
      usuario_id: ctx.userId,
      nome: "Feed Personalizado",
      descricao: "Seleção manual de imóveis para o XML personalizado.",
      slug: desiredSlug,
      status: "ativa",
      atualizacao_intervalo: "on_demand",
    })
    .select("id, slug, nome, status")
    .single();
  if (error) throw error;
  return created;
}

export const getFeedPersonalizado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const feed = await ensureFeed(context);
    const { count } = await context.supabase
      .from("carteira_imoveis")
      .select("imovel_id", { count: "exact", head: true })
      .eq("carteira_id", feed.id);
    return { ...feed, total_imoveis: count ?? 0 };
  });

export const listFeedPersonalizadoIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const feed = await ensureFeed(context);
    const { data } = await context.supabase
      .from("carteira_imoveis")
      .select("imovel_id")
      .eq("carteira_id", feed.id);
    return { carteira_id: feed.id, imovel_ids: (data ?? []).map((r: any) => r.imovel_id as string) };
  });

export const setImovelInFeedPersonalizado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imovel_id: string; incluir: boolean }) => input)
  .handler(async ({ data, context }) => {
    const feed = await ensureFeed(context);
    if (data.incluir) {
      const { error } = await context.supabase
        .from("carteira_imoveis")
        .upsert(
          [{ carteira_id: feed.id, imovel_id: data.imovel_id }],
          { onConflict: "carteira_id,imovel_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("carteira_imoveis")
        .delete()
        .eq("carteira_id", feed.id)
        .eq("imovel_id", data.imovel_id);
      if (error) throw error;
    }
    await context.supabase
      .from("carteiras")
      .update({ ultima_atualizacao: new Date().toISOString() })
      .eq("id", feed.id);
    return { ok: true, carteira_id: feed.id };
  });

export const bulkSetFeedPersonalizado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imovel_ids: string[]; incluir: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!data.imovel_ids.length) return { ok: true, affected: 0 };
    const feed = await ensureFeed(context);
    if (data.incluir) {
      const rows = data.imovel_ids.map((id) => ({ carteira_id: feed.id, imovel_id: id }));
      const { error } = await context.supabase
        .from("carteira_imoveis")
        .upsert(rows, { onConflict: "carteira_id,imovel_id", ignoreDuplicates: true });
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("carteira_imoveis")
        .delete()
        .eq("carteira_id", feed.id)
        .in("imovel_id", data.imovel_ids);
      if (error) throw error;
    }
    await context.supabase
      .from("carteiras")
      .update({ ultima_atualizacao: new Date().toISOString() })
      .eq("id", feed.id);
    return { ok: true, affected: data.imovel_ids.length };
  });
