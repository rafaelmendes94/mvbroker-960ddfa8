import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type Endereco = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export const emptyEndereco: Endereco = {
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

export function CepAutoFill({
  value,
  onChange,
}: {
  value: Endereco;
  onChange: (v: Endereco) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function lookup(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (d.erro) { toast.error("CEP não encontrado"); return; }
      onChange({
        ...value,
        cep: digits,
        logradouro: d.logradouro ?? "",
        bairro: d.bairro ?? "",
        cidade: d.localidade ?? "",
        estado: d.uf ?? "",
      });
    } catch {
      toast.error("Falha ao consultar CEP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      <Field label="CEP" className="md:col-span-2">
        <div className="relative">
          <Input
            value={value.cep}
            onChange={(e) => onChange({ ...value, cep: e.target.value })}
            onBlur={(e) => lookup(e.target.value)}
            placeholder="00000-000"
            maxLength={9}
          />
          {loading && <Loader2 className="absolute right-2 top-2 h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      </Field>
      <Field label="Logradouro" className="md:col-span-4">
        <Input value={value.logradouro} onChange={(e) => onChange({ ...value, logradouro: e.target.value })} />
      </Field>
      <Field label="Número" className="md:col-span-1">
        <Input value={value.numero} onChange={(e) => onChange({ ...value, numero: e.target.value })} />
      </Field>
      <Field label="Complemento" className="md:col-span-2">
        <Input value={value.complemento} onChange={(e) => onChange({ ...value, complemento: e.target.value })} />
      </Field>
      <Field label="Bairro" className="md:col-span-3">
        <Input value={value.bairro} onChange={(e) => onChange({ ...value, bairro: e.target.value })} />
      </Field>
      <Field label="Cidade" className="md:col-span-4">
        <Input value={value.cidade} onChange={(e) => onChange({ ...value, cidade: e.target.value })} />
      </Field>
      <Field label="Estado" className="md:col-span-2">
        <Input maxLength={2} value={value.estado} onChange={(e) => onChange({ ...value, estado: e.target.value.toUpperCase() })} />
      </Field>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
