import { useSystemOptions } from "@/hooks/use-system-options";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfraestruturaSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { active, loading } = useSystemOptions("infraestrutura");

  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }

  if (loading) return <p className="text-xs text-muted-foreground">Carregando opções...</p>;
  if (active.length === 0)
    return <p className="text-xs text-muted-foreground">Nenhuma opção de infraestrutura cadastrada em Configurações → Opções do Sistema.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((opt) => {
        const selected = value.includes(opt.slug);
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() => toggle(opt.slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              selected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent"
            )}
          >
            {selected && <Check className="h-3 w-3" />}
            {opt.nome}
          </button>
        );
      })}
      {value.length > 0 && (
        <Badge variant="secondary" className="ml-2">{value.length} selecionada(s)</Badge>
      )}
    </div>
  );
}
