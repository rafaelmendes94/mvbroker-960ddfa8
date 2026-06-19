import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const getFeedGeralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Prefere imobiliária do usuário (owner); senão usa o próprio user_id
    const { data: imob } = await context.supabase
      .from("imobiliarias")
      .select("id, nome_fantasia")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (imob) return { id: imob.id, escopo: "imobiliaria" as const, nome: imob.nome_fantasia };
    return { id: context.userId, escopo: "usuario" as const, nome: null };
  });

export const listCarteiras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("carteiras")
      .select("*, carteira_imoveis(count)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      ...c,
      total_imoveis: c.carteira_imoveis?.[0]?.count ?? 0,
    }));
  });

export const getCarteira = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: carteira, error } = await context.supabase
      .from("carteiras")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return carteira;
  });

export const createCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; descricao?: string; atualizacao_intervalo?: string }) => input)
  .handler(async ({ data, context }) => {
    const base = slugify(data.nome) || "carteira";
    // ensure uniqueness
    let slug = base;
    let i = 1;
    while (true) {
      const { data: exists } = await context.supabase
        .from("carteiras").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      i += 1;
      slug = `${base}-${i}`;
    }
    const { data: created, error } = await context.supabase
      .from("carteiras")
      .insert({
        usuario_id: context.userId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        slug,
        status: "ativa",
        atualizacao_intervalo: data.atualizacao_intervalo ?? "on_demand",
      })
      .select()
      .single();
    if (error) throw error;
    return created;
  });

export const updateCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; nome?: string; descricao?: string; status?: string; atualizacao_intervalo?: string }) => input)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("carteiras").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("carteiras").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listCarteiraItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("carteira_imoveis")
      .select("id, imovel_id, created_at, imoveis(id, codigo_interno, titulo, preco, cidade, bairro, status, tipo, dormitorios, banheiros, area_privativa)")
      .eq("carteira_id", data.carteira_id);
    if (error) throw error;
    return items ?? [];
  });

export const addCarteiraItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string; imovel_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    if (!data.imovel_ids.length) return { added: 0 };
    const rows = data.imovel_ids.map((imovel_id) => ({
      carteira_id: data.carteira_id,
      imovel_id,
    }));
    const { error } = await context.supabase
      .from("carteira_imoveis")
      .upsert(rows, { onConflict: "carteira_id,imovel_id", ignoreDuplicates: true });
    if (error) throw error;
    await context.supabase
      .from("carteiras")
      .update({ ultima_atualizacao: new Date().toISOString() })
      .eq("id", data.carteira_id);
    await context.supabase.from("feed_logs").insert({
      carteira_id: data.carteira_id,
      acao: "itens_adicionados",
      detalhes: { count: data.imovel_ids.length } as never,
    });
    return { added: data.imovel_ids.length };
  });

export const removeCarteiraItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string; imovel_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    if (!data.imovel_ids.length) return { removed: 0 };
    const { error } = await context.supabase
      .from("carteira_imoveis")
      .delete()
      .eq("carteira_id", data.carteira_id)
      .in("imovel_id", data.imovel_ids);
    if (error) throw error;
    await context.supabase
      .from("carteiras")
      .update({ ultima_atualizacao: new Date().toISOString() })
      .eq("id", data.carteira_id);
    await context.supabase.from("feed_logs").insert({
      carteira_id: data.carteira_id,
      acao: "itens_removidos",
      detalhes: { count: data.imovel_ids.length } as never,
    });
    return { removed: data.imovel_ids.length };
  });

export const getFeedLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: logs } = await context.supabase
      .from("feed_logs")
      .select("*")
      .eq("carteira_id", data.carteira_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return logs ?? [];
  });
