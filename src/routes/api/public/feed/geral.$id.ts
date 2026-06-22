import { createFileRoute } from "@tanstack/react-router";
import { buildFeedXML } from "@/lib/feed-xml.server";
import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";

// Feed geral: todos os imóveis liberados para exportação do usuário/imobiliária.
// $id pode ser user_id (created_by) ou imobiliaria_id — tentamos ambos.
export const Route = createFileRoute("/api/public/feed/geral/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client: supabase, error: envErr } = await getFeedSupabase();
          if (!supabase) {
            console.error("[feed/geral] env error:", envErr);
            return new Response(`Feed unavailable: ${envErr ?? "config error"}`, {
              status: 500,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          const id = params.id.replace(/\.xml$/i, "");

          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            return new Response("Bad Request", { status: 400 });
          }

          const { data: imovData, error: imErr } = await supabase
            .from("imoveis")
            .select(IMOVEL_PUBLIC_COLUMNS)
            .or(`created_by.eq.${id},imobiliaria_id.eq.${id}`)
            .eq("arquivado", false)
            .eq("exportacao_liberada", true);

          if (imErr) {
            console.error("[feed/geral] DB error:", imErr.message);
            return new Response("Feed unavailable", {
              status: 500,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
          const imoveis = (imovData ?? []).filter((im: any) =>
            ["disponivel", "reservado"].includes(im.status_imovel ?? im.status),
          );

          let imagens: any[] = [];
          if (imoveis.length) {
            const ids = imoveis.map((i: any) => i.id);
            const { data: imgData } = await supabase
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

          // Buscar nomes de edifício e condomínio
          const edifIds = Array.from(new Set(imoveis.map((i: any) => i.edificio_id).filter(Boolean)));
          const condIds = Array.from(new Set(imoveis.map((i: any) => i.condominio_id).filter(Boolean)));
          const [edifRes, condRes] = await Promise.all([
            edifIds.length ? supabase.from("edificios").select("id, nome").in("id", edifIds) : Promise.resolve({ data: [] as any[] }),
            condIds.length ? supabase.from("condominios").select("id, nome").in("id", condIds) : Promise.resolve({ data: [] as any[] }),
          ]);
          const edifMap = new Map((edifRes.data ?? []).map((e: any) => [e.id, e.nome]));
          const condMap = new Map((condRes.data ?? []).map((c: any) => [c.id, c.nome]));

          const enriched = imoveis.map((im: any) => ({
            ...im,
            imagens: byImovel.get(im.id) ?? [],
            edificio_nome: im.edificio_id ? edifMap.get(im.edificio_id) ?? null : null,
            condominio_nome: im.condominio_id ? condMap.get(im.condominio_id) ?? null : null,
          }));

          const xml = buildFeedXML({
            carteira: {
              nome: "Feed Geral",
              slug: `geral-${id}`,
              updated_at: new Date().toISOString(),
            },
            imoveis: enriched,
            storageBaseUrl: `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/storage/v1/object/public/imoveis`,
          });


          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          console.error("[feed/geral] unexpected:", e?.message || e);
          return new Response(`Feed unavailable: ${e?.message ?? "internal error"}`, {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
