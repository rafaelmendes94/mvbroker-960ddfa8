import { createFileRoute } from "@tanstack/react-router";
import { EstruturaPage } from "@/components/estruturas/EstruturaPage";

export const Route = createFileRoute("/_authenticated/edificios")({
  head: () => ({ meta: [{ title: "Edifícios — MV Broker" }] }),
  component: () => <EstruturaPage tipo="edificio" />,
});
