import { createFileRoute } from "@tanstack/react-router";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABLES: Array<{
  tipo: "edificio" | "condominio" | "empreendimento" | "loteamento";
  table: "edificios" | "condominios" | "empreendimentos" | "loteamentos";
  fk: "edificio_id" | "condominio_id" | "empreendimento_id" | "loteamento_id";
}> = [
  { tipo: "edificio", table: "edificios", fk: "edificio_id" },
  { tipo: "condominio", table: "condominios", fk: "condominio_id" },
  { tipo: "empreendimento", table: "empreendimentos", fk: "empreendimento_id" },
  { tipo: "loteamento", table: "loteamentos", fk: "loteamento_id" },
];

const IMOVEL_COLS =
  "id, titulo, codigo_interno, quadra, lote, unidade, box, numero, preco, area_total, area_privativa, dormitorios, banheiros, vagas, suites, status_imovel, bairro, cidade, vista_mar, decorado, bonus";

export const Route = createFileRoute("/api/public/empreendimento/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const id = params.id;
          if (!UUID_RE.test(id)) {
            return json({ error: "Bad id" }, 400);
          }

          const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
          const { client: supabase, error: envErr } = getFeedSupabase();
          if (!supabase) return json({ error: envErr ?? "config" }, 500);

          // Resolve tipo/tabela
          let resolved: (typeof TABLES)[number] | null = null;
          let empreendimento: any = null;
          for (const t of TABLES) {
            const { data } = await supabase.from(t.table as any).select("*").eq("id", id).maybeSingle();
            if (data) {
              resolved = t;
              empreendimento = data;
              break;
            }
          }
          if (!resolved || !empreendimento) return json({ error: "not_found" }, 404);

          // Galeria
          const { data: imgs } = await supabase
            .from("estrutura_imagens")
            .select("id, storage_path, url, capa, ordem")
            .eq("estrutura_tipo", resolved.tipo)
            .eq("estrutura_id", id)
            .order("capa", { ascending: false })
            .order("ordem", { ascending: true });

          const paths = (imgs ?? [])
            .map((im: any) => im.storage_path)
            .filter((p: any) => p && !String(p).startsWith("http"));
          const signedMap: Record<string, string> = {};
          if (paths.length) {
            const { data: signed } = await supabase.storage
              .from("estrutura-imagens")
              .createSignedUrls(paths, 60 * 60 * 24);
            (signed || []).forEach((s: any) => {
              if (s?.path && s?.signedUrl) signedMap[s.path] = s.signedUrl;
            });
          }
          const images = (imgs ?? [])
            .map((im: any) => {
              if (im.storage_path && signedMap[im.storage_path]) return signedMap[im.storage_path];
              if (im.url && String(im.url).startsWith("http")) return im.url;
              return null;
            })
            .filter(Boolean) as string[];

          // PDFs (mapa/implantação)
          let mapaPdfUrl: string | null = null;
          if (empreendimento.mapa_pdf_path) {
            const { data } = await supabase.storage
              .from("estrutura-arquivos")
              .createSignedUrl(empreendimento.mapa_pdf_path, 60 * 60 * 24);
            mapaPdfUrl = data?.signedUrl ?? null;
          }
          let implantacaoPdfUrl: string | null = null;
          if (empreendimento.implantacao_pdf_path) {
            const { data } = await supabase.storage
              .from("estrutura-arquivos")
              .createSignedUrl(empreendimento.implantacao_pdf_path, 60 * 60 * 24);
            implantacaoPdfUrl = data?.signedUrl ?? null;
          }

          // Imóveis vinculados (disponíveis)
          const { data: imoveis } = await supabase
            .from("imoveis")
            .select(IMOVEL_COLS)
            .eq(resolved.fk, id)
            .or("arquivado.is.null,arquivado.eq.false")
            .limit(2000);

          return new Response(
            JSON.stringify({
              tipo: resolved.tipo,
              empreendimento,
              images,
              mapa_pdf_url: mapaPdfUrl,
              implantacao_pdf_url: implantacaoPdfUrl,
              material_completo_url: empreendimento.material_completo_url ?? null,
              imoveis: imoveis ?? [],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "public, max-age=60",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        } catch (e: any) {
          return json({ error: e?.message ?? "internal" }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
