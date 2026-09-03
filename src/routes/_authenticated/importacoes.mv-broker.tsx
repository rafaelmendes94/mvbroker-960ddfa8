import { createFileRoute } from "@tanstack/react-router";
import { ModeloOficialImportPage } from "@/components/import/ModeloOficialImport";

export const Route = createFileRoute("/_authenticated/importacoes/mv-broker")({
  head: () => ({
    meta: [
      { title: "Importação oficial de imóveis | MV Broker" },
      { name: "description", content: "Importe e exporte imóveis usando o modelo oficial do MV Broker." },
      { property: "og:title", content: "Importação oficial de imóveis | MV Broker" },
      { property: "og:description", content: "Importe e exporte imóveis usando o mesmo schema oficial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModeloOficialImportPage,
});
