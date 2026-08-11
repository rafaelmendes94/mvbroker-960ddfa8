import { createFileRoute } from "@tanstack/react-router";

// Feed somente com casas em condomínio / loteamento.
export const Route = createFileRoute("/api/public/feed/casa-condominio.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { buildFeedResponse } = await import("@/lib/feed-base.server");
        return buildFeedResponse({
          request,
          nome: "Feed Casa em Condomínio",
          slug: "casa-condominio",
          filters: { manualSlug: "casa-condominio", todos: true },
          logTag: "feed/casa-condominio",
        });
      },
    },
  },
});
