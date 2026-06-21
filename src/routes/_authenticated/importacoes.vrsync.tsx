import { createFileRoute } from "@tanstack/react-router";
import { VRSyncImportPage } from "@/components/import/VRSyncImportPage";

export const Route = createFileRoute("/_authenticated/importacoes/vrsync")({
  component: VRSyncImportPage,
});
