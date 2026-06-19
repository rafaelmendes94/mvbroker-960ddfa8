import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * QuickPick com botão "+" para criar nova opção que fica salva globalmente
 * (catálogo system_options) e disponível em todos os próximos cadastros.
 *
 * Suporta seleção única (multi=false) ou múltipla (multi=true).
 */
export function QuickPickEditable({
  label,
  icon,
  options,
  value,
  onChange,
  onAddOption,
  className,
  multi = false,
  placeholder = "Nova opção...",
}: {
  label?: string;
  icon?: React.ReactNode;
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  /** Persiste no catálogo global e retorna o nome adicionado (ou null em erro). */
  onAddOption: (nome: string) => Promise<{ nome: string } | null>;
  className?: string;
  multi?: boolean;
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = multi ? (Array.isArray(value) ? value : []) : [];

  const all = Array.from(
    new Set([
      ...(options || []),
      ...(multi ? selected : value && typeof value === "string" ? [value] : []),
    ]),
  );

  function pick(opt: string) {
    if (multi) {
      const cur = Array.isArray(value) ? value : [];
      onChange(cur.includes(opt) ? cur.filter((s) => s !== opt) : [...cur, opt]);
    } else {
      onChange(opt);
    }
  }

  async function commitAdd() {
    const v = draft.trim();
    if (!v) {
      setAdding(false);
      return;
    }
    setBusy(true);
    const res = await onAddOption(v);
    setBusy(false);
    if (!res) {
      toast.error("Não foi possível salvar a opção");
      return;
    }
    setDraft("");
    setAdding(false);
    // Auto-seleciona a nova opção
    if (multi) {
      const cur = Array.isArray(value) ? value : [];
      if (!cur.includes(res.nome)) onChange([...cur, res.nome]);
    } else {
      onChange(res.nome);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-xs flex items-center gap-1">
          {icon} {label}
        </Label>
      )}
      <div className="flex flex-wrap gap-1.5 items-center">
        {all.map((opt) => {
          const active = multi
            ? selected.includes(opt)
            : String(value) === String(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted",
              )}
            >
              {opt}
              {multi && active && <X className="inline w-3 h-3 ml-1" />}
            </button>
          );
        })}

        {adding ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="h-8 w-40 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdd();
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              disabled={busy}
            />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={commitAdd} disabled={busy}>
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAdding(false); setDraft(""); }} disabled={busy}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 gap-1"
            onClick={() => setAdding(true)}
            title="Adicionar nova opção (fica salva pros próximos imóveis)"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
