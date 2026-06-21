export type UnitStatus = "indisponivel" | "disponivel" | "reservado" | "vendido";
export type Tipologia = "studio" | "1quarto" | "2quartos" | "3quartos" | "cobertura" | "lote";
export type EmpreendimentoTipo = "edificio" | "condominio" | "loteamento";

export interface Unit {
  id: string;
  empreendimento_tipo: EmpreendimentoTipo;
  empreendimento_id: string;
  grupo: number; // andar / bloco / quadra
  numero: string;
  status: UnitStatus;
  valor: number | null;
  area: number | null;
  tipologia: Tipologia | null;
  vagas: number | null;
  suites: number | null;
  nascente: boolean;
  observacoes?: string | null;
  imovel_id?: string | null;
}

export const TIPO_TO_IMOVEL_FK: Record<EmpreendimentoTipo, "edificio_id" | "condominio_id" | "loteamento_id"> = {
  edificio: "edificio_id",
  condominio: "condominio_id",
  loteamento: "loteamento_id",
};

export const STATUS_CONFIG: Record<
  UnitStatus,
  { label: string; bgClass: string; dotClass: string; cellClass: string }
> = {
  indisponivel: {
    label: "Indisponível",
    bgClass: "bg-muted-foreground",
    dotClass: "bg-muted-foreground",
    cellClass:
      "bg-muted/40 border-muted-foreground/30 text-muted-foreground hover:bg-muted/60",
  },
  disponivel: {
    label: "Disponível",
    bgClass: "bg-success",
    dotClass: "bg-success",
    cellClass:
      "bg-success/15 border-success/40 text-success hover:bg-success/25",
  },
  reservado: {
    label: "Reservado",
    bgClass: "bg-warning",
    dotClass: "bg-warning",
    cellClass:
      "bg-warning/15 border-warning/40 text-warning hover:bg-warning/25",
  },
  vendido: {
    label: "Vendido",
    bgClass: "bg-destructive",
    dotClass: "bg-destructive",
    cellClass:
      "bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25",
  },
};


export const TIPOLOGIA_CONFIG: Record<Tipologia, { label: string }> = {
  studio: { label: "Studio" },
  "1quarto": { label: "1 Quarto" },
  "2quartos": { label: "2 Quartos" },
  "3quartos": { label: "3 Quartos" },
  cobertura: { label: "Cobertura" },
  lote: { label: "Lote" },
};

export const TIPO_LABELS: Record<
  EmpreendimentoTipo,
  { grupo: string; grupoPlural: string; unidade: string; unidadePlural: string; table: "edificios" | "condominios" | "loteamentos" }
> = {
  edificio: { grupo: "Andar", grupoPlural: "andares", unidade: "Unidade", unidadePlural: "unidades", table: "edificios" },
  condominio: { grupo: "Bloco", grupoPlural: "blocos", unidade: "Unidade", unidadePlural: "unidades", table: "condominios" },
  loteamento: { grupo: "Quadra", grupoPlural: "quadras", unidade: "Lote", unidadePlural: "lotes", table: "loteamentos" },
};

/**
 * Cria apenas os "esqueletos" das unidades (número sequencial + status disponível),
 * SEM valores fictícios. O usuário preenche os dados depois manualmente ou via CSV.
 */
export function generateSkeleton(
  tipo: EmpreendimentoTipo,
  empreendimentoId: string,
  grupos: number,
  porGrupo: number,
): Omit<Unit, "id">[] {
  const out: Omit<Unit, "id">[] = [];
  for (let g = grupos; g >= 1; g--) {
    for (let u = 1; u <= porGrupo; u++) {
      const numero =
        tipo === "loteamento"
          ? `Q${g}-L${String(u).padStart(2, "0")}`
          : tipo === "condominio"
            ? `B${g}-${String(u).padStart(2, "0")}`
            : `${g}${String(u).padStart(2, "0")}`;
      out.push({
        empreendimento_tipo: tipo,
        empreendimento_id: empreendimentoId,
        grupo: g,
        numero,
        status: "disponivel",
        valor: null,
        area: null,
        tipologia: tipo === "loteamento" ? "lote" : null,
        vagas: null,
        suites: null,
        nascente: false,
      });
    }
  }
  return out;
}

export const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Cabeçalho CSV esperado (case-insensitive). */
export const CSV_HEADERS = [
  "grupo", "numero", "valor", "area", "tipologia", "vagas", "suites", "nascente", "status", "observacoes",
] as const;

export const CSV_TEMPLATE =
  "grupo,numero,valor,area,tipologia,vagas,suites,nascente,status,observacoes\n" +
  "1,101,450000,72,2quartos,1,1,sim,disponivel,\n" +
  "1,102,520000,98,3quartos,2,2,nao,reservado,Vista frontal\n";

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const TRUTHY = new Set(["sim", "s", "yes", "y", "true", "1", "x"]);
const VALID_STATUS = new Set<UnitStatus>(["disponivel", "reservado", "vendido"]);
const VALID_TIPOLOGIA = new Set<Tipologia>(["studio", "1quarto", "2quartos", "3quartos", "cobertura", "lote"]);

export interface CSVParseResult {
  rows: Omit<Unit, "id">[];
  errors: string[];
}

export function parseEspelhoCSV(
  text: string,
  tipo: EmpreendimentoTipo,
  empreendimentoId: string,
): CSVParseResult {
  const errors: string[] = [];
  const rows: Omit<Unit, "id">[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ["Arquivo vazio"] };

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iGrupo = col("grupo"), iNumero = col("numero");
  if (iGrupo < 0 || iNumero < 0) {
    return { rows, errors: ["CSV precisa ter ao menos as colunas: grupo, numero"] };
  }
  const iValor = col("valor"), iArea = col("area"), iTip = col("tipologia"),
    iVagas = col("vagas"), iSuites = col("suites"), iNasc = col("nascente"),
    iStatus = col("status"), iObs = col("observacoes");

  for (let r = 1; r < lines.length; r++) {
    const cells = parseCSVLine(lines[r]);
    const ln = r + 1;
    const grupo = parseInt(cells[iGrupo] ?? "", 10);
    const numero = (cells[iNumero] ?? "").trim();
    if (!numero) { errors.push(`Linha ${ln}: número vazio`); continue; }
    if (!Number.isFinite(grupo) || grupo < 1) { errors.push(`Linha ${ln}: grupo inválido`); continue; }

    const num = (idx: number) => {
      if (idx < 0) return null;
      const v = (cells[idx] ?? "").replace(/\./g, "").replace(",", ".").trim();
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const tipStr = iTip >= 0 ? (cells[iTip] ?? "").trim().toLowerCase() : "";
    const statusStr = iStatus >= 0 ? (cells[iStatus] ?? "").trim().toLowerCase() : "disponivel";
    const tipologia = VALID_TIPOLOGIA.has(tipStr as Tipologia) ? (tipStr as Tipologia) : (tipo === "loteamento" ? "lote" : null);
    const status: UnitStatus = VALID_STATUS.has(statusStr as UnitStatus) ? (statusStr as UnitStatus) : "disponivel";

    rows.push({
      empreendimento_tipo: tipo,
      empreendimento_id: empreendimentoId,
      grupo,
      numero,
      status,
      valor: num(iValor),
      area: num(iArea),
      tipologia,
      vagas: num(iVagas),
      suites: num(iSuites),
      nascente: iNasc >= 0 ? TRUTHY.has((cells[iNasc] ?? "").trim().toLowerCase()) : false,
      observacoes: iObs >= 0 ? ((cells[iObs] ?? "").trim() || null) : null,
    });
  }
  return { rows, errors };
}

