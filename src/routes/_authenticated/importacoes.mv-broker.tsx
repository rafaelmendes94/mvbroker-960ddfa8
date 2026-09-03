import { createFileRoute } from "@tanstack/react-router";
import { MvBrokerImportPage } from "@/components/import/MvBrokerImport";

export const Route = createFileRoute("/_authenticated/importacoes/mv-broker")({
  component: MvBrokerImportPage,
});
