import { useSyncExternalStore } from "react";
import type { ParsedFile } from "@/lib/import-runner";

export type Etapa = "arquivo" | "mapeamento" | "processando" | "revisao" | "resultado";

export type ReviewItem = {
  i: number;
  dados: Record<string, any>;
  decisao: "criar" | "atualizar" | "ignorar";
  pendente: boolean;
  alvoId?: string;
  alvoTitulo?: string;
  motivo?: string;
};

export type ImportIaState = {
  etapa: Etapa;
  parsed: ParsedFile | null;
  fileName: string;
  mapping: Record<string, string>;
  statusPadrao: string;
  forcarStatus: boolean;
  progresso: string;
  pct: number;
  itens: ReviewItem[];
  resultado: any;
  erro: string;
  /** true quando a sessão foi restaurada mas as linhas do arquivo não couberam no armazenamento */
  linhasPerdidas: boolean;
};

const KEY = "mvbroker:import-ia";
const MAX_BYTES = 4_000_000;

function initialState(): ImportIaState {
  return {
    etapa: "arquivo",
    parsed: null,
    fileName: "",
    mapping: {},
    statusPadrao: "disponivel",
    forcarStatus: false,
    progresso: "",
    pct: 0,
    itens: [],
    resultado: null,
    erro: "",
    linhasPerdidas: false,
  };
}

let state: ImportIaState = initialState();
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as ImportIaState;
    const semLinhas = !saved.parsed || !Array.isArray(saved.parsed.rows) || saved.parsed.rows.length === 0;
    state = {
      ...initialState(),
      ...saved,
      // um processamento interrompido pela navegação não pode ser retomado
      etapa: saved.etapa === "processando" ? (saved.itens?.length ? "revisao" : "mapeamento") : saved.etapa,
      progresso: "",
      pct: 0,
      linhasPerdidas: semLinhas && saved.etapa !== "arquivo" && saved.etapa !== "resultado",
    };
    if (state.linhasPerdidas) {
      state.etapa = "arquivo";
      state.parsed = null;
      state.itens = [];
    }
  } catch {
    state = initialState();
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      if (state.etapa === "arquivo" && !state.parsed && !state.resultado) {
        sessionStorage.removeItem(KEY);
        return;
      }
      let payload = JSON.stringify(state);
      if (payload.length > MAX_BYTES) {
        payload = JSON.stringify({
          ...state,
          parsed: state.parsed ? { ...state.parsed, rows: [] } : null,
        });
      }
      if (payload.length > MAX_BYTES) return;
      sessionStorage.setItem(KEY, payload);
    } catch {
      /* armazenamento cheio — segue sem persistir */
    }
  }, 250);
}

function emit() {
  for (const l of listeners) l();
  persist();
}

export function getImportIaState(): ImportIaState {
  hydrate();
  return state;
}

export function setImportIa(patch: Partial<ImportIaState> | ((s: ImportIaState) => Partial<ImportIaState>)) {
  hydrate();
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}

export function resetImportIa() {
  state = initialState();
  hydrated = true;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useImportIaState(): ImportIaState {
  return useSyncExternalStore(subscribe, getImportIaState, initialState);
}
