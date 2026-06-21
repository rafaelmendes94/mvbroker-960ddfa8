import { createFileRoute } from "@tanstack/react-router";
import { buildFeedXML } from "@/lib/feed-xml.server";
import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { applyRegrasToQuery } from "@/lib/feed-regras.server";

export const Route = createFileRoute("/api/public/feed/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client: supabase, error: envErr } = await getFeedSupabase();
          if (!supabase) {
            console.error("[feed/slug] env error:", envErr);
            return new Response(`Feed unavailable: ${envErr ?? "config error"}`, {
              status: 500,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          const slug = params.slug.replace(/\.xml$/i, "");

          const { data: carteira, error: cErr } = await supabase
            .from("carteiras")
            .select("id, nome, slug, status, updated_at, regra_filtros, limite_imoveis, marca_dagua")
            .eq("slug", slug)
            .maybeSingle();

          if (cErr) {
            console.error("[feed/slug] carteira error:", cErr.message);
            return new Response("Feed unavailable", { status: 500 });
          }
          if (!carteira) return new Response("Feed not found", { status: 404 });
          if (carteira.status !== "ativa") return new Response("Feed inactive", { status: 410 });

          const { data: links } = await supabase
            .from("carteira_imoveis").select("imovel_id").eq("carteira_id", carteira.id);
          const imovelIds = (links ?? []).map((l) => l.imovel_id);

          let imoveis: any[] = [];
          let imagens: any[] = [];
          if (imovelIds.length) {
            let q = supabase.from("imoveis").select(IMOVEL_PUBLIC_COLUMNS).in("id", imovelIds).eq("arquivado", false);
            q = applyRegrasToQuery(q, (carteira.regra_filtros as any) ?? {});
            if (carteira.limite_imoveis) q = q.limit(carteira.limite_imoveis);
            const [{ data: imovData }, { data: imgData }] = await Promise.all([
              q,
              supabase.from("imovel_imagens").select("imovel_id, url, storage_path, ordem, capa").in("imovel_id", imovelIds),
            ]);
            imoveis = (imovData ?? []).filter((im: any) => ["disponivel", "reservado"].includes(im.status));
            imagens = imgData ?? [];
          }

          const byImovel = new Map<string, any[]>();
          for (const img of imagens) {
            const arr = byImovel.get(img.imovel_id) ?? [];
            arr.push(img);
            byImovel.set(img.imovel_id, arr);
          }
          const enriched = imoveis.map((im) => ({ ...im, imagens: byImovel.get(im.id) ?? [] }));

          const xml = buildFeedXML({
            carteira: { nome: carteira.nome, slug: carteira.slug, updated_at: carteira.updated_at },
            imoveis: enriched,
          });

          const ua = request.headers.get("user-agent") ?? null;
          const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;
          supabase.from("feed_logs").insert({
            carteira_id: carteira.id,
            acao: "feed_lido",
            detalhes: { imoveis: enriched.length, portal: "universal" } as never,
            ip, user_agent: ua,
          }).then(() => {});

          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          console.error("[feed/slug] unexpected:", e?.message || e);
          return new Response(`Feed unavailable: ${e?.message ?? "internal error"}`, {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
