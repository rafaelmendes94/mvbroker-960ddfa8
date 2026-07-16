// Descriptors compartilhados dos campos específicos de cada tipo de estrutura.
// Usados tanto no formulário (EstruturaPage) quanto na visualização (EspelhoSheet).

export type CampoTipo = "text" | "number" | "currency" | "date" | "select";

export interface CampoDescriptor {
  key: string;
  label: string;
  type?: CampoTipo;
  options?: { value: string; label: string }[];
}

const VALORES: CampoDescriptor[] = [
  { key: "valor_condominio", label: "Valor do condomínio", type: "currency" },
  { key: "valor_iptu", label: "Valor do IPTU", type: "currency" },
];

export const CAMPOS_POR_TIPO: Record<string, CampoDescriptor[]> = {
  edificio: [
    { key: "qtd_andares", label: "Qtd. andares", type: "number" },
    { key: "qtd_elevadores", label: "Qtd. elevadores", type: "number" },
    { key: "qtd_apartamentos", label: "Qtd. apartamentos", type: "number" },
    { key: "ano_construcao", label: "Ano de construção", type: "number" },
    { key: "construtora", label: "Construtora" },
    ...VALORES,
  ],
  condominio: [
    { key: "tipo_condominio", label: "Tipo de condomínio" },
    { key: "numero_lotes", label: "Número de lotes", type: "number" },
    { key: "portaria", label: "Portaria" },
    { key: "seguranca", label: "Segurança" },
    { key: "area_total", label: "Área total (m²)", type: "number" },
    ...VALORES,
  ],
  empreendimento: [
    { key: "construtora", label: "Construtora" },
    { key: "incorporadora", label: "Incorporadora" },
    { key: "status_obra", label: "Status da obra", type: "select", options: [
      { value: "lancamento", label: "Lançamento" },
      { value: "em_obras", label: "Em Obras" },
      { value: "pronto", label: "Pronto" },
      { value: "entregue", label: "Entregue" },
    ] },
    { key: "data_lancamento", label: "Data de lançamento", type: "date" },
    { key: "data_prevista_entrega", label: "Data prevista entrega", type: "date" },
    { key: "data_entrega_efetiva", label: "Data entrega efetiva", type: "date" },
  ],
  loteamento: [
    { key: "area_total_m2", label: "Área total (m²)", type: "number" },
    { key: "total_lotes", label: "Total de lotes", type: "number" },
    { key: "lotes_disponiveis", label: "Lotes disponíveis", type: "number" },
    ...VALORES,
  ],
};

export function formatCampo(v: unknown, tipo?: CampoTipo): string {
  if (v == null || v === "") return "—";
  if (tipo === "currency") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (tipo === "date") {
    try {
      const d = new Date(String(v));
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    } catch { /* noop */ }
  }
  return String(v);
}
