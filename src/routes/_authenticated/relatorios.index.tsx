import { createFileRoute } from "@tanstack/react-router";
import Reports from "@/pages/Reports";

export const Route = createFileRoute("/_authenticated/relatorios/")({
  component: Reports,
});
