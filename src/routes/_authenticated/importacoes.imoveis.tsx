import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/import/ImportPage";
import { IMOVEIS_FIELDS_UNIQUE } from "@/lib/import-schemas";

export const Route = createFileRoute("/_authenticated/importacoes/imoveis")({
  component: () => (
    <ImportPage
      title="Importar Imóveis"
      description="Envie o arquivo e faça o mapeamento das colunas para os campos do sistema."
      table="imoveis"
      fields={IMOVEIS_FIELDS_UNIQUE}
      templateName="modelo-imoveis"
      showMapper
    />
  ),
});
