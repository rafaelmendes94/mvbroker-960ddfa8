import { createFileRoute } from "@tanstack/react-router";

// Proxy público de imagens do Storage (buckets privados).
// Usado nos feeds XML: /api/public/img/<bucket>/<path...>
// Portais conseguem baixar a foto sem precisar de token.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type, Range",
  "Access-Control-Max-Age": "86400",
} as const;

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
  });
}

const serveImage = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  try {
    const splat = params._splat;
    if (!splat) return textResponse("Not found", 404);

    let clean: string;
    try {
      clean = decodeURIComponent(splat).replace(/^\/+/, "");
    } catch {
      return textResponse("Not found", 404);
    }
    const [bucket, ...rest] = clean.split("/");
    const path = rest.join("/");
    const allowed = ["imoveis", "estrutura-imagens", "banco-imagens"];
    if (!bucket || !path || path.includes("..") || !allowed.includes(bucket)) {
      return textResponse("Not found", 404);
    }

    const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
    const { client } = getFeedSupabase();
    if (!client) return textResponse("Unavailable", 500);

    const { data, error } = await client.storage.from(bucket).download(path);
    if (error || !data) return textResponse("Not found", 404);

    const headers = {
      "Content-Type": data.type || "image/jpeg",
      "Content-Length": String(data.size),
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      ...CORS_HEADERS,
    };
    return new Response(request.method === "HEAD" ? null : data.stream(), { status: 200, headers });
  } catch (error) {
    console.error("[img-proxy]", error instanceof Error ? error.message : error);
    return textResponse("Error", 500);
  }
};

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      HEAD: serveImage,
      GET: serveImage,
    },
  },
});
