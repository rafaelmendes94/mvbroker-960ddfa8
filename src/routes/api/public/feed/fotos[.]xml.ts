import { createFileRoute } from "@tanstack/react-router";

// Feed com somente imóveis que possuem ao menos 1 foto.
export const Route = createFileRoute("/api/public/feed/fotos.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { buildFeedResponse } = await import("@/lib/feed-base.server");
        return buildFeedResponse({
          request,
          nome: "Feed Fotos",
          slug: "fotos",
          filters: { manualSlug: "fotos", todos: true },
          logTag: "feed/fotos",
        });
      },
    },
  },
});
