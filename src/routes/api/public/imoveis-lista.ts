import { createFileRoute } from "@tanstack/react-router";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/imoveis-lista")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const idsParam = url.searchParams.get("ids") || "";
          const ids = idsParam
            .split(",")
            .map((s) => s.trim())
            .filter((s) => UUID_RE.test(s))
            .slice(0, 60);
          if (!ids.length) {
            return new Response(JSON.stringify({ items: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client: supabase, error: envErr } = getFeedSupabase();
          if (!supabase) {
            return new Response(JSON.stringify({ error: envErr ?? "config" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: imoveis } = await supabase
            .from("imoveis")
            .select(
              "id, codigo_interno, titulo, preco, bairro, cidade, estado, dormitorios, banheiros, vagas, area_privativa, area_total",
            )
            .in("id", ids)
            .eq("arquivado", false);

          const { data: imgs } = await supabase
            .from("imovel_imagens")
            .select("imovel_id, storage_path, url, ordem, capa")
            .in("imovel_id", ids)
            .order("capa", { ascending: false })
            .order("ordem", { ascending: true });

          const coverByImovel: Record<string, string> = {};
          const paths: string[] = [];
          const pathToImovel: Record<string, string> = {};
          for (const im of imgs ?? []) {
            if (coverByImovel[(im as any).imovel_id]) continue;
            const p = (im as any).storage_path || (im as any).url;
            if (!p) continue;
            if (String(p).startsWith("http")) {
              coverByImovel[(im as any).imovel_id] = p;
            } else {
              paths.push(p);
              pathToImovel[p] = (im as any).imovel_id;
            }
          }
          if (paths.length) {
            const { data: signed } = await supabase.storage
              .from("imoveis")
              .createSignedUrls(paths, 60 * 60 * 24);
            (signed || []).forEach((s: any) => {
              if (s?.path && s?.signedUrl) {
                const imId = pathToImovel[s.path];
                if (imId && !coverByImovel[imId]) coverByImovel[imId] = s.signedUrl;
              }
            });
          }

          const items = (imoveis ?? []).map((im: any) => ({
            ...im,
            cover: coverByImovel[im.id] || null,
          }));
          // preserve input order
          const orderIdx: Record<string, number> = {};
          ids.forEach((id, i) => (orderIdx[id] = i));
          items.sort((a, b) => (orderIdx[a.id] ?? 0) - (orderIdx[b.id] ?? 0));

          return new Response(JSON.stringify({ items }), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "internal" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
