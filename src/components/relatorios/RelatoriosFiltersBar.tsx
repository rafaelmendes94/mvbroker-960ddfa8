import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRelFilters } from "@/hooks/use-rel-filters";

const PERIODOS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "6 meses" },
  { value: "365", label: "1 ano" },
  { value: "0", label: "Tudo" },
];

const ALL = "__all__";

export function RelatoriosFiltersBar() {
  const { filters, setFilters, reset } = useRelFilters();
  const [cidades, setCidades] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [portais, setPortais] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [imv, port] = await Promise.all([
        supabase.from("imoveis").select("cidade, tipo_imovel, status_imovel").limit(5000),
        supabase.from("portais").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      const rows = (imv.data ?? []) as { cidade: string | null; tipo_imovel: string | null; status_imovel: string | null }[];
      setCidades([...new Set(rows.map((r) => r.cidade).filter(Boolean) as string[])].sort());
      setTipos([...new Set(rows.map((r) => r.tipo_imovel).filter(Boolean) as string[])].sort());
      setStatuses([...new Set(rows.map((r) => r.status_imovel).filter(Boolean) as string[])].sort());
      setPortais((port.data ?? []) as { id: string; nome: string }[]);
    })();
  }, []);

  const val = (v: string) => (v === "" ? ALL : v);
  const toFilter = (v: string) => (v === ALL ? "" : v);

  return (
    <Card className="mb-4">
      <CardContent className="p-3 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Período"
          value={String(filters.periodoDias)}
          onChange={(v) => setFilters({ periodoDias: Number(v) })}
          options={PERIODOS}
          width="w-32"
        />
        <FilterSelect
          label="Cidade"
          value={val(filters.cidade)}
          onChange={(v) => setFilters({ cidade: toFilter(v) })}
          options={[{ value: ALL, label: "Todas" }, ...cidades.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          label="Tipo"
          value={val(filters.tipo)}
          onChange={(v) => setFilters({ tipo: toFilter(v) })}
          options={[{ value: ALL, label: "Todos" }, ...tipos.map((t) => ({ value: t, label: t }))]}
        />
        <FilterSelect
          label="Status"
          value={val(filters.status)}
          onChange={(v) => setFilters({ status: toFilter(v) })}
          options={[{ value: ALL, label: "Todos" }, ...statuses.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label="Portal"
          value={val(filters.portalId)}
          onChange={(v) => setFilters({ portalId: toFilter(v) })}
          options={[{ value: ALL, label: "Todos" }, ...portais.map((p) => ({ value: p.id, label: p.nome }))]}
        />
        <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
          <RotateCcw className="h-4 w-4" /> Limpar
        </Button>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label, value, onChange, options, width = "w-44",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`h-9 ${width}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
