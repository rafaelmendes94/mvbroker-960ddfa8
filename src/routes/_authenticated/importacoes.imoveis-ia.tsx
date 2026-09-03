import { createFileRoute } from "@tanstack/react-router";
import { ImportIaPage } from "@/components/import/ImportIaPage";

export const Route = createFileRoute("/_authenticated/importacoes/imoveis-ia")({
  component: () => <ImportIaPage />,
});
