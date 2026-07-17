import { createFileRoute } from "@tanstack/react-router";
import { EstruturaPage } from "@/components/estruturas/EstruturaPage";

export const Route = createFileRoute("/_authenticated/condominios")({
  head: () => ({ meta: [{ title: "Condomínios — MV Broker" }] }),
  component: () => <EstruturaPage tipo="condominio" />,
});
