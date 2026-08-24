import { createFileRoute } from "@tanstack/react-router";

// Proxy público de imagens do Storage (buckets privados).
// Usado nos feeds XML: /api/public/img/<bucket>/<path...>
// Portais conseguem baixar a foto sem precisar de token.
export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const splat = (params as any)._splat as string | undefined;
          if (!splat) return new Response("Not found", { status: 404 });

          const clean = decodeURIComponent(splat).replace(/^\/+/, "");
          const [bucket, ...rest] = clean.split("/");
          const path = rest.join("/");
          const allowed = ["imoveis", "estrutura-imagens", "banco-imagens"];
          if (!bucket || !path || !allowed.includes(bucket)) {
            return new Response("Not found", { status: 404 });
          }

          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client } = getFeedSupabase();
          if (!client) return new Response("Unavailable", { status: 500 });

          // Faz o download pelo cliente do backend, sem depender de uma URL
          // assinada pública. Isso também funciona no storage autohospedado,
          // onde a URL interna pode não ser acessível pelo servidor da aplicação.
          const { data, error } = await client.storage.from(bucket).download(path);
          if (error || !data) return new Response("Not found", { status: 404 });

          return new Response(data.stream(), {
            status: 200,
            headers: {
              "Content-Type": data.type || "image/jpeg",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          console.error("[img-proxy]", e?.message || e);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
