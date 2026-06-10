import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/import/ImportPage";
import { CONDOMINIOS_FIELDS } from "@/lib/import-schemas";

export const Route = createFileRoute("/_authenticated/importacoes/condominios")({
  component: () => (
    <ImportPage
      title="Importar Condomínios"
      description="Envie um CSV ou Excel com a lista de condomínios."
      table="condominios"
      fields={CONDOMINIOS_FIELDS}
      templateName="modelo-condominios"
    />
  ),
});
