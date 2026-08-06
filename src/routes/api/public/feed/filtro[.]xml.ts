import { createFileRoute } from "@tanstack/react-router";

// Feed com filtros combináveis via query string:
// ?fotos=1&video=1&casa_condominio=1&exclusivo=1&disponivel=1
export const Route = createFileRoute("/api/public/feed/filtro.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { buildFeedResponse, parseFeedFilters } = await import("@/lib/feed-base.server");
        const url = new URL(request.url);
        const filters = parseFeedFilters(url);
        return buildFeedResponse({
          request,
          nome: "Feed Filtrado",
          slug: "filtro",
          filters,
          logTag: "feed/filtro",
        });
      },
    },
  },
});
