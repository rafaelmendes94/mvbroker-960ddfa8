import { createFileRoute } from "@tanstack/react-router";
import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/imovel/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const id = params.id;
          if (!UUID_RE.test(id)) {
            return new Response(JSON.stringify({ error: "Bad id" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client: supabase, error: envErr } = getFeedSupabase();
          if (!supabase) {
            return new Response(JSON.stringify({ error: envErr ?? "config" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: imovel, error } = await supabase
            .from("imoveis")
            .select(IMOVEL_PUBLIC_COLUMNS + ", edificios(nome), condominios(nome, mapa_pdf_path, implantacao_pdf_path), empreendimentos(nome)")
            .eq("id", id)
            .or("arquivado.is.null,arquivado.eq.false")
            .maybeSingle();

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!imovel) {
            return new Response(JSON.stringify({ error: "not_found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: imgs } = await supabase
            .from("imovel_imagens")
            .select("storage_path, url, ordem, capa")
            .eq("imovel_id", id)
            .order("capa", { ascending: false })
            .order("ordem", { ascending: true });

          const paths = (imgs ?? [])
            .map((im: any) => im.storage_path || im.url)
            .filter((p: any) => p && !String(p).startsWith("http"));
          const signedMap: Record<string, string> = {};
          if (paths.length) {
            const { data: signed } = await supabase.storage
              .from("imoveis")
              .createSignedUrls(paths, 60 * 60 * 24);
            (signed || []).forEach((s: any) => {
              if (s?.path && s?.signedUrl) signedMap[s.path] = s.signedUrl;
            });
          }
          const images = (imgs ?? [])
            .map((im: any) => {
              const p = im.storage_path || im.url;
              if (!p) return null;
              if (String(p).startsWith("http")) return p;
              return signedMap[p] || null;
            })
            .filter(Boolean) as string[];

          // Log view (service role bypasses RLS)
          try {
            await supabase.from("imovel_logs").insert({
              imovel_id: id,
              acao: "visualizacao_publica",
              user_id: null,
            } as any);
          } catch {}

          // PDF de mapa/implantação do condomínio (assinado)
          let mapaPdfUrl: string | null = null;
          try {
            const cond: any = (imovel as any)?.condominios;
            const pdfPath = cond?.mapa_pdf_path || cond?.implantacao_pdf_path || null;
            if (pdfPath) {
              const { data: sp } = await supabase.storage
                .from("estrutura-arquivos")
                .createSignedUrl(pdfPath, 60 * 60 * 24);
              mapaPdfUrl = sp?.signedUrl ?? null;
            }
          } catch {}

          // PDF comercial do imóvel (assinado)
          let pdfComercialUrl: string | null = null;
          try {
            const { data: extra } = await supabase
              .from("imoveis")
              .select("pdf_comercial_path")
              .eq("id", id)
              .maybeSingle();
            const p = (extra as any)?.pdf_comercial_path || null;
            if (p) {
              if (String(p).startsWith("http")) {
                pdfComercialUrl = p;
              } else {
                const { data: sp } = await supabase.storage
                  .from("materiais")
                  .createSignedUrl(p, 60 * 60 * 24);
                pdfComercialUrl = sp?.signedUrl ?? null;
              }
            }
          } catch {}

          return new Response(JSON.stringify({ imovel, images, mapaPdfUrl, pdfComercialUrl }), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "internal" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
