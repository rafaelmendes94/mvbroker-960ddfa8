import { createFileRoute } from "@tanstack/react-router";

const handler = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const { handleApiV1 } = await import("@/lib/api/v1/router.server");
  return handleApiV1(request, params._splat ?? "");
};

export const Route = createFileRoute("/api/v1/$")({
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
