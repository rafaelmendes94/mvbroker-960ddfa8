// Base compartilhada dos feeds XML públicos. Server-only.
import { buildFeedXML } from "@/lib/feed-xml.server";
import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";

export type FeedFilters = {
  fotos?: boolean;
  video?: boolean;
  casaCondominio?: boolean;
  exclusivo?: boolean;
  somenteDisponiveis?: boolean;
  vistaMar?: boolean;
  /** Slug do feed do sistema com seleção manual (imovel_feeds_sistema). */
  manualSlug?: string;
  /** Ignora o filtro de exportação liberada (feed geral: todos os imóveis). */
  todos?: boolean;
};

export function parseFeedFilters(url: URL): FeedFilters {
  const on = (k: string) => ["1", "true", "sim", "on"].includes((url.searchParams.get(k) ?? "").toLowerCase());
  return {
    fotos: on("fotos"),
    video: on("video"),
    casaCondominio: on("casa_condominio"),
    exclusivo: on("exclusivo"),
    somenteDisponiveis: on("disponivel"),
    vistaMar: on("vista_mar"),
  };
}

export function isCasaCondominio(im: any): boolean {
  const t = String(im.tipo_imovel ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (t.includes("cond")) return true;
  const ehCasa = /casa|sobrado|residencia/.test(t);
  return ehCasa && (!!im.condominio_id || !!im.loteamento_id);
}

export async function buildFeedResponse(opts: {
  request: Request;
  nome: string;
  slug: string;
  filters: FeedFilters;
  logTag: string;
}): Promise<Response> {
  const { request, nome, slug, filters, logTag } = opts;
  try {
    const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
    const { client: supabase, error: envErr } = getFeedSupabase();
    if (!supabase) {
      console.error(`[${logTag}] env error:`, envErr);
      return new Response(`Feed unavailable: ${envErr ?? "config error"}`, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    let q: any = supabase
      .from("imoveis")
      .select(`${IMOVEL_PUBLIC_COLUMNS}, loteamento_id`)
      .eq("arquivado", false);
    if (!filters.todos) q = q.eq("exportacao_liberada", true);

    if (filters.video) q = q.not("link_video", "is", null).neq("link_video", "");
    if (filters.exclusivo) q = q.eq("exclusivo", true);
    if (filters.vistaMar) q = q.eq("vista_mar", true);

    const { data: imovData, error: imErr } = await q.limit(5000);
    if (imErr) {
      console.error(`[${logTag}] DB error:`, imErr.message);
      return new Response("Feed unavailable", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const statusOk = filters.somenteDisponiveis ? ["disponivel"] : ["disponivel", "reservado"];
    let candidatos = (imovData ?? []).filter((im: any) => {
      const st = String(im.status_imovel ?? im.status ?? "").toLowerCase();
      return statusOk.includes(st);
    });

    if (filters.casaCondominio) candidatos = candidatos.filter(isCasaCondominio);

    if (filters.manualSlug) {
      const { data: marcados } = await supabase
        .from("imovel_feeds_sistema")
        .select("imovel_id")
        .eq("slug", filters.manualSlug);
      const set = new Set((marcados ?? []).map((m: any) => m.imovel_id));
      candidatos = candidatos.filter((im: any) => set.has(im.id));
    }

    // Busca as imagens em lotes E paginando: o PostgREST corta em 1000 linhas por
    // requisição, o que fazia os últimos imóveis do feed saírem sem a tag <Media>.
    let imagens: any[] = [];
    if (candidatos.length) {
      const ids = candidatos.map((i: any) => i.id);
      const CHUNK = 40;
      const PAGE = 1000;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        let offset = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: imgData, error: imgErr } = await supabase
            .from("imovel_imagens")
            .select("imovel_id, url, storage_path, ordem, capa")
            .in("imovel_id", slice)
            .order("imovel_id", { ascending: true })
            .order("ordem", { ascending: true })
            .range(offset, offset + PAGE - 1);
          if (imgErr) {
            console.error(`[${logTag}] imagens error:`, imgErr.message);
            break;
          }
          const rows = imgData ?? [];
          imagens = imagens.concat(rows);
          if (rows.length < PAGE) break;
          offset += PAGE;
        }
      }
    }

    const byImovel = new Map<string, any[]>();
    for (const img of imagens) {
      const arr = byImovel.get(img.imovel_id) ?? [];
      arr.push(img);
      byImovel.set(img.imovel_id, arr);
    }

    // Fallback: imóveis cujas fotos foram enviadas direto ao storage e não têm
    // registro em imovel_imagens — lista os arquivos da pasta do imóvel.
    const semFoto = candidatos.filter((im: any) => !(byImovel.get(im.id)?.length));
    if (semFoto.length) {
      await Promise.all(
        semFoto.slice(0, 300).map(async (im: any) => {
          try {
            const { data: files } = await supabase.storage
              .from("imoveis")
              .list(im.id, { limit: 40, sortBy: { column: "name", order: "asc" } });
            const fotos = (files ?? [])
              .filter((f: any) => f.name && /\.(jpe?g|png|webp|avif)$/i.test(f.name))
              .map((f: any, idx: number) => ({
                imovel_id: im.id,
                url: null,
                storage_path: `${im.id}/${f.name}`,
                ordem: idx,
                capa: idx === 0,
              }));
            if (fotos.length) byImovel.set(im.id, fotos);
          } catch {
            /* ignora imóveis sem pasta no storage */
          }
        }),
      );
    }

    const imoveis = filters.fotos
      ? candidatos.filter((im: any) => (byImovel.get(im.id)?.length ?? 0) > 0)
      : candidatos;

    const edifIds = Array.from(new Set(imoveis.map((i: any) => i.edificio_id).filter(Boolean))) as string[];
    const condIds = Array.from(new Set(imoveis.map((i: any) => i.condominio_id).filter(Boolean))) as string[];
    const [edifRes, condRes] = await Promise.all([
      edifIds.length ? supabase.from("edificios").select("id, nome").in("id", edifIds) : Promise.resolve({ data: [] as any[] }),
      condIds.length ? supabase.from("condominios").select("id, nome").in("id", condIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const edifMap = new Map((edifRes.data ?? []).map((e: any) => [e.id, e.nome]));
    const condMap = new Map((condRes.data ?? []).map((c: any) => [c.id, c.nome]));

    const enriched = imoveis.map((im: any) => ({
      ...im,
      imagens: byImovel.get(im.id) ?? [],
      edificio_nome: im.edificio_id ? edifMap.get(im.edificio_id) ?? null : null,
      condominio_nome: im.condominio_id ? condMap.get(im.condominio_id) ?? null : null,
    }));

    const xml = buildFeedXML({
      carteira: { nome, slug, updated_at: new Date().toISOString() },
      imoveis: enriched,
      storageBaseUrl: `${new URL(request.url).origin}/api/public/img/imoveis`,
    });

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    console.error(`[${logTag}] unexpected:`, e?.message || e);
    return new Response(`Feed unavailable: ${e?.message ?? "internal error"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
