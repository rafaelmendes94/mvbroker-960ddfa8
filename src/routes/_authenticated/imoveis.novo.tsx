import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImovelForm } from "@/components/imoveis/ImovelForm";

export const Route = createFileRoute("/_authenticated/imoveis/novo")({
  head: () => ({ meta: [{ title: "Novo Imóvel — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <PageHeader title="Novo Imóvel" description="Preencha as informações do imóvel passo a passo." />
      <ImovelForm />
    </RoleGate>
  ),
});
