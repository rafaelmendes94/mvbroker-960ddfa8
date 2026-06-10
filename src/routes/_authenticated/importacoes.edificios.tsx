import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/import/ImportPage";
import { EDIFICIOS_FIELDS } from "@/lib/import-schemas";

export const Route = createFileRoute("/_authenticated/importacoes/edificios")({
  component: () => (
    <ImportPage
      title="Importar Edifícios"
      description="Envie um CSV ou Excel com a lista de edifícios."
      table="edificios"
      fields={EDIFICIOS_FIELDS}
      templateName="modelo-edificios"
    />
  ),
});
