import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RelatoriosFiltersProvider } from "@/hooks/use-rel-filters";

export const Route = createFileRoute("/_authenticated/relatorios-admin")({
  head: () => ({ meta: [{ title: "Relatórios Admin — MV Broker" }] }),
  component: RelatoriosAdminLayout,
});

function RelatoriosAdminLayout() {
  return (
    <RelatoriosFiltersProvider>
      <Outlet />
    </RelatoriosFiltersProvider>
  );
}
