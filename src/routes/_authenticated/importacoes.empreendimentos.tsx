import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/import/ImportPage";
import { EMPREENDIMENTOS_FIELDS } from "@/lib/import-schemas";

export const Route = createFileRoute("/_authenticated/importacoes/empreendimentos")({
  component: () => (
    <ImportPage
      title="Importar Empreendimentos"
      description="Envie um CSV ou Excel com a lista de empreendimentos."
      table="empreendimentos"
      fields={EMPREENDIMENTOS_FIELDS}
      templateName="modelo-empreendimentos"
    />
  ),
});
