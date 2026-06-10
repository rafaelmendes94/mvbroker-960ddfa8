import { useMemo } from "react";
import type { ImportField } from "@/lib/import-schemas";

type Props = {
  fields: ImportField[];
  headers: string[];
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
};

export function ColumnMapper({ fields, headers, mapping, onChange }: Props) {
  const groups = useMemo(() => {
    const g: Record<string, ImportField[]> = {};
    for (const f of fields) {
      const k = f.group || "Geral";
      (g[k] ||= []).push(f);
    }
    return g;
  }, [fields]);

  const set = (key: string, val: string) => onChange({ ...mapping, [key]: val });

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([group, list]) => (
        <div key={group}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {group}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {list.map((f) => {
              const used = mapping[f.key] || "";
              return (
                <div key={f.key} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {f.label}
                      {f.required && <span className="text-destructive ml-1">*</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{f.type}</div>
                  </div>
                  <select
                    value={used}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background min-w-[140px] max-w-[200px]"
                  >
                    <option value="">— ignorar —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
