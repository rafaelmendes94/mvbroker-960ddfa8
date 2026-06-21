import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Building2, Building, Home, FileSpreadsheet, Rss } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/importacoes")({
  component: ImportacoesLayout,
});

const TABS = [
  { to: "/importacoes/mv-broker", label: "Modelo MV Broker", icon: FileSpreadsheet },
  { to: "/importacoes/vrsync", label: "Feed VRSync", icon: Rss },
  { to: "/importacoes/imoveis", label: "Imóveis (avançado)", icon: Home },
  { to: "/importacoes/condominios", label: "Condomínios", icon: Building },
  { to: "/importacoes/edificios", label: "Edifícios", icon: Building2 },
];


function ImportacoesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Importações</h1>
        <p className="text-sm text-muted-foreground">
          Importe dados em massa via CSV ou Excel.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
