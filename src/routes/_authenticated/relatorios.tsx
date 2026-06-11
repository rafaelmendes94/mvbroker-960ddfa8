import { createFileRoute, Outlet } from "@tanstack/react-router";
import Reports from "@/pages/Reports";
import { RelatoriosFiltersProvider } from "@/hooks/use-rel-filters";
import { useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatório de Vendas — MV Broker" }] }),
  component: RelatoriosLayout,
});

function RelatoriosLayout() {
  const { pathname } = useLocation();
  const isIndex = pathname === "/relatorios";

  if (isIndex) return <Reports />;

  // Sub-rotas (legacy) ainda funcionam via URL direta — passa para Outlet com o provider de filtros
  return (
    <RelatoriosFiltersProvider>
      <Outlet />
    </RelatoriosFiltersProvider>
  );
}
