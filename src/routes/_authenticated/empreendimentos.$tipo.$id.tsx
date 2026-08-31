import { createFileRoute, useParams } from "@tanstack/react-router";
import { EspelhoSheet } from "@/components/empreendimentos/EspelhoSheet";
import type { EmpreendimentoTipo } from "@/lib/espelho";

const VALID: EmpreendimentoTipo[] = ["edificio", "condominio", "loteamento"];

export const Route = createFileRoute("/_authenticated/empreendimentos/$tipo/$id")({
  head: () => ({ meta: [{ title: "Espelho de Vendas — MV Broker" }] }),
  component: Page,
});

function Page() {
  const { tipo, id } = useParams({ from: "/_authenticated/empreendimentos/$tipo/$id" });
  const t = tipo as EmpreendimentoTipo;
  if (!VALID.includes(t)) {
    return <div className="p-8 text-center text-muted-foreground">Tipo inválido.</div>;
  }
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <EspelhoSheet tipo={t} empreendimentoId={id} />
    </div>
  );
}
