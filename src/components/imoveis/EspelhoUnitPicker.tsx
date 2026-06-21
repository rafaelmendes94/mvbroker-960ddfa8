import { useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  valueGrupo,
  onPick,
  onClear: _onClear,
}: {
  tipo: EmpTipo;
  empreendimentoId: string;
  currentImovelId?: string | null;
  valueNumero: string;
  valueGrupo?: string;
  onPick: (info: { grupo: string; numero: string }) => void;
  onClear?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const labels = LABELS[tipo];
  const grupoListId = useId();
  const numeroListId = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("espelho_unidades")
        .select("id, grupo, numero, status, imovel_id")
        .eq("empreendimento_tipo", tipo)
        .eq("empreendimento_id", empreendimentoId)
        .order("grupo", { ascending: false })
        .order("numero", { ascending: true });
      if (!cancelled) setRows((data as any) ?? []);
    })();
    return () => { cancelled = true; };
  }, [tipo, empreendimentoId]);

  const isFree = (r: Row) =>
    (r.imovel_id == null && r.status === "indisponivel") ||
    (currentImovelId != null && r.imovel_id === currentImovelId);

  const grupos = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) if (isFree(r)) set.add(r.grupo);
    return Array.from(set).sort((a, b) => b - a);
  }, [rows, currentImovelId]);

  const unidadesSugeridas = useMemo(() => {
    const g = valueGrupo ? Number(valueGrupo) : null;
    return rows
      .filter((r) => isFree(r) && (g == null || r.grupo === g))
      .sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
  }, [rows, valueGrupo, currentImovelId]);

  const totalLivres = useMemo(() => rows.filter(isFree).length, [rows, currentImovelId]);

  const handleNumeroChange = (v: string) => {
    const row = rows.find((r) => r.numero === v);
    if (row) onPick({ grupo: String(row.grupo), numero: row.numero });
    else onPick({ grupo: valueGrupo ?? "", numero: v });
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">{labels.grupo}</Label>
        <Input
          list={grupoListId}
          value={valueGrupo ?? ""}
          onChange={(e) => onPick({ grupo: e.target.value, numero: valueNumero })}
          placeholder={`Ex.: ${grupos[0] ?? ""}`}
        />
        <datalist id={grupoListId}>
          {grupos.map((g) => (
            <option key={g} value={String(g)}>{labels.grupo} {g}</option>
          ))}
        </datalist>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">{labels.unidade}</Label>
          <span className="text-[10px] text-muted-foreground">{totalLivres} livres no espelho</span>
        </div>
        <Input
          list={numeroListId}
          value={valueNumero}
          onChange={(e) => handleNumeroChange(e.target.value)}
          placeholder="Digite ou escolha uma sugestão"
        />
        <datalist id={numeroListId}>
          {unidadesSugeridas.map((r) => (
            <option key={r.id} value={r.numero}>
              {labels.grupo} {r.grupo} — {r.numero}
            </option>
          ))}
        </datalist>
      </div>
    </>
  );
}
