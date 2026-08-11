import { createFileRoute } from "@tanstack/react-router";

// Feed somente com imóveis que possuem vista para o mar.
export const Route = createFileRoute("/api/public/feed/vista-mar.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { buildFeedResponse } = await import("@/lib/feed-base.server");
        return buildFeedResponse({
          request,
          nome: "Feed Vista para o Mar",
          slug: "vista-mar",
          filters: { vistaMar: true },
          logTag: "feed/vista-mar",
        });
      },
    },
  },
});
