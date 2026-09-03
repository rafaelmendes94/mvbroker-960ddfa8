// ============================================================================
// MODELO OFICIAL DE IMÓVEIS — fonte única de verdade para
// "Baixar Modelo", "Importar Excel" e "Exportar XLS".
// Todas as colunas apontam para campos REAIS da tabela `imoveis`.
// Nenhuma tabela nova, nenhuma coluna duplicada.
// ============================================================================
import * as XLSX from "xlsx";

export type ColType = "text" | "int" | "num" | "bool" | "date" | "list";

export type ModeloCol = {
  /** Cabeçalho oficial no Excel */
  key: string;
  /** Coluna real na tabela `imoveis` (null = campo derivado/relacional) */
  db: string | null;
  type: ColType;
  required?: boolean;
  help: string;
  options?: string[];
  aliases?: string[];
};

export const STATUS_OPCOES = ["Disponível", "Reservado", "Vendido", "Inativo"] as const;
export const TIPO_OPCOES = [
  "Apartamento",
  "Casa",
  "Sobrado",
  "Cobertura",
  "Lote",
  "Terreno",
  "Sala Comercial",
  "Loja Comercial",
  "Comercial",
  "Rural",
] as const;
const SIM_NAO = ["SIM", "NÃO"];

export const MODELO_COLS: ModeloCol[] = [
  { key: "codigo_interno", db: "codigo_interno", type: "text", help: "Código/referência da sua planilha antiga (ex.: MV-00002). Deixe vazio para novos imóveis — o sistema gera o ID interno.", aliases: ["source_id", "codigo", "referencia", "ref"] },
  { key: "status", db: "status_imovel", type: "text", options: [...STATUS_OPCOES], help: "Situação do imóvel.", aliases: ["situacao", "status_imovel"] },
  { key: "property_name", db: null, type: "text", help: "Nome do EMPREENDIMENTO / edifício / condomínio (ex.: PREMIUM, VELAS DA MARINA). Nunca é a classificação do imóvel.", aliases: ["empreendimento", "condominio", "condomínio", "edificio", "edifício", "loteamento", "nome_empreendimento", "imovel", "imóvel"] },
  { key: "property_type", db: "tipo_imovel", type: "text", required: true, options: [...TIPO_OPCOES], help: "Tipo do imóvel. Campo obrigatório.", aliases: ["tipo", "tipo_imovel", "categoria"] },
  { key: "padrao", db: "padrao", type: "text", help: "Subtipo/padrão livre (ex.: Alto padrão, Geminada, Duplex).", aliases: ["subtipo", "padrão"] },
  { key: "unit_reference", db: "unidade", type: "text", help: "Número do apartamento, sala ou loja. NUNCA usar para quadra/lote.", aliases: ["unidade", "apartamento", "apto", "ap", "sala", "loja"] },
  { key: "quadra", db: "quadra", type: "text", help: "Quadra do imóvel em condomínio/loteamento (ex.: R4, H).", aliases: ["qd", "quadra"] },
  { key: "lote", db: "lote", type: "text", help: "Número do lote (ex.: 10, 17).", aliases: ["lt", "lote"] },
  { key: "box", db: "box", type: "text", help: "Box/garagem.", aliases: ["box", "garagem"] },
  { key: "city", db: "cidade", type: "text", help: "Cidade do imóvel.", aliases: ["cidade", "municipio", "município"] },
  { key: "neighborhood", db: "bairro", type: "text", help: "Bairro.", aliases: ["bairro"] },
  { key: "street", db: "logradouro", type: "text", help: "Rua/avenida.", aliases: ["street_raw", "rua", "endereco", "endereço", "logradouro"] },
  { key: "numero_endereco", db: "numero", type: "text", help: "Número do imóvel na rua (usado quando não há unidade/quadra/lote).", aliases: ["numero", "número", "num", "nº"] },
  { key: "complemento", db: "complemento", type: "text", help: "Complemento do endereço.", aliases: ["complemento"] },
  { key: "cep", db: "cep", type: "text", help: "CEP.", aliases: ["cep"] },
  { key: "price_brl", db: "preco", type: "num", required: true, help: "Valor de venda em R$ (somente números). Campo obrigatório.", aliases: ["preco", "preço", "valor", "valor_venda", "price"] },
  { key: "preco_parcelado", db: "preco_parcelado", type: "num", help: "Valor total parcelado, se houver.", aliases: ["parcelado"] },
  { key: "bedrooms", db: "dormitorios", type: "int", help: "Dormitórios.", aliases: ["dormitorios", "dormitórios", "quartos"] },
  { key: "suites", db: "suites", type: "int", help: "Suítes.", aliases: ["suítes", "suite"] },
  { key: "bathrooms", db: "banheiros", type: "int", help: "Banheiros.", aliases: ["banheiros"] },
  { key: "area_m2", db: "area_privativa", type: "num", help: "Área privativa em m².", aliases: ["area_privativa", "area", "área", "area_util"] },
  { key: "area_total", db: "area_total", type: "num", help: "Área total em m².", aliases: ["area_total", "área total"] },
  { key: "parking_spaces", db: "vagas", type: "int", help: "Vagas de garagem.", aliases: ["vagas", "garagens"] },
  { key: "position_solar", db: "posicao_solar", type: "text", help: "Posição solar / frente-fundos-lateral.", aliases: ["posicao_solar", "position_solar_raw", "posicao"] },
  { key: "vista", db: "vista", type: "text", help: "Descrição da vista.", aliases: ["vista"] },
  { key: "vista_mar", db: "vista_mar", type: "bool", options: SIM_NAO, help: "SIM/NÃO — imóvel com vista mar.", aliases: ["vista mar"] },
  { key: "decorated", db: "decorado", type: "bool", options: SIM_NAO, help: "SIM/NÃO — mobiliado/decorado.", aliases: ["decorado", "mobiliado", "furnished"] },
  { key: "exclusividade", db: "exclusividade", type: "bool", options: SIM_NAO, help: "SIM/NÃO — imóvel em exclusividade.", aliases: ["exclusivo", "exclusividade"] },
  { key: "destaque", db: "destaque_home", type: "bool", options: SIM_NAO, help: "SIM/NÃO — destaque na home.", aliases: ["destaque_home", "highlights", "destaque"] },
  { key: "aceita_permuta", db: "aceita_permuta", type: "bool", options: SIM_NAO, help: "SIM/NÃO — aceita permuta.", aliases: ["permuta"] },
  { key: "bank_financing", db: null, type: "text", help: "Financiamento bancário (texto livre ou SIM/NÃO). Entra em Condições de pagamento.", aliases: ["financiamento", "fin_bancario", "financiamento_bancario"] },
  { key: "entry_value", db: null, type: "text", help: "Entrada (valor ou %). Entra em Condições de pagamento.", aliases: ["entrada", "entry_raw", "entry_value_brl"] },
  { key: "payment_terms", db: "condicoes_pagamento", type: "list", help: "Condições de pagamento. Separe várias com ponto e vírgula (;).", aliases: ["condicoes_pagamento", "condicao_pagamento", "condições de pagamento", "prazo_direto", "direct_term_raw"] },
  { key: "bonus", db: "bonus", type: "text", help: "Bônus / campanha comercial.", aliases: ["bonus", "bônus"] },
  { key: "descricao", db: "descricao", type: "text", help: "Descrição pública do imóvel.", aliases: ["descrição", "description"] },
  { key: "outras_caracteristicas", db: "outras_caracteristicas", type: "list", help: "Outras características, separadas por ponto e vírgula (;).", aliases: ["caracteristicas", "características"] },
  { key: "link_video", db: "link_video", type: "text", help: "Link do vídeo.", aliases: ["video", "vídeo"] },
  { key: "tour_360", db: "tour_360", type: "text", help: "Link do tour 360º.", aliases: ["tour360", "tour"] },
  { key: "link_material", db: "link_material", type: "text", help: "Link do material completo.", aliases: ["material"] },
  { key: "link_drive_fotos", db: "link_drive_fotos", type: "text", help: "Link do Drive com as fotos.", aliases: ["drive", "fotos"] },
  { key: "contact_name", db: "responsavel_nome", type: "text", help: "Nome do proprietário/corretor responsável.", aliases: ["proprietario", "proprietário", "responsavel", "responsável"] },
  { key: "contact_phone", db: "responsavel_telefone", type: "text", help: "Telefone de contato.", aliases: ["telefone", "contact_phone_raw", "fone", "whatsapp"] },
  { key: "contact_email", db: "responsavel_email", type: "text", help: "E-mail de contato.", aliases: ["email", "e-mail"] },
  { key: "keys_access", db: "local_chaves", type: "text", help: "Onde estão as chaves / como acessar o imóvel.", aliases: ["chaves", "local_chaves"] },
  { key: "internal_notes", db: "observacoes_internas", type: "text", help: "Observações internas (não aparecem no site).", aliases: ["observacoes", "observações", "obs"] },
  { key: "included_at", db: "data_captacao", type: "date", help: "Data ORIGINAL de inclusão/captação (dd/mm/aaaa). Nunca é substituída pela data da importação.", aliases: ["data_inclusao", "data inclusão", "data_captacao", "captacao"] },
  { key: "exportacao_liberada", db: "exportacao_liberada", type: "bool", options: SIM_NAO, help: "SIM/NÃO — liberar o imóvel para os feeds XML.", aliases: ["exportacao", "exportar"] },
  { key: "publicar_xml", db: "publicar_xml", type: "bool", options: SIM_NAO, help: "SIM/NÃO — publicar nos portais.", aliases: ["publicar"] },
];

