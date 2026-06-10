import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImovelForm } from "@/components/imoveis/ImovelForm";

export const Route = createFileRoute("/_authenticated/imoveis/$id/editar")({
  head: () => ({ meta: [{ title: "Editar Imóvel — MV Broker" }] }),
  component: EditarImovel,
});

function EditarImovel() {
  const { id } = useParams({ from: "/_authenticated/imoveis/$id/editar" });
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imoveis").select(IMOVEL_PUBLIC_COLUMNS).eq("id", id).single();
      if (data) {
        // Admin/secretaria pode ver campos internos via RPC SECURITY DEFINER
        const { data: internal } = await supabase.rpc("get_imovel_internal", { p_imovel_id: id });
        const internalRow = Array.isArray(internal) && internal.length > 0 ? internal[0] : {};
        setItem({ ...(data as any), ...(internalRow as any) });
      } else {
        setItem(null);
      }
      setLoading(false);
    })();
  }, [id]);

  return (
    <RoleGate allow={["super_admin", "secretaria", "imobiliaria", "corretor_imobiliaria", "corretor_autonomo"]}>
      <PageHeader title={item ? `Imóvel ${item.codigo_interno}` : "Carregando..."} description={item?.titulo ?? ""} />
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : item ? <ImovelForm initial={item} /> : <p className="text-sm text-muted-foreground">Imóvel não encontrado.</p>}
    </RoleGate>
  );
}
