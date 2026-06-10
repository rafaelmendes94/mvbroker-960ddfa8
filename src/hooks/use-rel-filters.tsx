import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type RelFilters = {
  periodoDias: number; // 30, 90, 180, 365, 0=all
  cidade: string;
  tipo: string;
  status: string;
  portalId: string;
};

const DEFAULT: RelFilters = { periodoDias: 90, cidade: "", tipo: "", status: "", portalId: "" };

const Ctx = createContext<{
  filters: RelFilters;
  setFilters: (f: Partial<RelFilters>) => void;
  reset: () => void;
}>({ filters: DEFAULT, setFilters: () => {}, reset: () => {} });

export function RelatoriosFiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RelFilters>(DEFAULT);
  const value = useMemo(
    () => ({
      filters: state,
      setFilters: (f: Partial<RelFilters>) => setState((s) => ({ ...s, ...f })),
      reset: () => setState(DEFAULT),
    }),
    [state]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRelFilters() {
  return useContext(Ctx);
}

export function sinceISO(periodoDias: number): string | null {
  if (!periodoDias) return null;
  return new Date(Date.now() - periodoDias * 86400000).toISOString();
}
