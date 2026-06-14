import { Input } from "@/components/ui/input";

function formatBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return String(parseInt(digits, 10) / 100);
}

export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "0,00",
}: {
  value: string | number | null | undefined;
  onValueChange: (raw: string) => void;
  placeholder?: string;
}) {
  const display = value == null || value === "" ? "" : formatBRL(String(Math.round(Number(value) * 100)));
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
      <Input
        className="pl-9"
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => onValueChange(parseBRL(e.target.value))}
      />
    </div>
  );
}
