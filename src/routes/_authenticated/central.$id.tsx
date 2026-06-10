import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Check, MapPin, Bed, Bath, Car, Ruler, Star, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useExportacao } from "@/hooks/use-exportacao";
import { useRoles } from "@/hooks/use-roles";
import { canWriteImovel } from "@/lib/permissions";
import { logImovel } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/central/$id")({
  head: () => ({ meta: [{ title: "Detalhe do imóvel — MV Broker" }] }),
  component: Detalhe,
  errorComponent: ({ error }) => <p className="p-6 text-sm text-destructive">{error.message}</p>,
  notFoundComponent: () => <p className="p-6 text-sm">Imóvel não encontrado.</p>,
});

function Detalhe() {
  const { id } = useParams({ from: "/_authenticated/central/$id" });
  const exp = useExportacao();
  const { roles } = useRoles();
  const canWrite = canWriteImovel(roles);

  const [imovel, setImovel] = useState<any>(null);
  const [imagens, setImagens] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: i }, { data: imgs }, { data: l }] = await Promise.all([
        supabase.from("imoveis").select("*").eq("id", id).single(),
        supabase.from("imovel_imagens").select("*").eq("imovel_id", id).order("ordem", { ascending: true }),
        supabase.from("imovel_logs").select("*").eq("imovel_id", id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (cancelled) return;
      setImovel(i);
      setImagens(imgs ?? []);
      setLogs(l ?? []);
      setLoading(false);
      if (i) logImovel(id, "visualizado_detalhe");
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function baixarFotos() {
    for (const img of imagens) {
      const { data } = await supabase.storage.from("imoveis").createSignedUrl(img.storage_path, 3600);
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.target = "_blank";
        a.click();
      }
    }
    logImovel(id, "fotos_baixadas", `${imagens.length} arquivo(s)`);
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64" /></div>;
  if (!imovel) return <p>Imóvel não encontrado.</p>;

  const inExport = exp.has(id);

  return (
    <>
      <PageHeader
        title={imovel.titulo ?? "Imóvel"}
        description={imovel.codigo_interno}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/central"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
            {canWrite && <Button asChild variant="outline"><Link to="/imoveis/$id/editar" params={{ id }}><Pencil className="h-4 w-4 mr-1" />Editar</Link></Button>}
            <Button variant="outline" onClick={baixarFotos} disabled={!imagens.length}><Download className="h-4 w-4 mr-1" />Baixar fotos</Button>
            <Button onClick={() => exp.toggle(id)} variant={inExport ? "secondary" : "default"}>
              {inExport ? <><Check className="h-4 w-4 mr-1" />Na exportação</> : "+ Adicionar à exportação"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Galeria */}
          <Card>
            <CardContent className="p-3">
              {imagens.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {imagens.map((g) => (
                    <div key={g.id} className="aspect-video bg-muted rounded overflow-hidden">
                      <img src={g.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem imagens.</p>
              )}
            </CardContent>
          </Card>

          {imovel.descricao && (
            <Card>
              <CardHeader><CardTitle className="text-base">Descrição</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{imovel.descricao}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Características</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Field label="Tipo" value={imovel.tipo_imovel} />
                <Field label="Padrão" value={imovel.padrao} />
                <Field label="Condição" value={imovel.condicao} />
                <Field label="Posição solar" value={imovel.posicao_solar} />
                <Field label="Vista" value={imovel.vista} />
                <Field label="Área privativa" value={imovel.area_privativa ? `${imovel.area_privativa} m²` : null} />
                <Field label="Área total" value={imovel.area_total ? `${imovel.area_total} m²` : null} />
                <Field label="Dormitórios" value={imovel.dormitorios} />
                <Field label="Suítes" value={imovel.suites} />
                <Field label="Banheiros" value={imovel.banheiros} />
                <Field label="Vagas" value={imovel.vagas} />
                <Field label="Andar" value={imovel.andar} />
              </dl>
              <div className="flex gap-1.5 mt-4 flex-wrap">
                {imovel.vista_mar && <Badge variant="secondary">Vista Mar</Badge>}
                {imovel.decorado && <Badge variant="secondary">Decorado</Badge>}
                {imovel.aceita_permuta && <Badge variant="outline">Aceita Permuta</Badge>}
                {imovel.publicar_xml && <Badge variant="outline">XML</Badge>}
                {imovel.destaque_home && <Badge><Star className="h-3 w-3 mr-1" />Destaque Home</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <Badge variant="secondary">{imovel.status_imovel}</Badge>
              <p className="text-3xl font-bold">{imovel.preco ? `R$ ${Number(imovel.preco).toLocaleString("pt-BR")}` : "Sob consulta"}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />
                {[imovel.endereco, imovel.bairro, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—"}
              </p>
              <Separator className="my-3" />
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <Stat icon={Bed} value={imovel.dormitorios} label="Dorm." />
                <Stat icon={Bath} value={imovel.banheiros} label="Banh." />
                <Stat icon={Car} value={imovel.vagas} label="Vagas" />
                <Stat icon={Ruler} value={imovel.area_privativa ? `${imovel.area_privativa}m²` : null} label="Área" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Origem / Responsável</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Field inline label="Responsável" value={imovel.responsavel_nome} />
              <Field inline label="Tipo proprietário" value={imovel.tipo_proprietario} />
              <Field inline label="Atualizado" value={imovel.updated_at ? new Date(imovel.updated_at).toLocaleDateString("pt-BR") : null} />
            </CardContent>
          </Card>

          {logs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs max-h-64 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="border-b pb-1.5">
                    <p className="font-medium">{l.acao}</p>
                    {l.descricao && <p className="text-muted-foreground">{l.descricao}</p>}
                    <p className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, inline }: { label: string; value: any; inline?: boolean }) {
  if (value == null || value === "") return null;
  if (inline) return <p><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></p>;
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>;
}

function Stat({ icon: Icon, value, label }: any) {
  return (
    <div className="rounded-md border p-2">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground" />
      <p className="font-semibold mt-1">{value ?? "—"}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
