import { createFileRoute } from "@tanstack/react-router";
import Properties from "@/pages/Properties";

export const Route = createFileRoute("/_authenticated/imoveis/")({
  component: Properties,
});
