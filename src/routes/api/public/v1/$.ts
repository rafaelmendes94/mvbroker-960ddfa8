import { createFileRoute } from "@tanstack/react-router";

// Mesmo roteador da API v1, exposto sob /api/public/* para que integrações
// externas (portais, parceiros, automações) alcancem a API no site publicado.
// A autenticação continua sendo obrigatória e é feita dentro do handler.
const handler = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const { handleApiV1 } = await import("@/lib/api/v1/router.server");
  return handleApiV1(request, params._splat ?? "");
};

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
      OPTIONS: handler,
    },
  },
});
