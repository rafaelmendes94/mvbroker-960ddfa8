import { createFileRoute } from "@tanstack/react-router";
import { buildFeedResponse } from "@/lib/feed-base.server";

// Feed geral: todos os imóveis liberados para exportação do usuário/imobiliária.
// $id pode ser user_id (created_by) ou imobiliaria_id — tentamos ambos.
export const Route = createFileRoute("/api/public/feed/geral/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client: supabase, error: envErr } = await getFeedSupabase();
          if (!supabase) {
            console.error("[feed/geral] env error:", envErr);
            return new Response(`Feed unavailable: ${envErr ?? "config error"}`, {
              status: 500,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          const id = params.id.replace(/\.xml$/i, "");

          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            return new Response("Bad Request", { status: 400 });
          }

          // Cada imobiliária/usuário tem sua própria URL de feed geral.
          // Só respondemos se o id corresponder a uma imobiliária ou a um perfil real,
          // evitando que URLs adivinhadas exponham o catálogo.
          const [{ data: imob }, { data: perfil }] = await Promise.all([
            supabase.from("imobiliarias").select("id, nome_fantasia, status").eq("id", id).maybeSingle(),
            supabase.from("profiles").select("id, full_name").eq("id", id).maybeSingle(),
          ]);
          if (!imob && !perfil) return new Response("Feed not found", { status: 404 });
          if (imob && imob.status && imob.status !== "ativa" && imob.status !== "ativo") {
            return new Response("Feed inactive", { status: 410 });
          }
          const feedNome = imob?.nome_fantasia || perfil?.full_name || "Feed Geral";

          return buildFeedResponse({
            request,
            nome: feedNome,
            slug: `geral-${id}`,
            filters: { todos: true },
            logTag: "feed/geral",
          });
        } catch (e: any) {
          console.error("[feed/geral] unexpected:", e?.message || e);
          return new Response(`Feed unavailable: ${e?.message ?? "internal error"}`, {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
