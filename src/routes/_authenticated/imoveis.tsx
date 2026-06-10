import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/imoveis")({
  head: () => ({ meta: [{ title: "Imóveis — MV Broker" }] }),
  component: () => <Outlet />,
});
