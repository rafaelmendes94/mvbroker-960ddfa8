import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Users, Building2, Home, Download, Activity, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_authenticated/relatorios-admin/")({
  component: RelatoriosAdminIndex,
});

const ITEMS = [
  { to: "/relatorios-admin/atividade", label: "Atividade", desc: "Atividade dos usuários e eventos do sistema.", icon: Activity },
  { to: "/relatorios-admin/corretores", label: "Corretores", desc: "Engajamento e produção dos corretores.", icon: Users },
  { to: "/relatorios-admin/imobiliarias", label: "Imobiliárias", desc: "Visão consolidada por imobiliária.", icon: Building2 },
  { to: "/relatorios-admin/imoveis", label: "Imóveis", desc: "Indicadores e segmentação do catálogo.", icon: Home },
  { to: "/relatorios-admin/exportacoes", label: "Exportações", desc: "Histórico e ranking de exportações.", icon: Download },
  { to: "/relatorios-admin/rankings", label: "Rankings", desc: "Top imóveis, corretores e mais.", icon: Trophy },
];

function RelatoriosAdminIndex() {
  return (
    <>
      <PageHeader
        title="Relatórios Admin"
        description="BI administrativo da plataforma — restrito ao Super Admin."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className="block group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{it.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{it.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
