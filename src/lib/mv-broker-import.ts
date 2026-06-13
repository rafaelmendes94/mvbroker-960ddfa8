// Parser dedicado para a planilha padrão MV Broker (AGENCIAMENTOS).
// As colunas vêm na ordem fixa do template — mapeamos por índice, não por nome,
// porque os cabeçalhos da planilha original são mesclados em uma única linha.
import * as XLSX from "xlsx";

export type MvBrokerRow = Record<string, any> & {
  __rowNumber: number;
};

// Cabeçalhos amigáveis exibidos no preview, na ordem das colunas da planilha.
export const MV_BROKER_HEADERS = [
  "Imóvel",
  "Categoria",
  "Subtipo",
  "Unidade / Quadra / Lote",
  "Box",
  "Dormitórios",
  "Área (m²)",
  "Ano / IPTU",
  "Frente / Fundos / Lateral",
  "Mobiliado / Decorado",
  "Destaque",
  "Bairro / Cidade",
  "Rua",
  "Valor (R$)",
  "Fin. Bancário",
  "Entrada",
  "Prazo Direto",
  "Condição Pagamento",
  "Observações",
  "Cond / IPTU",
  "Chaves / Obra",
  "Proprietário",
  "Telefone",
  "Cidade",
  "Data Inclusão",
] as const;

function s(v: any): string {
  return (v === null || v === undefined ? "" : String(v)).trim();
}

