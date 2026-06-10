import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPortais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portais")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const upsertPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    slug: string;
    nome: string;
    descricao?: string;
    logo_url?: string;
    cor?: string;
    site_url?: string;
    formato_xml?: string;
    instrucoes?: string;
    ordem?: number;
    ativo?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!ok) throw new Error("Forbidden");
    const { id, ...rest } = data;
    const payload: any = { ...rest, formato_xml: rest.formato_xml ?? "vrsync" };
    if (id) {
      const { error } = await context.supabase.from("portais").update(payload).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: created, error } = await context.supabase.from("portais").insert(payload).select().single();
    if (error) throw error;
    return created;
  });

export const deletePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!ok) throw new Error("Forbidden");
    const { error } = await context.supabase.from("portais").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============== Carteira ↔ Portais ==============

export const listCarteiraPortais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("carteira_portais")
      .select("*, portais(*)")
      .eq("carteira_id", data.carteira_id);
    if (error) throw error;
    return rows ?? [];
  });

export const conectarPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string; portal_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("carteira_portais")
      .upsert(
        { carteira_id: data.carteira_id, portal_id: data.portal_id, ativo: true, status_sincronizacao: "pendente" },
        { onConflict: "carteira_id,portal_id" }
      );
    if (error) throw error;
    await context.supabase.from("feed_logs").insert({
      carteira_id: data.carteira_id,
      acao: "portal_conectado",
      detalhes: { portal_id: data.portal_id } as never,
    });
    return { ok: true };
  });

export const desconectarPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string; portal_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("carteira_portais")
      .delete()
      .eq("carteira_id", data.carteira_id)
      .eq("portal_id", data.portal_id);
    if (error) throw error;
    await context.supabase.from("feed_logs").insert({
      carteira_id: data.carteira_id,
      acao: "portal_desconectado",
      detalhes: { portal_id: data.portal_id } as never,
    });
    return { ok: true };
  });

export const togglePortalAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; ativo: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("carteira_portais")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============== Compartilhamentos ==============

export const listCompartilhamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("carteira_compartilhamentos")
      .select("id, usuario_id, permissao, created_at, profiles:usuario_id(full_name, email)")
      .eq("carteira_id", data.carteira_id);
    if (error) throw error;
    return rows ?? [];
  });

export const compartilharCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string; email: string; permissao: "leitura" | "edicao" }) => input)
  .handler(async ({ data, context }) => {
    // find user by email via profiles
    const { data: prof } = await context.supabase
      .from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (!prof) throw new Error("Usuário com este e-mail não encontrado");
    const { error } = await context.supabase
      .from("carteira_compartilhamentos")
      .upsert(
        { carteira_id: data.carteira_id, usuario_id: prof.id, permissao: data.permissao },
        { onConflict: "carteira_id,usuario_id" }
      );
    if (error) throw error;
    return { ok: true };
  });

export const removerCompartilhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("carteira_compartilhamentos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============== Regras / configurações da carteira ==============

export const updateRegrasCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    regra_filtros?: Record<string, any>;
    limite_imoveis?: number | null;
    marca_dagua?: boolean;
    visibilidade?: "privada" | "compartilhada" | "publica";
  }) => input)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("carteiras").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// ============== Estatísticas de sincronização ==============

export const getSyncStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string }) => input)
  .handler(async ({ data, context }) => {
    const now = Date.now();
    const since24h = new Date(now - 24 * 3600 * 1000).toISOString();
    const since7d = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const since30d = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

    const counts = await Promise.all([
      context.supabase.from("feed_logs").select("id", { count: "exact", head: true })
        .eq("carteira_id", data.carteira_id).eq("acao", "feed_lido").gte("created_at", since24h),
      context.supabase.from("feed_logs").select("id", { count: "exact", head: true })
        .eq("carteira_id", data.carteira_id).eq("acao", "feed_lido").gte("created_at", since7d),
      context.supabase.from("feed_logs").select("id", { count: "exact", head: true })
        .eq("carteira_id", data.carteira_id).eq("acao", "feed_lido").gte("created_at", since30d),
    ]);

    return {
      leituras_24h: counts[0].count ?? 0,
      leituras_7d: counts[1].count ?? 0,
      leituras_30d: counts[2].count ?? 0,
    };
  });
