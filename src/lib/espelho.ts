export type UnitStatus = "disponivel" | "reservado" | "vendido";
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
}

export const STATUS_CONFIG: Record<
  UnitStatus,
  { label: string; bgClass: string; dotClass: string; cellClass: string }
> = {
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

const TIPOLOGIAS_BY_POS: Record<number, { tipo: Tipologia; area: number; suites: number; vagas: number }> = {
  1: { tipo: "studio", area: 35, suites: 0, vagas: 1 },
  2: { tipo: "1quarto", area: 52, suites: 1, vagas: 1 },
  3: { tipo: "2quartos", area: 72, suites: 1, vagas: 1 },
  4: { tipo: "3quartos", area: 98, suites: 2, vagas: 2 },
  5: { tipo: "2quartos", area: 68, suites: 1, vagas: 1 },
  6: { tipo: "1quarto", area: 48, suites: 1, vagas: 1 },
};

export function generateUnits(
  tipo: EmpreendimentoTipo,
  empreendimentoId: string,
  grupos: number,
  porGrupo: number,
): Omit<Unit, "id">[] {
  const out: Omit<Unit, "id">[] = [];
  for (let g = grupos; g >= 1; g--) {
    for (let u = 1; u <= porGrupo; u++) {
      if (tipo === "loteamento") {
        const numero = `Q${g}-L${String(u).padStart(2, "0")}`;
        out.push({
          empreendimento_tipo: tipo,
          empreendimento_id: empreendimentoId,
          grupo: g,
          numero,
          status: "disponivel",
          valor: null,
          area: 250,
          tipologia: "lote",
          vagas: null,
          suites: null,
          nascente: u % 2 === 0,
        });
      } else {
        const isTop = g >= grupos - 1;
        const pos = TIPOLOGIAS_BY_POS[u] || TIPOLOGIAS_BY_POS[1];
        const tipologia: Tipologia = isTop && u === porGrupo ? "cobertura" : pos.tipo;
        const area = isTop && tipologia === "cobertura" ? 145 : pos.area;
        const numero =
          tipo === "condominio"
            ? `B${g}-${String(u).padStart(2, "0")}`
            : `${g}${String(u).padStart(2, "0")}`;
        out.push({
          empreendimento_tipo: tipo,
          empreendimento_id: empreendimentoId,
          grupo: g,
          numero,
          status: "disponivel",
          valor: 400000 + g * 50000 + (u === porGrupo ? 100000 : 0),
          area,
          tipologia,
          vagas: tipologia === "cobertura" ? 3 : pos.vagas,
          suites: tipologia === "cobertura" ? 3 : pos.suites,
          nascente: u % 2 === 0,
        });
      }
    }
  }
  return out;
}

export const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
