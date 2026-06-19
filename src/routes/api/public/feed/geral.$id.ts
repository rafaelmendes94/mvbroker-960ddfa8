import { createFileRoute } from "@tanstack/react-router";
import { buildFeedXML } from "@/lib/feed-xml.server";
import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";

// Feed geral: todos os imóveis liberados para exportação do usuário/imobiliária.
// $id pode ser user_id (created_by) ou imobiliaria_id — tentamos ambos.
export const Route = createFileRoute("/api/public/feed/geral/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const id = params.id.replace(/\.xml$/i, "");

        // Busca imóveis: created_by = id OR imobiliaria_id = id
        const { data: imovData, error: imErr } = await supabaseAdmin
          .from("imoveis")
          .select(IMOVEL_PUBLIC_COLUMNS)
          .or(`created_by.eq.${id},imobiliaria_id.eq.${id}`)
          .eq("arquivado", false)
          .eq("exportacao_liberada", true);

        if (imErr) return new Response(`Erro: ${imErr.message}`, { status: 500 });
        const imoveis = (imovData ?? []).filter((im: any) =>
          ["disponivel", "reservado"].includes(im.status_imovel ?? im.status),
        );

        let imagens: any[] = [];
        if (imoveis.length) {
          const ids = imoveis.map((i: any) => i.id);
          const { data: imgData } = await supabaseAdmin
            .from("imovel_imagens")
            .select("imovel_id, url, storage_path, ordem, capa")
            .in("imovel_id", ids);
          imagens = imgData ?? [];
        }

        const byImovel = new Map<string, any[]>();
        for (const img of imagens) {
          const arr = byImovel.get(img.imovel_id) ?? [];
          arr.push(img);
          byImovel.set(img.imovel_id, arr);
        }
        const enriched = imoveis.map((im: any) => ({ ...im, imagens: byImovel.get(im.id) ?? [] }));

        const xml = buildFeedXML({
          carteira: {
            nome: "Feed Geral",
            slug: `geral-${id}`,
            updated_at: new Date().toISOString(),
          },
          imoveis: enriched,
        });

        const ua = request.headers.get("user-agent") ?? null;
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for") ??
          null;
        supabaseAdmin
          .from("feed_logs")
          .insert({
            carteira_id: null,
            acao: "feed_geral_lido",
            detalhes: { imoveis: enriched.length, scope_id: id } as never,
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
