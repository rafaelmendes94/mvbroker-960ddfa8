import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Escopo dos feeds XML:
 * - admin / super_admin / secretaria => feeds da EQUIPE (compartilhados, visibilidade = 'equipe')
 * - demais (corretor, imobiliária...) => feeds privados do próprio usuário
 */
async function getEscopo(context: any) {
  const { data } = await context.supabase.rpc("is_admin_staff", { _uid: context.userId });
  return data === true ? ("equipe" as const) : ("privada" as const);
}

/** Lista os feeds do escopo do usuário e marca em quais o imóvel já está. */
export const listFeedsDoImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imovel_id: string }) => input)
  .handler(async ({ data, context }) => {
    const escopo = await getEscopo(context);

    let q = context.supabase
      .from("carteiras")
      .select("id, nome, slug, visibilidade, usuario_id")
      .eq("visibilidade", escopo)
      .order("nome", { ascending: true });
    if (escopo === "privada") q = q.eq("usuario_id", context.userId);

    const { data: feeds, error } = await q;
    if (error) throw error;

    const ids = (feeds ?? []).map((f: any) => f.id);
    let marcados: string[] = [];
    if (ids.length) {
      const { data: itens } = await context.supabase
        .from("carteira_imoveis")
        .select("carteira_id")
        .eq("imovel_id", data.imovel_id)
        .in("carteira_id", ids);
      marcados = (itens ?? []).map((i: any) => i.carteira_id);
    }

    return {
      escopo,
      feeds: (feeds ?? []).map((f: any) => ({
        id: f.id,
        nome: f.nome,
        slug: f.slug,
        checked: marcados.includes(f.id),
      })),
    };
  });

/** Inclui/remove o imóvel de um feed. */
export const toggleImovelNoFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { carteira_id: string; imovel_id: string; incluir: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (data.incluir) {
      const { error } = await context.supabase
        .from("carteira_imoveis")
        .upsert({ carteira_id: data.carteira_id, imovel_id: data.imovel_id }, {
          onConflict: "carteira_id,imovel_id",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("carteira_imoveis")
        .delete()
        .eq("carteira_id", data.carteira_id)
        .eq("imovel_id", data.imovel_id);
      if (error) throw error;
    }
    await context.supabase
      .from("carteiras")
      .update({ ultima_atualizacao: new Date().toISOString() })
      .eq("id", data.carteira_id);
    return { ok: true, incluir: data.incluir };
  });

/** Cria um novo feed no escopo do usuário (equipe para staff, privado para clientes). */
export const criarFeedNoEscopo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string }) => input)
  .handler(async ({ data, context }) => {
    const nome = data.nome.trim().slice(0, 80);
    if (nome.length < 2) throw new Error("Informe um nome para o feed.");
    const escopo = await getEscopo(context);

    const base = slugify(nome) || "feed";
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
        nome,
        slug,
        status: "ativa",
        visibilidade: escopo,
        atualizacao_intervalo: "on_demand",
      })
      .select("id, nome, slug")
      .single();
    if (error) throw error;
    return created;
  });

/** Feeds fixos do sistema (por filtro automático) e se o imóvel se enquadra. */
export const statusFeedsSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imovel_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: im, error } = await context.supabase
      .from("imoveis")
      .select("id, tipo_imovel, condominio_id, loteamento_id, vista_mar, arquivado, exportacao_liberada, status_imovel")
      .eq("id", data.imovel_id)
      .maybeSingle();
    if (error) throw error;
    if (!im) throw new Error("Imóvel não encontrado.");

    const { count } = await context.supabase
      .from("imovel_imagens")
      .select("id", { count: "exact", head: true })
      .eq("imovel_id", data.imovel_id);

    const t = String(im.tipo_imovel ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const casaCond = t.includes("cond") || (/casa|sobrado|residencia/.test(t) && (!!im.condominio_id || !!im.loteamento_id));

    const st = String(im.status_imovel ?? "").toLowerCase();
    const elegivel = !im.arquivado && im.exportacao_liberada === true && ["disponivel", "reservado"].includes(st);

    return {
      elegivel,
      feeds: [
        { slug: "geral", nome: "XML Geral", url: "/api/public/feed/geral.xml", incluido: elegivel },
        { slug: "fotos", nome: "XML com Fotos", url: "/api/public/feed/fotos.xml", incluido: elegivel && (count ?? 0) > 0 },
        { slug: "vista-mar", nome: "XML Vista para o Mar", url: "/api/public/feed/vista-mar.xml", incluido: elegivel && im.vista_mar === true },
        { slug: "casa-condominio", nome: "XML Casa em Condomínio", url: "/api/public/feed/casa-condominio.xml", incluido: elegivel && casaCond },
      ],
    };
  });
