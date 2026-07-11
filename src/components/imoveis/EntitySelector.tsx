import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EntityOption = {
  id: string;
  nome: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  infraestrutura?: string[] | null;
};

export function EntitySelector({
  id,
  label,
  icon,
  table,
  value,
  onChange,
  onSelect,
  openId,
  setOpenId,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  table: "edificios" | "condominios" | "empreendimentos" | "loteamentos";
  value: string;
  onChange: (id: string) => void;
  onSelect: (entity: EntityOption) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const open = openId === id;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from(table as any)
        .select("id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, infraestrutura")
        .order("nome");
      if (data) setOptions(data as any);
    })();
  }, [table]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenId(null);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, setOpenId]);

  const filtered = options.filter((o) => o.nome.toLowerCase().includes(search.toLowerCase()));
  const selectedName = options.find((o) => o.id === value)?.nome ?? "";

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <Label className="text-xs flex items-center gap-1">
        {icon} {label}
      </Label>
      <div className="relative">
        <Input
          placeholder={`Buscar ${label.toLowerCase()}...`}
          value={open ? search : selectedName}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpenId(id);
          }}
          onFocus={() => setOpenId(id)}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSearch("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                onSelect(o);
                setSearch("");
                setOpenId(null);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <span className="font-medium">{o.nome}</span>
              {o.cidade && <span className="text-muted-foreground ml-2 text-xs">• {o.cidade}</span>}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          Nenhum encontrado
        </div>
      )}
    </div>
  );
}
