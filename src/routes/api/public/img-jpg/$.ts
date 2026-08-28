import { createFileRoute } from "@tanstack/react-router";

// Alias compatível: /api/public/img-jpg/<bucket>/<path...>
// Equivale a /api/public/img/<bucket>/<path...>?format=jpg
const serve = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace("/api/public/img-jpg/", "/api/public/img/");
  url.searchParams.set("format", "jpg");
  const { Route: ImgRoute } = await import("../img/$");
  const handlers: any = (ImgRoute as any).options.server.handlers;
  const handler = request.method === "HEAD" ? handlers.HEAD : handlers.GET;
  return handler({ request: new Request(url.toString(), { method: request.method, headers: request.headers }), params });
};

export const Route = createFileRoute("/api/public/img-jpg/$")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Accept, Content-Type, Range",
          },
        }),
      HEAD: serve,
      GET: serve,
    },
  },
});
