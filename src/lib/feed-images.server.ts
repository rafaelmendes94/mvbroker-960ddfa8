// Busca paginada de imagens de imóveis. Server-only.
// O PostgREST corta a resposta em ~1000 linhas por requisição: sem chunk +
// range pagination, imóveis do fim da lista saem sem fotos no XML.

const CHUNK = 40;
const PAGE = 1000;

export type ImovelImagemRow = {
  imovel_id: string;
  url: string | null;
  storage_path: string;
  ordem: number;
  capa: boolean;
};

export async function fetchImovelImagesByIds(
  supabase: any,
  ids: string[],
  logTag = "feed-images",
): Promise<ImovelImagemRow[]> {
  const unique = Array.from(new Set((ids ?? []).filter(Boolean)));
  if (!unique.length) return [];

  const out: ImovelImagemRow[] = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("imovel_imagens")
        .select("imovel_id, url, storage_path, ordem, capa")
        .in("imovel_id", slice)
        .order("imovel_id", { ascending: true })
        .order("ordem", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        console.error(`[${logTag}] imagens error:`, error.message);
        break;
      }
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }

  // Auditoria: sinaliza carteiras grandes com poucos imóveis cobertos.
  const cobertos = new Set(out.map((r) => r.imovel_id)).size;
  if (unique.length >= 50 && cobertos < unique.length * 0.5) {
    console.warn(
      `[${logTag}] cobertura baixa de fotos: ${cobertos}/${unique.length} imóveis, ${out.length} imagens`,
    );
  }
  return out;
}

/** Agrupa por imovel_id mantendo capa primeiro e depois ordem. */
export function groupImagesByImovel(rows: ImovelImagemRow[]): Map<string, ImovelImagemRow[]> {
  const map = new Map<string, ImovelImagemRow[]>();
  for (const img of rows) {
    const arr = map.get(img.imovel_id) ?? [];
    arr.push(img);
    map.set(img.imovel_id, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || (a.ordem ?? 0) - (b.ordem ?? 0));
    map.set(k, arr);
  }
  return map;
}
