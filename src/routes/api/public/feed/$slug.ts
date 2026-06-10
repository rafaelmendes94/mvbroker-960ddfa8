import { createFileRoute } from "@tanstack/react-router";
import { buildVRSyncXML } from "@/lib/feed-xml.server";

export const Route = createFileRoute("/api/public/feed/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const slug = params.slug.replace(/\.xml$/i, "");

        const { data: carteira, error: cErr } = await supabaseAdmin
          .from("carteiras")
          .select("id, nome, slug, status, updated_at")
          .eq("slug", slug)
          .maybeSingle();

        if (cErr || !carteira) {
          return new Response("Feed not found", { status: 404 });
        }
        if (carteira.status !== "ativa") {
          return new Response("Feed inactive", { status: 410 });
        }

        const { data: links } = await supabaseAdmin
          .from("carteira_imoveis")
          .select("imovel_id")
          .eq("carteira_id", carteira.id);

        const imovelIds = (links ?? []).map((l) => l.imovel_id);

        let imoveis: any[] = [];
        let imagens: any[] = [];
        if (imovelIds.length) {
          const [{ data: imovData }, { data: imgData }] = await Promise.all([
            supabaseAdmin
              .from("imoveis")
              .select("*")
              .in("id", imovelIds)
              .eq("arquivado", false)
              .in("status", ["disponivel", "reservado"]),
            supabaseAdmin
              .from("imovel_imagens")
              .select("imovel_id, url, storage_path, ordem, capa")
              .in("imovel_id", imovelIds),
          ]);
          imoveis = imovData ?? [];
          imagens = imgData ?? [];
        }

        const byImovel = new Map<string, any[]>();
        for (const img of imagens) {
          const arr = byImovel.get(img.imovel_id) ?? [];
          arr.push(img);
          byImovel.set(img.imovel_id, arr);
        }
        const enriched = imoveis.map((im) => ({ ...im, imagens: byImovel.get(im.id) ?? [] }));

        const xml = buildVRSyncXML({
          carteira: {
            nome: carteira.nome,
            slug: carteira.slug,
            updated_at: carteira.updated_at,
          },
          imoveis: enriched,
        });

        // Log leitura (fire-and-forget)
        const ua = request.headers.get("user-agent") ?? null;
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for") ??
          null;
        supabaseAdmin
          .from("feed_logs")
          .insert({
            carteira_id: carteira.id,
            acao: "feed_lido",
            detalhes: { imoveis: enriched.length } as never,
            ip,
            user_agent: ua,
          })
          .then(() => {});

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
