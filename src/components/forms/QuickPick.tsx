import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function QuickPick({
  label,
  icon,
  options,
  value,
  onChange,
  className,
}: {
  label?: string;
  icon?: React.ReactNode;
  options: (string | number)[];
  value: string | number;
  onChange: (v: string | number) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-xs flex items-center gap-1">
          {icon} {label}
        </Label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = String(value) === String(opt);
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
