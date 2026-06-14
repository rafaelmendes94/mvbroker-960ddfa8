import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function InfraToggle({
  label,
  options,
  selected,
  onChange,
  allowCustom = false,
}: {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (sel: string[]) => void;
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState("");
  const all = Array.from(new Set([...(options || []), ...(selected || [])]));

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  }

  function addCustom() {
    const v = custom.trim();
    if (!v || selected.includes(v)) return;
    onChange([...selected, v]);
    setCustom("");
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-semibold">{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {all.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma opção cadastrada.</p>
        )}
        {all.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent",
              )}
            >
              {opt}
              {active && <X className="inline w-3 h-3 ml-1" />}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Adicionar item..."
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className="flex-1 sm:max-w-xs h-9"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustom}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
