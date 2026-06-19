import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Building2, MapPin, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EspelhoSheet } from "@/components/empreendimentos/EspelhoSheet";
import type { EmpreendimentoTipo } from "@/lib/espelho";

export const Route = createFileRoute("/_authenticated/empreendimentos/$id")({
  head: () => ({ meta: [{ title: "Empreendimento — MV Broker" }] }),
  component: Page,
});

type Resolved = {
  tipo: EmpreendimentoTipo | "empreendimento";
  row: any;
};

const TABLES: Array<{ tipo: Resolved["tipo"]; table: string; fkCol: string }> = [
  { tipo: "edificio", table: "edificios", fkCol: "edificio_id" },
  { tipo: "condominio", table: "condominios", fkCol: "condominio_id" },
  { tipo: "loteamento", table: "loteamentos", fkCol: "loteamento_id" },
  { tipo: "empreendimento", table: "empreendimentos", fkCol: "empreendimento_id" },
];

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function Page() {
  const { id } = useParams({ from: "/_authenticated/empreendimentos/$id" });
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [imoveis, setImoveis] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let found: Resolved | null = null;
      for (const t of TABLES) {
        const { data } = await supabase.from(t.table as any).select("*").eq("id", id).maybeSingle();
        if (data) { found = { tipo: t.tipo, row: data }; break; }
      }
      setResolved(found);
      if (found) {
        const fkCol = TABLES.find((x) => x.tipo === found!.tipo)!.fkCol;
        const { data: ims } = await supabase
          .from("imoveis")
          .select("id, codigo_interno, titulo, tipo_imovel, status_imovel, preco, area_total, dormitorios, banheiros, vagas, unidade, quadra, lote")
          .eq(fkCol, id)
          .eq("arquivado", false)
          .order("codigo_interno", { ascending: true });
        setImoveis(ims || []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando empreendimento…</div>;
  }
  if (!resolved) {
    return (
      <div className="p-6 space-y-3">
        <Button asChild variant="ghost" size="sm"><Link to="/imoveis"><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
        <p className="text-sm text-muted-foreground">Empreendimento não encontrado.</p>
      </div>
    );
  }

  const r = resolved.row;
  const tipoLabel = resolved.tipo.charAt(0).toUpperCase() + resolved.tipo.slice(1);
  const endereco = [r.logradouro, r.numero, r.bairro, r.cidade, r.estado].filter(Boolean).join(", ");
  const infra: string[] = Array.isArray(r.infraestrutura)
    ? r.infraestrutura
    : (r.infraestrutura && typeof r.infraestrutura === "object" ? Object.keys(r.infraestrutura).filter((k) => (r.infraestrutura as any)[k]) : []);

  const podeEspelho = resolved.tipo !== "empreendimento";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/imoveis"><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
        <Badge variant="outline" className="uppercase">{tipoLabel}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="h-6 w-6 text-primary" />
            {r.nome}
          </CardTitle>
          {r.codigo_interno && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" />{r.codigo_interno}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {endereco && (
            <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />{endereco}</p>
          )}
          {r.descricao && <p className="text-muted-foreground whitespace-pre-wrap">{r.descricao}</p>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {r.construtora && <Info label="Construtora" value={r.construtora} />}
            {r.incorporadora && <Info label="Incorporadora" value={r.incorporadora} />}
            {r.qtd_andares != null && <Info label="Andares" value={String(r.qtd_andares)} />}
            {r.qtd_apartamentos != null && <Info label="Apartamentos" value={String(r.qtd_apartamentos)} />}
            {r.qtd_elevadores != null && <Info label="Elevadores" value={String(r.qtd_elevadores)} />}
            {r.ano_construcao && <Info label="Ano" value={String(r.ano_construcao)} />}
            {r.numero_lotes != null && <Info label="Lotes" value={String(r.numero_lotes)} />}
            {r.total_lotes != null && <Info label="Total lotes" value={String(r.total_lotes)} />}
            {r.lotes_disponiveis != null && <Info label="Disponíveis" value={String(r.lotes_disponiveis)} />}
            {r.area_total != null && <Info label="Área total" value={`${r.area_total} m²`} />}
            {r.area_total_m2 != null && <Info label="Área total" value={`${r.area_total_m2} m²`} />}
            {r.valor_condominio != null && <Info label="Condomínio" value={fmtBRL(r.valor_condominio)} />}
            {r.valor_iptu != null && <Info label="IPTU" value={fmtBRL(r.valor_iptu)} />}
            {r.status_obra && <Info label="Status obra" value={String(r.status_obra)} />}
            {r.data_lancamento && <Info label="Lançamento" value={String(r.data_lancamento)} />}
            {r.data_prevista_entrega && <Info label="Entrega prevista" value={String(r.data_prevista_entrega)} />}
          </div>

          {infra.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Infraestrutura</p>
              <div className="flex flex-wrap gap-1.5">
                {infra.map((i) => <Badge key={i} variant="secondary" className="capitalize">{i.replace(/_/g, " ")}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="imoveis">
        <TabsList>
          <TabsTrigger value="imoveis">Imóveis ({imoveis.length})</TabsTrigger>
          {podeEspelho && <TabsTrigger value="espelho">Espelho de Vendas</TabsTrigger>}
        </TabsList>

        <TabsContent value="imoveis" className="pt-4">
          {imoveis.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Nenhum imóvel cadastrado neste empreendimento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {imoveis.map((im) => (
                <Link key={im.id} to="/imoveis/$id/editar" params={{ id: im.id }} className="block">
                  <Card className="hover:border-primary transition-colors h-full">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{im.codigo_interno}</span>
                        <Badge variant="outline" className="text-[10px]">{im.status_imovel || "—"}</Badge>
                      </div>
                      <p className="font-semibold text-sm line-clamp-1">{im.titulo || im.tipo_imovel}</p>
                      <p className="text-xs text-muted-foreground">
                        {[im.unidade && `Ap ${im.unidade}`, im.quadra && `Q${im.quadra}`, im.lote && `L${im.lote}`].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-muted-foreground">
                          {im.dormitorios || 0}d · {im.banheiros || 0}b · {im.vagas || 0}v · {im.area_total || 0}m²
                        </span>
                        <span className="font-bold text-primary">{fmtBRL(Number(im.preco) || null)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {podeEspelho && (
          <TabsContent value="espelho" className="pt-4">
            <EspelhoSheet tipo={resolved.tipo as EmpreendimentoTipo} empreendimentoId={id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