function parseIntSafe(v: any): number | null {
  const m = s(v).match(/-?\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return isNaN(n) ? null : n;
}

function parseNumberSafe(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const str = s(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(str);
  return isNaN(n) ? null : n;
}

function parseSimNao(v: any): boolean | null {
  const str = s(v).toLowerCase();
  if (!str) return null;
  if (/(sim|s|x|true|1|mobil|decor|m[oó]veis)/.test(str)) return true;
  if (/(n[aã]o|n|false|0)/.test(str)) return false;
  return null;
}

// "46123" → "2026-04-15" (Excel serial → ISO)
function excelSerialToIso(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const n = parseIntSafe(v);
  if (n === null) {
    // try dd/mm/yyyy
    const br = s(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return null;
  }
  // Excel epoch: 1899-12-30
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const TIPO_MAP: Record<string, string> = {
  ap: "apartamento",
  apartamento: "apartamento",
  casa: "casa",
  sobrado: "casa",
  geminada: "casa",
  terrea: "casa",
  duplex: "apartamento",
  cobertura: "cobertura",
  loft: "apartamento",
  loja: "comercial",
  sala: "comercial",
  comercial: "comercial",
  lote: "terreno",
  loteamento: "terreno",
  chacara: "rural",
  bairro: "casa",
  condominio: "casa",
};

function inferTipoImovel(categoria: string, subtipo: string): string | null {
  const all = `${categoria} ${subtipo}`.toLowerCase();
  for (const [k, v] of Object.entries(TIPO_MAP)) {
    if (all.includes(k)) return v;
  }
  return null;
}

function splitBairroCidade(v: string): { bairro: string; cidade: string } {
  const str = s(v);
  if (!str) return { bairro: "", cidade: "" };
  // Heurística: cidades conhecidas no início do texto
  const cidades = ["xangri la", "xangri lá", "capão", "capao", "tramandai", "tramandaí", "atlantida", "atlântida", "imbé", "imbe"];
  const lower = str.toLowerCase();
  for (const c of cidades) {
    if (lower.startsWith(c)) {
      const cidadeNorm = c.replace("lá", "lá").replace(/^./, (ch) => ch.toUpperCase());
      const bairro = str.slice(c.length).trim();
      return { cidade: cidadeNorm.replace(/\b\w/g, (m) => m.toUpperCase()), bairro };
    }
  }
  return { bairro: str, cidade: "" };
}

function buildUnidade(raw: string): {
  unidade: string | null;
  quadra: string | null;
  lote: string | null;
} {
  const str = s(raw);
  if (!str) return { unidade: null, quadra: null, lote: null };
  const quadra = str.match(/Q\s*:?\s*([A-Z0-9]+)/i)?.[1] ?? null;
  const lote = str.match(/L\s*:?\s*([A-Z0-9]+)/i)?.[1] ?? null;
  const ap = str.match(/(AP|N|UND)\s*:?\s*([A-Z0-9]+)/i)?.[2] ?? null;
  return {
    unidade: ap ?? (quadra || lote ? null : str),
    quadra,
    lote,
  };
}

// Lê a planilha pulando a linha de cabeçalho (linha 1).
// Retorna linhas como array de colunas (índices 0..N).
export async function parseMvBrokerFile(file: File): Promise<MvBrokerRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
  if (matrix.length < 2) return [];
  const out: MvBrokerRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cols = matrix[i] as any[];
    if (!cols || cols.every((c) => s(c) === "")) continue;
    const row: MvBrokerRow = { __rowNumber: i + 1 };
    MV_BROKER_HEADERS.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    out.push(row);
  }
  return out;
}

// Converte uma linha do template MV Broker em um payload pronto para insert em `imoveis`.
export function mvBrokerRowToImovel(row: MvBrokerRow) {
  const nome = s(row["Imóvel"]);
  const categoria = s(row["Categoria"]);
  const subtipo = s(row["Subtipo"]);
  const unidadeRaw = s(row["Unidade / Quadra / Lote"]);
  const box = s(row["Box"]);
  const dorm = parseIntSafe(row["Dormitórios"]);
  const area = parseNumberSafe(row["Área (m²)"]);
  const orientacao = s(row["Frente / Fundos / Lateral"]);
  const mobiliado = parseSimNao(row["Mobiliado / Decorado"]);
  const destaque = parseSimNao(row["Destaque"]);
  const bairroCidade = splitBairroCidade(s(row["Bairro / Cidade"]));
  const rua = s(row["Rua"]);
  const preco = parseNumberSafe(row["Valor (R$)"]);
  const finBancario = s(row["Fin. Bancário"]);
  const entrada = s(row["Entrada"]);
  const prazoDireto = s(row["Prazo Direto"]);
  const condicaoPag = s(row["Condição Pagamento"]);
  const observacoes = s(row["Observações"]);
  const condIptu = s(row["Cond / IPTU"]);
  const chaves = s(row["Chaves / Obra"]);
  const proprietario = s(row["Proprietário"]);
  const telefone = s(row["Telefone"]);
  const cidadeExtra = s(row["Cidade"]);
  const dataInclusao = excelSerialToIso(row["Data Inclusão"]);

  const { unidade, quadra, lote } = buildUnidade(unidadeRaw);
  const tipoImovel = inferTipoImovel(categoria, subtipo);

  const titulo =
    nome ||
    [subtipo || categoria, bairroCidade.bairro || bairroCidade.cidade].filter(Boolean).join(" - ") ||
    "Imóvel sem título";

  const condicoesPagamento = [
    finBancario && `Fin. bancário: ${finBancario}`,
    entrada && `Entrada: ${entrada}`,
    prazoDireto && `Prazo direto: ${prazoDireto}`,
    condicaoPag && condicaoPag,
  ].filter(Boolean) as string[];

  const outrasCaracteristicas = [
    orientacao && `Orientação: ${orientacao}`,
    box && `Box: ${box}`,
    condIptu && `Cond/IPTU: ${condIptu}`,
  ].filter(Boolean) as string[];

  const obsInternas = [
    observacoes,
    chaves && `Chaves/Obra: ${chaves}`,
    categoria && `Categoria origem: ${categoria}`,
    subtipo && `Subtipo origem: ${subtipo}`,
  ].filter(Boolean).join(" | ");

  const rec: Record<string, any> = {
    titulo,
    status_imovel: "disponivel",
  };
  if (tipoImovel) rec.tipo_imovel = tipoImovel;
  if (subtipo) rec.padrao = subtipo;
  if (unidade) rec.unidade = unidade;
  if (quadra) rec.quadra = quadra;
  if (lote) rec.lote = lote;
  if (box) rec.box = box;
  if (dorm !== null) rec.dormitorios = dorm;
  if (area !== null) rec.area_privativa = area;
  if (mobiliado !== null) rec.decorado = mobiliado;
  if (destaque !== null) rec.destaque_home = destaque;
  if (bairroCidade.bairro) rec.bairro = bairroCidade.bairro;
  if (bairroCidade.cidade) rec.cidade = bairroCidade.cidade;
  else if (cidadeExtra) rec.cidade = cidadeExtra;
  if (rua) rec.logradouro = rua;
  if (preco !== null) rec.preco = preco;
  if (condicoesPagamento.length) rec.condicoes_pagamento = condicoesPagamento;
  if (outrasCaracteristicas.length) rec.outras_caracteristicas = outrasCaracteristicas;
  if (proprietario) {
    rec.responsavel_nome = proprietario;
    rec.tipo_proprietario = "proprietario";
  }
  if (telefone) {
    rec.responsavel_telefone = telefone;
    rec.responsavel_whatsapp = telefone;
  }
  if (chaves) rec.local_chaves = chaves;
  if (obsInternas) rec.observacoes_internas = obsInternas;
  if (dataInclusao) rec.data_captacao = dataInclusao;

  return rec;
}
