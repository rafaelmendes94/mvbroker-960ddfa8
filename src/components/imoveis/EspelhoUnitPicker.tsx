import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmpTipo = "edificio" | "condominio" | "loteamento";

type Row = {
  id: string;
  grupo: number;
  numero: string;
  status: string;
  imovel_id: string | null;
};

const LABELS: Record<EmpTipo, { grupo: string; unidade: string }> = {
  edificio: { grupo: "Andar", unidade: "Unidade" },
  condominio: { grupo: "Bloco", unidade: "Unidade" },
  loteamento: { grupo: "Quadra", unidade: "Lote" },
};

export function EspelhoUnitPicker({
  tipo,
  empreendimentoId,
  currentImovelId,
  valueNumero,
  onPick,
  onClear,
}: {
  tipo: EmpTipo;
  empreendimentoId: string;
  currentImovelId?: string | null;
  /** Valor atual do form (form.unidade ou form.lote) — usado para pré-selecionar mesmo se já vendido. */
  valueNumero: string;
  onPick: (info: { grupo: number; numero: string }) => void;
  onClear: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<string>("");

  const labels = LABELS[tipo];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("espelho_unidades")
        .select("id, grupo, numero, status, imovel_id")
        .eq("empreendimento_tipo", tipo)
        .eq("empreendimento_id", empreendimentoId)
        .order("grupo", { ascending: false })
        .order("numero", { ascending: true });
      if (!cancelled) {
        setRows((data as any) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tipo, empreendimentoId]);

  // Pré-seleciona o grupo da unidade atual
  useEffect(() => {
    if (!rows || !valueNumero) return;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
    const current = rows.find((r) => norm(r.numero) === norm(valueNumero));
    if (current) setGrupo(String(current.grupo));
  }, [rows, valueNumero]);

  // Unidades "selecionáveis" = livre OU a atual deste imóvel OU a que bate com o valueNumero atual
  const isSelectable = (r: Row) => {
    if (r.imovel_id == null && r.status === "indisponivel") return true;
    if (currentImovelId && r.imovel_id === currentImovelId) return true;
    if (valueNumero && r.numero.trim().toLowerCase() === valueNumero.trim().toLowerCase()) return true;
    return false;
  };

  const grupos = useMemo(() => {
    if (!rows) return [];
    const set = new Set<number>();
    for (const r of rows) {
      if (isSelectable(r)) set.add(r.grupo);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [rows, currentImovelId, valueNumero]);

  const unidadesDoGrupo = useMemo(() => {
    if (!rows || !grupo) return [];
    const g = Number(grupo);
    return rows
      .filter((r) => r.grupo === g && isSelectable(r))
      .sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
  }, [rows, grupo, currentImovelId, valueNumero]);

  const totalLivres = useMemo(
    () => (rows ?? []).filter((r) => r.imovel_id == null && r.status === "indisponivel").length,
    [rows],
  );

  // Sem espelho → fallback input livre
  if (!loading && rows && rows.length === 0) {
    return (
      <div className="sm:col-span-2 space-y-1.5">
        <Label className="text-xs">{labels.unidade}</Label>
        <Input value={valueNumero} onChange={(e) => onPick({ grupo: 0, numero: e.target.value })} />
        <p className="text-[11px] text-muted-foreground">
          Esse {tipo} ainda não tem espelho gerado — preencha andares/unidades no cadastro dele.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">{labels.grupo}</Label>
        <Select
          value={grupo}
          onValueChange={(v) => {
            setGrupo(v);
            onClear();
          }}
          disabled={loading || grupos.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Carregando..." : `Selecione o ${labels.grupo.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {grupos.map((g) => (
              <SelectItem key={g} value={String(g)}>
                {labels.grupo} {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">{labels.unidade}</Label>
          <span className="text-[10px] text-muted-foreground">{totalLivres} livres</span>
        </div>
        <Select
          value={valueNumero}
          onValueChange={(v) => {
            const row = unidadesDoGrupo.find((r) => r.numero === v);
            if (row) onPick({ grupo: row.grupo, numero: row.numero });
          }}
          disabled={loading || !grupo || unidadesDoGrupo.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={!grupo ? `Escolha o ${labels.grupo.toLowerCase()} primeiro` : "Selecione"} />
          </SelectTrigger>
          <SelectContent>
            {unidadesDoGrupo.map((r) => {
              const isCurrent = currentImovelId && r.imovel_id === currentImovelId;
              const occupied = r.imovel_id != null && !isCurrent;
              return (
                <SelectItem key={r.id} value={r.numero}>
                  {r.numero}
                  {isCurrent ? " (atual)" : ""}
                  {occupied ? ` • ${r.status}` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
