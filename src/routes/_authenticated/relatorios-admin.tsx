import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { RelatoriosFiltersProvider } from "@/hooks/use-rel-filters";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Users, Building2, Home, Download, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios-admin")({
  head: () => ({ meta: [{ title: "Relatórios Admin — MV Broker" }] }),
  component: RelatoriosAdminLayout,
});

const TABS = [
  { value: "atividade", label: "Atividade", icon: Activity },
  { value: "corretores", label: "Corretores", icon: Users },
  { value: "imobiliarias", label: "Imobiliárias", icon: Building2 },
  { value: "imoveis", label: "Imóveis", icon: Home },
  { value: "exportacoes", label: "Exportações", icon: Download },
  { value: "rankings", label: "Rankings", icon: Trophy },
];

function RelatoriosAdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = TABS.find((t) => pathname.includes(`/relatorios-admin/${t.value}`))?.value ?? "atividade";
  const isIndex = pathname === "/relatorios-admin" || pathname === "/relatorios-admin/";

  return (
    <RelatoriosFiltersProvider>
      <PageHeader
        title="Relatórios"
        description="BI completo da plataforma."
      />
      <Tabs
        value={current}
        onValueChange={(v) => navigate({ to: `/relatorios-admin/${v}` })}
        className="space-y-4"
      >
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-2">
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {isIndex ? <Outlet /> : <div><Outlet /></div>}
      </Tabs>
    </RelatoriosFiltersProvider>
  );
}
