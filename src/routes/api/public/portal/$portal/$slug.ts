import { createFileRoute } from "@tanstack/react-router";
import { buildFeedXML } from "@/lib/feed-xml.server";
import { applyRegrasToQuery } from "@/lib/feed-regras.server";

export const Route = createFileRoute("/api/public/portal/$portal/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const slug = params.slug.replace(/\.xml$/i, "");
        const portalSlug = params.portal;

        const [{ data: carteira }, { data: portal }] = await Promise.all([
          supabaseAdmin.from("carteiras")
            .select("id, nome, slug, status, updated_at, regra_filtros, limite_imoveis, marca_dagua")
            .eq("slug", slug).maybeSingle(),
          supabaseAdmin.from("portais")
            .select("id, slug, nome, formato_xml, ativo").eq("slug", portalSlug).maybeSingle(),
        ]);

        if (!carteira) return new Response("Feed not found", { status: 404 });
        if (carteira.status !== "ativa") return new Response("Feed inactive", { status: 410 });
        if (!portal || !portal.ativo) return new Response("Portal not found", { status: 404 });

        // verifica conexão e status
        const { data: cp } = await supabaseAdmin
          .from("carteira_portais")
          .select("id, ativo")
          .eq("carteira_id", carteira.id).eq("portal_id", portal.id).maybeSingle();
        if (!cp || !cp.ativo) return new Response("Portal not connected to this carteira", { status: 403 });

        const { data: links } = await supabaseAdmin
          .from("carteira_imoveis").select("imovel_id").eq("carteira_id", carteira.id);
        const imovelIds = (links ?? []).map((l) => l.imovel_id);

        let imoveis: any[] = [];
        let imagens: any[] = [];
        if (imovelIds.length) {
          let q = supabaseAdmin.from("imoveis").select("*").in("id", imovelIds).eq("arquivado", false);
          q = applyRegrasToQuery(q, (carteira.regra_filtros as any) ?? {});
          if (carteira.limite_imoveis) q = q.limit(carteira.limite_imoveis);
          const [{ data: imovData }, { data: imgData }] = await Promise.all([
            q,
            supabaseAdmin.from("imovel_imagens").select("imovel_id, url, storage_path, ordem, capa").in("imovel_id", imovelIds),
          ]);
          imoveis = (imovData ?? []).filter((im: any) => ["disponivel", "reservado"].includes(im.status));
          imagens = imgData ?? [];
        }

        const byImovel = new Map<string, any[]>();
        for (const img of imagens) {
          const arr = byImovel.get(img.imovel_id) ?? [];
          arr.push(img); byImovel.set(img.imovel_id, arr);
        }
        const enriched = imoveis.map((im) => ({ ...im, imagens: byImovel.get(im.id) ?? [] }));

        const xml = buildFeedXML({
          carteira: { nome: carteira.nome, slug: carteira.slug, updated_at: carteira.updated_at },
          imoveis: enriched,
          portal: { slug: portal.slug, nome: portal.nome, formato_xml: portal.formato_xml },
        });

        const ua = request.headers.get("user-agent") ?? null;
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;

        // Update stats e log fire-and-forget
        Promise.all([
          supabaseAdmin.from("feed_logs").insert({
            carteira_id: carteira.id,
            acao: "feed_lido",
            detalhes: { imoveis: enriched.length, portal: portal.slug } as never,
            ip, user_agent: ua,
          }),
          supabaseAdmin.rpc as any,
        ]).then(() => {});

        supabaseAdmin.from("carteira_portais").update({
          ultima_leitura: new Date().toISOString(),
          total_leituras: ((cp as any).total_leituras ?? 0) + 1,
          status_sincronizacao: "ok",
          mensagem_erro: null,
        }).eq("id", cp.id).then(() => {});

        return new Response(xml, {
          status: 200,
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=60" },
        });
      },
    },
  },
});
