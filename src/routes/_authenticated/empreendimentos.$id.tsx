import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EspelhoSheet } from "@/components/empreendimentos/EspelhoSheet";
import type { EmpreendimentoTipo } from "@/lib/espelho";

export const Route = createFileRoute("/_authenticated/empreendimentos/$id")({
  head: () => ({ meta: [{ title: "Empreendimento — MV Broker" }] }),
  component: Page,
});

const TABLES: Array<{ tipo: EmpreendimentoTipo | "empreendimento"; table: string; voltar: string }> = [
  { tipo: "edificio", table: "edificios", voltar: "/edificios" },
  { tipo: "condominio", table: "condominios", voltar: "/condominios" },
  { tipo: "loteamento", table: "loteamentos", voltar: "/loteamentos" },
  { tipo: "empreendimento", table: "empreendimentos", voltar: "/empreendimentos" },
];

function Page() {
  const { id } = useParams({ from: "/_authenticated/empreendimentos/$id" });
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<{ tipo: EmpreendimentoTipo | "empreendimento"; voltar: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      for (const t of TABLES) {
        const { data } = await supabase.from(t.table as any).select("id").eq("id", id).maybeSingle();
        if (cancel) return;
        if (data) { setResolved({ tipo: t.tipo, voltar: t.voltar }); break; }
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!resolved) {
    return (
      <div className="p-6 space-y-3">
        <Button asChild variant="ghost" size="sm"><Link to="/imoveis"><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
        <p className="text-sm text-muted-foreground">Empreendimento não encontrado.</p>
      </div>
    );
  }

  if (resolved.tipo === "empreendimento") {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to={resolved.voltar}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
        <p className="text-sm text-muted-foreground">Empreendimentos genéricos não possuem espelho.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm"><Link to={resolved.voltar}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
      <EspelhoSheet tipo={resolved.tipo as EmpreendimentoTipo} empreendimentoId={id} />
    </div>
  );
}
