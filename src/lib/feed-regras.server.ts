// Aplica regras automáticas de filtro à query de imóveis. Server-only helper.
export type RegraFiltros = {
  cidades?: string[];
  estados?: string[];
  tipos?: string[];
  preco_min?: number;
  preco_max?: number;
  somente_disponiveis?: boolean;
  dormitorios_min?: number;
};

export function applyRegrasToQuery<T extends { in: Function; gte: Function; lte: Function; eq: Function }>(
  q: T,
  regras: RegraFiltros,
): T {
  let r: any = q;
  if (regras.cidades?.length) r = r.in("cidade", regras.cidades);
  if (regras.estados?.length) r = r.in("estado", regras.estados);
  if (regras.tipos?.length) r = r.in("tipo", regras.tipos);
  if (regras.preco_min != null) r = r.gte("preco", regras.preco_min);
  if (regras.preco_max != null) r = r.lte("preco", regras.preco_max);
  if (regras.dormitorios_min != null) r = r.gte("dormitorios", regras.dormitorios_min);
  if (regras.somente_disponiveis) r = r.eq("status", "disponivel");
  return r;
}
