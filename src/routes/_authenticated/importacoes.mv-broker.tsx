import { createFileRoute } from "@tanstack/react-router";
import { ModeloOficialImportPage } from "@/components/import/ModeloOficialImport";

export const Route = createFileRoute("/_authenticated/importacoes/mv-broker")({
  component: ModeloOficialImportPage,
});
