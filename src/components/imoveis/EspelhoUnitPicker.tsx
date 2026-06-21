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

const TABLE: Record<EmpTipo, string> = {
  edificio: "edificios",
  condominio: "condominios",
  loteamento: "loteamentos",
};

function padNum(g: number, u: number) {
  return g.toString() + u.toString().padStart(2, "0");
}

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
  const [config, setConfig] = useState<{ grupos: number; porGrupo: number } | null>(null);
  const labels = LABELS[tipo];
  const grupoListId = useId();
  const numeroListId = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [espRes, empRes] = await Promise.all([
        supabase
          .from("espelho_unidades")
          .select("id, grupo, numero, status, imovel_id")
          .eq("empreendimento_tipo", tipo)
          .eq("empreendimento_id", empreendimentoId)
          .order("grupo", { ascending: false })
          .order("numero", { ascending: true }),
        supabase
          .from(TABLE[tipo] as any)
          .select("*")
          .eq("id", empreendimentoId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setRows((espRes.data as any) ?? []);
      const e: any = empRes.data;
      if (e) {
        const grupos =
          Number(e.espelho_grupos) ||
          (tipo === "edificio" ? Number(e.qtd_andares) : 0) || 0;
        const porGrupo =
          Number(e.espelho_por_grupo) ||
          (tipo === "edificio" ? Number(e.qtd_apartamentos) : 0) || 0;
        setConfig({ grupos, porGrupo });
      } else {
        setConfig({ grupos: 0, porGrupo: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [tipo, empreendimentoId]);

  // Mapa de ocupação: numero -> imovel_id (ou null se reservado sem imóvel)
  const occMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) m.set(r.numero, r);
    return m;
  }, [rows]);

  // Gera lista completa a partir do config + qualquer linha extra do espelho
  const gerados = useMemo(() => {
    const set = new Map<string, { grupo: number; numero: string }>();
    if (config && config.grupos > 0 && config.porGrupo > 0) {
      for (let g = config.grupos; g >= 1; g--) {
        for (let u = 1; u <= config.porGrupo; u++) {
          const numero = padNum(g, u);
          set.set(numero, { grupo: g, numero });
        }
      }
    }
    for (const r of rows) {
      if (!set.has(r.numero)) set.set(r.numero, { grupo: r.grupo, numero: r.numero });
    }
    return Array.from(set.values());
  }, [config, rows]);

  const isFree = (numero: string) => {
    const r = occMap.get(numero);
    if (!r) return true; // não existe no espelho ainda → livre
    if (r.imovel_id == null) return true;
    return currentImovelId != null && r.imovel_id === currentImovelId;
  };

  const grupos = useMemo(() => {
    const set = new Set<number>();
    for (const x of gerados) if (isFree(x.numero)) set.add(x.grupo);
    return Array.from(set).sort((a, b) => b - a);
  }, [gerados, occMap, currentImovelId]);

  const unidadesSugeridas = useMemo(() => {
    const g = valueGrupo ? Number(valueGrupo) : null;
    return gerados
      .filter((x) => isFree(x.numero) && (g == null || x.grupo === g))
      .sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
  }, [gerados, valueGrupo, occMap, currentImovelId]);

  const totalLivres = useMemo(
    () => gerados.filter((x) => isFree(x.numero)).length,
    [gerados, occMap, currentImovelId]
  );

  const semConfig = config != null && (config.grupos === 0 || config.porGrupo === 0) && rows.length === 0;

  const handleNumeroChange = (v: string) => {
    const row = gerados.find((r) => r.numero === v);
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
          placeholder={grupos[0] ? `Ex.: ${grupos[0]}` : "Digite"}
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
          <span className="text-[10px] text-muted-foreground">{totalLivres} livres</span>
        </div>
        <Input
          list={numeroListId}
          value={valueNumero}
          onChange={(e) => handleNumeroChange(e.target.value)}
          placeholder="Digite ou escolha"
        />
        <datalist id={numeroListId}>
          {unidadesSugeridas.map((r) => (
            <option key={r.numero} value={r.numero}>
              {labels.grupo} {r.grupo} — {r.numero}
            </option>
          ))}
        </datalist>
        {semConfig && (
          <p className="text-[10px] text-amber-600">
            Configure {labels.grupo.toLowerCase()}s/{labels.unidade.toLowerCase()}s no cadastro do {tipo} para ver sugestões.
          </p>
        )}
      </div>
    </>
  );
}
