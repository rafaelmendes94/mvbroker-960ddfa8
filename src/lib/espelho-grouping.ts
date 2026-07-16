import type { EmpreendimentoTipo, UnitStatus } from "./espelho";

export type ImovelEspelho = {
  id: string;
  titulo: string | null;
  codigo_interno: string | null;
  quadra: string | null;
  lote: string | null;
  unidade: string | null;
  box: string | null;
  numero: string | null;
  preco: number | null;
  area_total: number | null;
  dormitorios: number | null;
  vagas: number | null;
  suites: number | null;
  status_imovel: string | null;
};

export type GrupoEspelho = {
  chave: string;
  label: string;
  ordem: number; // usado só para ordenação; grupos "sem ..." recebem -Infinity
  imoveis: ImovelEspelho[];
};

/* ------- Extração de bloco / andar a partir de `unidade` ------- */

function limpar(v: string | null | undefined) {
  return (v ?? "").trim();
}

/** Extrai o token de bloco a partir do campo unidade (string livre). */
export function extrairBloco(
  unidade: string | null | undefined,
  quadraFallback?: string | null,
): string | null {
  const u = limpar(unidade);
  if (u) {
    const m1 = u.match(/^(?:bloco|bl|torre|t)\s*[-.]?\s*([A-Za-z0-9]+)/i);
    if (m1) return m1[1].toUpperCase();
    const m2 = u.match(/^([A-Za-z0-9]{1,3})\s*[-/·]\s*\d/);
    if (m2) return m2[1].toUpperCase();
  }
  const q = limpar(quadraFallback);
  if (q) return q.replace(/^(qd?|q)\s*[-.]?\s*/i, "").toUpperCase();
  return null;
}

/** Extrai o andar (int) a partir do campo unidade. Null se não conseguir. */
export function extrairAndar(unidade: string | null | undefined): number | null {
  const u = limpar(unidade);
  if (!u) return null;
  const m1 = u.match(/(\d+)\s*º?\s*(?:andar|and)\b/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = u.match(/^(\d+)\s*[-/·]\s*\d+/);
  if (m2) return parseInt(m2[1], 10);
  const somenteDigitos = u.replace(/\D/g, "");
  if (/^\d+$/.test(u.trim()) || (somenteDigitos.length >= 3 && somenteDigitos.length <= 4)) {
    if (somenteDigitos.length >= 3) return parseInt(somenteDigitos.slice(0, somenteDigitos.length - 2), 10);
    if (somenteDigitos.length <= 2) return 1;
  }
  return null;
}

function normalizarQuadra(q: string | null | undefined): number | null {
  const s = limpar(q).replace(/^(qd?|q)\s*[-.]?\s*/i, "");
  if (!s) return null;
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/* ------- Rótulos e status ------- */

function clean(v: string | null | undefined) {
  return limpar(v).replace(/^(Qd?|Lt?|L)\s*[-.]?\s*/i, "");
}

export function rotuloCelula(tipo: EmpreendimentoTipo, i: ImovelEspelho): string {
  if (tipo === "loteamento") {
    const q = clean(i.quadra);
    const l = clean(i.lote);
    if (q && l) return `Q${q}·L${l}`;
    if (l) return `Lt ${l}`;
    if (q) return `Qd ${q}`;
    return i.unidade || i.numero || "—";
  }
  if (tipo === "edificio") {
    if (i.unidade) return i.unidade;
    if (i.numero) return i.numero;
    if (i.box) return `Box ${clean(i.box)}`;
    return "—";
  }
  // condominio
  if (i.unidade) return i.unidade;
  const q = clean(i.quadra);
  const l = clean(i.lote);
  if (q && l) return `Q${q}·L${l}`;
  if (l) return `Lt ${l}`;
  if (i.box) return `Box ${clean(i.box)}`;
  if (i.numero) return i.numero;
  return "—";
}

export function statusCelula(i: ImovelEspelho): UnitStatus {
  const s = (i.status_imovel ?? "").toLowerCase();
  if (s.includes("vend")) return "vendido";
  if (s.includes("reserv")) return "reservado";
  if (s.includes("dispon")) return "disponivel";
  return "indisponivel";
}

/* ------- Agrupamento ------- */

function ordenarImoveis(tipo: EmpreendimentoTipo, arr: ImovelEspelho[]): ImovelEspelho[] {
  return [...arr].sort((a, b) => {
    const ra = rotuloCelula(tipo, a);
    const rb = rotuloCelula(tipo, b);
    return ra.localeCompare(rb, "pt-BR", { numeric: true, sensitivity: "base" });
  });
}

export function agruparImoveis(tipo: EmpreendimentoTipo, imoveis: ImovelEspelho[]): GrupoEspelho[] {
  const map = new Map<string, GrupoEspelho>();

  const push = (chave: string, label: string, ordem: number, im: ImovelEspelho) => {
    let g = map.get(chave);
    if (!g) {
      g = { chave, label, ordem, imoveis: [] };
      map.set(chave, g);
    }
    g.imoveis.push(im);
  };

  for (const im of imoveis) {
    if (tipo === "edificio") {
      const andar = extrairAndar(im.unidade);
      if (andar == null) push("__sem", "Sem andar", -Infinity, im);
      else push(`a${andar}`, `Andar ${andar}`, andar, im);
    } else if (tipo === "loteamento") {
      const q = normalizarQuadra(im.quadra);
      if (q == null) push("__sem", "Sem quadra", -Infinity, im);
      else push(`q${q}`, `Quadra ${q}`, q, im);
    } else {
      // condominio
      const bloco = extrairBloco(im.unidade, im.quadra);
      if (!bloco) push("__sem", "Sem bloco", -Infinity, im);
      else push(`b${bloco}`, `Bloco ${bloco}`, 0, im);
    }
  }

  const arr = Array.from(map.values()).map((g) => ({
    ...g,
    imoveis: ordenarImoveis(tipo, g.imoveis),
  }));

  if (tipo === "edificio") {
    // andar desc, sem andar por último
    arr.sort((a, b) => (b.ordem === -Infinity ? -1 : a.ordem === -Infinity ? 1 : b.ordem - a.ordem));
  } else if (tipo === "loteamento") {
    // quadra asc, sem quadra por último
    arr.sort((a, b) => (a.ordem === -Infinity ? 1 : b.ordem === -Infinity ? -1 : a.ordem - b.ordem));
  } else {
    // bloco alfabético, sem bloco por último
    arr.sort((a, b) => {
      if (a.ordem === -Infinity) return 1;
      if (b.ordem === -Infinity) return -1;
      return a.label.localeCompare(b.label, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }

  return arr;
}
