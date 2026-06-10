import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { logRelatorioAccess } from "@/hooks/use-relatorios";
import { useRelFilters } from "@/hooks/use-rel-filters";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios/imobiliarias")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (data ?? []).some((r: { role: string }) => r.role === "super_admin");
    if (!isAdmin) throw redirect({ to: "/relatorios" });
  },
  component: RelImobiliarias,
});

type Imob = { id: string; nome_fantasia: string | null; razao_social: string | null; status: string };
type Corretor = { id: string; imobiliaria_id: string | null };
type Imovel = { id: string; imobiliaria_id: string | null; publicar_xml: boolean | null };
type Carteira = { id: string; usuario_id: string };
type ImobOwner = { id: string; owner_id: string };

function RelImobiliarias() {
  const { filters } = useRelFilters();
  const [imobs, setImobs] = useState<Imob[]>([]);
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [owners, setOwners] = useState<ImobOwner[]>([]);

  useEffect(() => {
    logRelatorioAccess("imobiliarias", filters as any);
    (async () => {
      let imvQ: any = supabase.from("imoveis").select("id, imobiliaria_id, publicar_xml").limit(20000);
      if (filters.cidade) imvQ = imvQ.eq("cidade", filters.cidade);
      if (filters.tipo) imvQ = imvQ.eq("tipo_imovel", filters.tipo);
      if (filters.status) imvQ = imvQ.eq("status_imovel", filters.status);
      const [im, cr, iv, ca, ow] = await Promise.all([
        supabase.from("imobiliarias").select("id, nome_fantasia, razao_social, status"),
        supabase.from("corretores").select("id, imobiliaria_id"),
        imvQ,
        supabase.from("carteiras").select("id, usuario_id"),
        supabase.from("imobiliarias").select("id, owner_id"),
      ]);
      setImobs((im.data ?? []) as Imob[]);
      setCorretores((cr.data ?? []) as Corretor[]);
      setImoveis((iv.data ?? []) as Imovel[]);
      setCarteiras((ca.data ?? []) as Carteira[]);
      setOwners((ow.data ?? []) as ImobOwner[]);
    })();
  }, [filters]);

  const ativas = imobs.filter((i) => i.status === "ativa").length;
  const inativas = imobs.length - ativas;

  const rows = useMemo(() => {
    const ownerByImob = new Map(owners.map((o) => [o.id, o.owner_id]));
    const cartByUser = new Map<string, number>();
    for (const c of carteiras) cartByUser.set(c.usuario_id, (cartByUser.get(c.usuario_id) ?? 0) + 1);

    return imobs.map((i) => {
      const corretoresQt = corretores.filter((c) => c.imobiliaria_id === i.id).length;
      const imoveisRows = imoveis.filter((m) => m.imobiliaria_id === i.id);
      const xml = imoveisRows.filter((m) => m.publicar_xml).length;
      const ownerId = ownerByImob.get(i.id);
      const cart = ownerId ? cartByUser.get(ownerId) ?? 0 : 0;
      return {
        id: i.id,
        nome: i.nome_fantasia || i.razao_social || "—",
        status: i.status,
        corretores: corretoresQt,
        imoveis: imoveisRows.length,
        xml,
        carteiras: cart,
      };
    }).sort((a, b) => b.imoveis - a.imoveis);
  }, [imobs, corretores, imoveis, carteiras, owners]);

  const top = rows.slice(0, 10).map((r) => ({ nome: r.nome, imoveis: r.imoveis, xml: r.xml }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Total" value={imobs.length} />
        <Kpi label="Ativas" value={ativas} />
        <Kpi label="Inativas" value={inativas} />
        <Kpi label="Corretores vinculados" value={corretores.filter((c) => c.imobiliaria_id).length} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top imobiliárias por imóveis</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="nome" fontSize={11} angle={-20} textAnchor="end" height={60} interval={0} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="imoveis" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="xml" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ranking</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imobiliária</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Corretores</TableHead>
                <TableHead className="text-right">Imóveis</TableHead>
                <TableHead className="text-right">Em XML</TableHead>
                <TableHead className="text-right">Carteiras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell><Badge variant={r.status === "ativa" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{r.corretores}</TableCell>
                  <TableCell className="text-right">{r.imoveis}</TableCell>
                  <TableCell className="text-right">{r.xml}</TableCell>
                  <TableCell className="text-right">{r.carteiras}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem imobiliárias.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}
