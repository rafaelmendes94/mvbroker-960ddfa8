import { createFileRoute } from "@tanstack/react-router";

// Rota compatível com portais que exigem extensão .jpg:
//   /api/public/img-jpg/<bucket>/<path...>            -> igual a ?format=jpg
//   /api/public/img-jpg/<bucket>/<path...>.webp.jpg   -> remove o ".jpg" artificial
// Sempre entrega JPEG quando o original é webp/avif/heic/heif.
const serve = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const url = new URL(request.url);
  let pathname = url.pathname.replace("/api/public/img-jpg/", "/api/public/img/");

  // Remove apenas o sufixo artificial ".jpg" quando existe outra extensão antes.
  const artificial = pathname.match(/\.(webp|avif|heic|heif)\.jpg$/i);
  if (artificial) pathname = pathname.slice(0, -4);

  url.pathname = pathname;
  url.searchParams.set("format", "jpg");

  let splat = params._splat ?? "";
  if (/\.(webp|avif|heic|heif)\.jpg$/i.test(splat)) splat = splat.slice(0, -4);

  const { Route: ImgRoute } = await import("../img/$");
  const handlers: any = (ImgRoute as any).options.server.handlers;
  const handler = request.method === "HEAD" ? handlers.HEAD : handlers.GET;
  return handler({
    request: new Request(url.toString(), { method: request.method, headers: request.headers }),
    params: { _splat: splat },
  });
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
