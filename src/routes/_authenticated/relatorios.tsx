import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, FileText, PieChart, TrendingUp, Download, Building2, Building, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — MV Broker" }] }),
  component: Relatorios,
});

const reports = [
  { titulo: "Relatório de Cadastros", desc: "Volume e evolução dos registros.", icon: FileText },
  { titulo: "Performance Comercial", desc: "Vendas e conversões por período.", icon: TrendingUp },
  { titulo: "Distribuição por Tipo", desc: "Composição da carteira de imóveis.", icon: PieChart },
  { titulo: "Análise Mensal", desc: "Indicadores consolidados do mês.", icon: BarChart3 },
];

function Relatorios() {
  const [counts, setCounts] = useState({ edificios: 0, condominios: 0, empreendimentos: 0 });

  useEffect(() => {
    (async () => {
      const [e, c, m] = await Promise.all([
        supabase.from("edificios").select("*", { count: "exact", head: true }),
        supabase.from("condominios").select("*", { count: "exact", head: true }),
        supabase.from("empreendimentos").select("*", { count: "exact", head: true }),
      ]);
      setCounts({ edificios: e.count ?? 0, condominios: c.count ?? 0, empreendimentos: m.count ?? 0 });
    })();
  }, []);

  const kpis = [
    { label: "Edifícios", value: counts.edificios, icon: Building2 },
    { label: "Condomínios", value: counts.condominios, icon: Building },
    { label: "Empreendimentos", value: counts.empreendimentos, icon: Briefcase },
  ];

  return (
    <>
      <PageHeader title="Relatórios" description="Gere relatórios completos sobre a operação." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-sm text-muted-foreground">{k.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {reports.map(r => {
          const Icon = r.icon;
          return (
            <Card key={r.titulo} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{r.titulo}</h3>
                <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  <Download className="h-4 w-4" /> Gerar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