export const MODELO_HEADERS = MODELO_COLS.map((c) => c.key);

// ---------------------------------------------------------------- utilidades
export function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const str = s(v).replace(/[R$\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(str.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function toBool(v: unknown): boolean | null {
  const str = norm(v);
  if (!str) return null;
  if (["sim", "s", "x", "true", "1", "yes", "mobiliado", "semimobiliado", "decorado"].includes(str)) return true;
  if (["nao", "n", "false", "0", "no", "vazio"].includes(str)) return false;
  return null;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 90000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const str = s(v);
  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return s(v)
    .split(/[;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const STATUS_MAP: Record<string, string> = {
  disponivel: "disponivel",
  reservado: "reservado",
  vendido: "vendido",
  inativo: "inativo",
  ativo: "disponivel",
};

const TIPO_MAP: Record<string, string> = {
  apartamento: "apartamento",
  apto: "apartamento",
  ap: "apartamento",
  cobertura: "cobertura",
  casa: "casa",
  sobrado: "casa",
  geminada: "casa",
  duplex: "apartamento",
  lote: "terreno",
  terreno: "terreno",
  salacomercial: "comercial",
  lojacomercial: "comercial",
  sala: "comercial",
  loja: "comercial",
  comercial: "comercial",
  rural: "rural",
  chacara: "rural",
};

export function normalizarTipo(v: unknown): string | null {
  const n = norm(v);
  if (!n) return null;
  if (TIPO_MAP[n]) return TIPO_MAP[n];
  for (const [k, val] of Object.entries(TIPO_MAP)) if (n.includes(k)) return val;
  return null;
}

export function normalizarStatus(v: unknown): string {
  const n = norm(v);
  return STATUS_MAP[n] ?? "disponivel";
}

// ------------------------------------------------------- leitura da planilha
export type LinhaPlanilha = Record<string, any> & { __row: number };

/** Mapeia cabeçalhos reais do arquivo para as chaves oficiais (aceita variações). */
export function mapearCabecalhos(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const idx = new Map<string, string>();
  for (const h of headers) idx.set(norm(h), h);
  for (const col of MODELO_COLS) {
    const cands = [col.key, ...(col.aliases ?? [])].map(norm);
    for (const c of cands) {
      const found = idx.get(c);
      if (found) {
        out[col.key] = found;
        break;
      }
    }
  }
  return out;
}

export async function lerPlanilhaOficial(file: File): Promise<{ linhas: LinhaPlanilha[]; mapa: Record<string, string>; headers: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => norm(n).includes("imove")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  const headers = raw.length
    ? Object.keys(raw[0])
    : ((XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] as string[]) ?? []);
  const mapa = mapearCabecalhos(headers);
  const linhas: LinhaPlanilha[] = raw
    .map((r, i) => ({ ...r, __row: i + 2 }))
    .filter((r) => Object.entries(r).some(([k, v]) => k !== "__row" && s(v) !== ""));
  return { linhas, mapa, headers };
}

// ----------------------------------------------- conversão linha -> registro
export type LinhaValidada = {
  row: number;
  registro: Record<string, any>;
  /** nome do empreendimento informado (property_name) */
  empreendimento: string | null;
  erros: string[];
  avisos: string[];
  fingerprint: string;
  exactFingerprint: string;
  duplicado: "nao" | "exato" | "possivel";
  duplicadoDe?: { id: string; titulo: string };
  acao: "importar" | "ignorar" | "atualizar";
};

function valorBruto(linha: LinhaPlanilha, mapa: Record<string, string>, key: string) {
  const h = mapa[key];
  return h ? linha[h] : undefined;
}

export function converterLinha(linha: LinhaPlanilha, mapa: Record<string, string>): Omit<LinhaValidada, "duplicado" | "acao"> {
  const rec: Record<string, any> = {};
  const erros: string[] = [];
  const avisos: string[] = [];

  const get = (k: string) => valorBruto(linha, mapa, k);

  for (const col of MODELO_COLS) {
    if (!col.db) continue;
    const raw = get(col.key);
    if (raw === undefined || s(raw) === "") continue;
    let val: any;
    switch (col.type) {
      case "num": val = toNumber(raw); break;
      case "int": { const n = toNumber(raw); val = n === null ? null : Math.trunc(n); break; }
      case "bool": val = toBool(raw); break;
      case "date": val = toDate(raw); break;
      case "list": val = toList(raw); break;
      default: val = s(raw);
    }
    if (val === null || (Array.isArray(val) && val.length === 0)) continue;
    rec[col.db] = val;
  }

  // tipo e status normalizados
  const tipo = normalizarTipo(get("property_type"));
  if (!tipo) erros.push("Tipo de imóvel ausente ou não reconhecido");
  else rec.tipo_imovel = tipo;
  rec.status_imovel = normalizarStatus(get("status"));

  // preço
  const preco = toNumber(get("price_brl"));
  if (preco === null || preco <= 0) erros.push("Preço inválido ou ausente");
  else rec.preco = preco;

  // cidade
  if (!s(get("city"))) avisos.push("Cidade ausente");

  // unidade x quadra/lote — nunca concatenar
  const empreendimento = s(get("property_name")) || null;
  const unidade = s(get("unit_reference"));
  const quadra = s(get("quadra"));
  const lote = s(get("lote"));
  const numeroEnd = s(get("numero_endereco"));

  if (/qu?a?d?r?a?\s*[:.]?\s*\w+.*lote/i.test(unidade)) {
    erros.push('unit_reference não pode conter "Quadra X Lote Y" — use as colunas quadra e lote');
  }

  const emCondominio = !!empreendimento;
  const tipoTerreno = tipo === "terreno";
  const tipoCasa = tipo === "casa";

  if (tipo === "apartamento" || tipo === "cobertura") {
    if (!unidade) avisos.push("Apartamento sem unit_reference");
    if (!empreendimento) avisos.push("Empreendimento ausente");
  } else if ((tipoCasa || tipoTerreno) && emCondominio) {
    if (!quadra) avisos.push("Quadra ausente");
    if (!lote) avisos.push("Lote ausente");
  } else if (tipoCasa || tipoTerreno) {
    if (!numeroEnd) avisos.push("Sem número do endereço");
  } else if (tipo === "comercial") {
    if (!unidade && !numeroEnd) avisos.push("Sem número da sala/loja nem número do endereço");
  }

  // condições de pagamento consolidadas
  const cond = toList(get("payment_terms"));
  const fin = s(get("bank_financing"));
  const entrada = s(get("entry_value"));
  if (fin) cond.unshift(`Financiamento bancário: ${fin}`);
  if (entrada) cond.push(`Entrada: ${entrada}`);
  if (cond.length) rec.condicoes_pagamento = cond;

  // título — composto a partir do empreendimento/unidade, sem concatenar quadra/lote em unidade
  const partesTitulo = [
    empreendimento,
    unidade ? `Ap ${unidade}` : null,
    quadra ? `Quadra ${quadra}` : null,
    lote ? `Lote ${lote}` : null,
  ].filter(Boolean);
  rec.titulo =
    partesTitulo.join(" ") ||
    [s(get("property_type")), s(get("street")) && `${s(get("street"))} ${numeroEnd}`.trim(), s(get("neighborhood"))]
      .filter(Boolean)
      .join(" - ") ||
    "Imóvel importado";

  // data de inclusão original preservada
  const incluido = toDate(get("included_at"));
  if (incluido) rec.data_captacao = incluido;
  else if (s(get("included_at"))) avisos.push("Data de inclusão inválida");

  if (rec.responsavel_telefone && !rec.responsavel_whatsapp) rec.responsavel_whatsapp = rec.responsavel_telefone;

  const fpBase = [empreendimento, tipo, unidade, quadra, lote, s(get("city")), s(get("street")), numeroEnd].map(norm).join("|");
  return {
    row: linha.__row,
    registro: rec,
    empreendimento,
    erros,
    avisos,
    fingerprint: fpBase,
    exactFingerprint: `${fpBase}|${preco ?? ""}`,
  };
}

/** Fingerprint de um imóvel já existente no banco, no mesmo formato. */
export function fingerprintImovel(im: any): { fingerprint: string; exact: string } {
  const nome = im.empreendimento_nome ?? (im.titulo ?? "").split(/\s+(Ap|Quadra|Lote)\s+/i)[0];
  const base = [nome, im.tipo_imovel, im.unidade, im.quadra, im.lote, im.cidade, im.logradouro, im.numero]
    .map(norm)
    .join("|");
  return { fingerprint: base, exact: `${base}|${im.preco ?? ""}` };
}

// ------------------------------------------------------------------ template
function instrucoesRows() {
  return [
    ["Campo", "Obrigatório", "Como preencher"],
    ...MODELO_COLS.map((c) => [c.key, c.required ? "SIM" : "não", c.options ? `${c.help} Valores: ${c.options.join(" / ")}` : c.help]),
    [],
    ["REGRAS IMPORTANTES", "", ""],
    ["1", "", "property_name é o NOME DO EMPREENDIMENTO (ex.: PREMIUM, VELAS DA MARINA), nunca a classificação do imóvel."],
    ["2", "", "Apartamento/sala/loja usam unit_reference. Casa/lote em condomínio usam quadra e lote."],
    ["3", "", 'Nunca escrever "Quadra H Lote 17" em unit_reference — use as colunas separadas.'],
    ["4", "", "Imóvel de bairro sem quadra/lote: preencher street e numero_endereco."],
    ["5", "", "included_at é a data ORIGINAL de inclusão e nunca é substituída pela data da importação."],
    ["6", "", "Campos SIM/NÃO aceitam SIM, NÃO ou vazio."],
    ["7", "", "Listas (payment_terms, outras_caracteristicas) separam itens por ponto e vírgula (;)."],
    ["8", "", "O arquivo exportado pelo sistema usa exatamente estas colunas e pode ser reimportado."],
  ];
}

function exemplosRows() {
  const linhas: Record<string, any>[] = [
    { property_name: "PREMIUM", property_type: "Apartamento", unit_reference: "1004", city: "Capão da Canoa", neighborhood: "Navegantes", price_brl: 850000, bedrooms: 3, suites: 1, area_m2: 110, status: "Disponível", included_at: "01/03/2024" },
    { property_name: "VELAS DA MARINA", property_type: "Casa", quadra: "R4", lote: "10", city: "Capão da Canoa", price_brl: 1450000, bedrooms: 4, suites: 2, area_m2: 230, status: "Disponível" },
    { property_name: "ROYAL LAKE", property_type: "Lote", quadra: "H", lote: "17", city: "Xangri-Lá", price_brl: 620000, area_total: 450, status: "Disponível" },
    { property_type: "Casa", street: "Rua Brigada Militar", numero_endereco: "479", city: "Tramandaí", neighborhood: "Centro", price_brl: 520000, bedrooms: 3, status: "Disponível" },
    { property_type: "Sala Comercial", property_name: "CENTRO EMPRESARIAL", unit_reference: "907", city: "Capão da Canoa", price_brl: 380000, area_m2: 42, status: "Disponível" },
  ];
  return linhas.map((l) => Object.fromEntries(MODELO_HEADERS.map((h) => [h, l[h] ?? ""])));
}

function autoWidth(headers: string[]) {
  return headers.map((h) => ({ wch: Math.max(12, Math.min(28, h.length + 4)) }));
}

/** Gera o XLSX oficial (vazio ou com dados) com as abas Imóveis / INSTRUÇÕES / EXEMPLOS. */
export function gerarWorkbookOficial(dados: Record<string, any>[] = []): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const wsImoveis = XLSX.utils.json_to_sheet(dados.length ? dados : [], { header: MODELO_HEADERS });
  if (!dados.length) XLSX.utils.sheet_add_aoa(wsImoveis, [MODELO_HEADERS], { origin: "A1" });
  (wsImoveis as any)["!cols"] = autoWidth(MODELO_HEADERS);
  (wsImoveis as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsImoveis, "Imóveis");

  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoesRows());
  (wsInstr as any)["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "INSTRUÇÕES");

  const wsEx = XLSX.utils.json_to_sheet(exemplosRows(), { header: MODELO_HEADERS });
  (wsEx as any)["!cols"] = autoWidth(MODELO_HEADERS);
  XLSX.utils.book_append_sheet(wb, wsEx, "EXEMPLOS");

  const wsOpc = XLSX.utils.aoa_to_sheet([
    ["Campo", "Valores aceitos"],
    ...MODELO_COLS.filter((c) => c.options).map((c) => [c.key, c.options!.join(" / ")]),
  ]);
  (wsOpc as any)["!cols"] = [{ wch: 26 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsOpc, "LISTAS");

  return wb;
}

export function baixarModeloOficial() {
  XLSX.writeFile(gerarWorkbookOficial(), "MODELO_OFICIAL_IMOVEIS_MV_BROKER.xlsx");
}

// -------------------------------------------------------------- exportação
const LABEL_STATUS: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  inativo: "Inativo",
};

const LABEL_TIPO: Record<string, string> = {
  apartamento: "Apartamento",
  cobertura: "Cobertura",
  casa: "Casa",
  terreno: "Terreno",
  comercial: "Comercial",
  rural: "Rural",
};

/** Converte imóveis do banco em linhas no MESMO layout do modelo (100% reimportável). */
export function imoveisParaLinhasOficiais(imoveis: any[], nomePorImovel?: Map<string, string>): Record<string, any>[] {
  return imoveis.map((im) => {
    const out: Record<string, any> = {};
    for (const col of MODELO_COLS) {
      let v: any = "";
      if (col.db) {
        const raw = im[col.db];
        if (col.type === "bool") v = raw === true ? "SIM" : raw === false ? "NÃO" : "";
        else if (col.type === "list") v = Array.isArray(raw) ? raw.join("; ") : (raw ?? "");
        else if (col.type === "date" && raw) v = String(raw).slice(0, 10).split("-").reverse().join("/");
        else v = raw ?? "";
      }
      out[col.key] = v;
    }
    out.status = LABEL_STATUS[im.status_imovel] ?? im.status_imovel ?? "";
    out.property_type = LABEL_TIPO[im.tipo_imovel] ?? im.tipo_imovel ?? "";
    out.property_name = nomePorImovel?.get(im.id) ?? im.empreendimento_nome ?? "";
    return out;
  });
}

export function exportarImoveisOficial(imoveis: any[], nomePorImovel?: Map<string, string>, filename = "IMOVEIS_MV_BROKER.xlsx") {
  const wb = gerarWorkbookOficial(imoveisParaLinhasOficiais(imoveis, nomePorImovel));
  XLSX.writeFile(wb, filename);
}
