import { createFileRoute } from "@tanstack/react-router";
import { EstruturaPage } from "@/components/estruturas/EstruturaPage";

export const Route = createFileRoute("/_authenticated/loteamentos")({
  head: () => ({ meta: [{ title: "Loteamentos — MV Broker" }] }),
  component: () => <EstruturaPage tipo="loteamento" />,
});
