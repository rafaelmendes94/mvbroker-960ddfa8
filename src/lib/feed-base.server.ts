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
      .eq("arquivado", false)
      .eq("exportacao_liberada", true);

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

    let imagens: any[] = [];
    if (candidatos.length) {
      const ids = candidatos.map((i: any) => i.id);
      const { data: imgData } = await supabase
        .from("imovel_imagens")
        .select("imovel_id, url, storage_path, ordem, capa")
        .in("imovel_id", ids);
      imagens = imgData ?? [];
    }

    const byImovel = new Map<string, any[]>();
    for (const img of imagens) {
      const arr = byImovel.get(img.imovel_id) ?? [];
      arr.push(img);
      byImovel.set(img.imovel_id, arr);
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
