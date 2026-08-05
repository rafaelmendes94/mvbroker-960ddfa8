/**
 * Utilitários para tratar empreendimentos duplicados pelo mesmo nome
 * (edifícios / condomínios / loteamentos).
 */

export type EstruturaTable = "edificios" | "condominios" | "loteamentos" | "empreendimentos";

/** Normaliza nome: sem acentos, minúsculo, espaços colapsados. */
export function normalizeNome(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Retorna todos os IDs de registros da tabela cujo nome normalizado é igual
 * ao nome informado. Sempre inclui `fallbackId` quando fornecido.
 */
export async function getIdsMesmoNome(
  client: any,
  table: EstruturaTable,
  nome: string | null | undefined,
  fallbackId?: string,
): Promise<string[]> {
  const alvo = normalizeNome(nome);
  const ids = new Set<string>();
  if (fallbackId) ids.add(fallbackId);
  if (!alvo) return Array.from(ids);

  const primeiraPalavra = alvo.split(" ")[0];
  const { data } = await client
    .from(table)
    .select("id, nome")
    .ilike("nome", `%${primeiraPalavra}%`)
    .limit(2000);

  for (const r of (data ?? []) as Array<{ id: string; nome: string | null }>) {
    if (normalizeNome(r.nome) === alvo) ids.add(r.id);
  }
  return Array.from(ids);
}

/** Procura um registro existente com o mesmo nome normalizado. */
export async function findExistingByNome(
  client: any,
  table: EstruturaTable,
  nome: string,
): Promise<{ id: string } | null> {
  const alvo = normalizeNome(nome);
  if (!alvo) return null;
  const primeiraPalavra = alvo.split(" ")[0];
  const { data } = await client
    .from(table)
    .select("id, nome")
    .ilike("nome", `%${primeiraPalavra}%`)
    .limit(2000);
  const hit = ((data ?? []) as Array<{ id: string; nome: string | null }>).find(
    (r) => normalizeNome(r.nome) === alvo,
  );
  return hit ? { id: hit.id } : null;
}
