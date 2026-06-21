import { useState, useMemo } from "react";
import { Rss, Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseVRSync, type VRSyncImovel } from "@/lib/vrsync-parser";

type Status = "novo" | "atualizar";
type Row = VRSyncImovel & { _status: Status };

export function VRSyncImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [pasted, setPasted] = useState("");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{ inseridos: number; atualizados: number; erros: string[] } | null>(null);

  async function handleXml(xml: string) {
    try {
      const parsed = parseVRSync(xml);
      if (!parsed.length) {
        toast.error("Nenhum <Imovel> encontrado no XML.");
        return;
      }
      const codigos = parsed.map((p) => p.codigoInterno).filter(Boolean) as string[];
      let existentes = new Set<string>();
      if (codigos.length) {
        const { data } = await supabase.from("imoveis").select("codigo_interno").in("codigo_interno", codigos);
        existentes = new Set((data ?? []).map((d: any) => d.codigo_interno));
      }
      const withStatus: Row[] = parsed.map((p) => ({
        ...p,
        _status: p.codigoInterno && existentes.has(p.codigoInterno) ? "atualizar" : "novo",
      }));
      setRows(withStatus);
      setStep(2);
      toast.success(`${parsed.length} imóveis encontrados.`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao ler XML.");
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    handleXml(text);
  }

  const totals = useMemo(
    () => ({
      novos: rows.filter((r) => r._status === "novo").length,
      atualizar: rows.filter((r) => r._status === "atualizar").length,
    }),
    [rows],
  );

  async function executar() {
    setImporting(true);
    const erros: string[] = [];
    let inseridos = 0;
    let atualizados = 0;

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id ?? null;

    for (const r of rows) {
      try {
        let condominio_id: string | null = null;
        if (r.nomeCondominio) {
          const { data: existing } = await supabase
            .from("condominios")
            .select("id")
            .ilike("nome", r.nomeCondominio)
            .eq("cidade", r.cidade || "")
            .limit(1)
            .maybeSingle();
          if (existing?.id) {
            condominio_id = existing.id;
          } else {
            const { data: novo, error } = await supabase
              .from("condominios")
              .insert({
                nome: r.nomeCondominio,
                cidade: r.cidade,
                estado: r.estado,
                bairro: r.bairro,
                valor_condominio: r.valorCondominio,
                created_by: userId,
              } as any)
              .select("id")
              .single();
            if (!error && novo) condominio_id = novo.id;
          }
        }

        const payload: any = {
          codigo_interno: r.codigoInterno,
          titulo: r.titulo,
          tipo_imovel: r.tipoImovel,
          status_imovel: "disponivel",
          preco: r.preco,
          area_total: r.areaTotal,
          area_privativa: r.areaPrivativa,
          dormitorios: r.dormitorios,
          suites: r.suites,
          banheiros: r.banheiros,
          vagas: r.vagas,
          descricao: r.descricao,
          logradouro: r.logradouro,
          numero: r.numero,
          complemento: r.complemento,
          bairro: r.bairro,
          cidade: r.cidade,
          estado: r.estado,
          cep: r.cep,
          latitude: r.latitude,
          longitude: r.longitude,
          link_video: r.linkVideo,
          tour_360: r.tour360,
          condominio_id,
          arquivado: false,
          exportacao_liberada: false,
          created_by: userId,
        };

        let imovelId: string | null = null;
        if (r._status === "atualizar" && r.codigoInterno) {
          const { data, error } = await supabase
            .from("imoveis")
            .update(payload)
            .eq("codigo_interno", r.codigoInterno)
            .select("id")
            .maybeSingle();
          if (error) throw error;
          imovelId = data?.id ?? null;
          if (imovelId) atualizados++;
        } else {
          const { data, error } = await supabase.from("imoveis").insert(payload).select("id").single();
          if (error) throw error;
          imovelId = data?.id ?? null;
          if (imovelId) inseridos++;
        }

        if (imovelId && r.fotos.length) {
          await supabase.from("imovel_imagens").delete().eq("imovel_id", imovelId);
          const fotosInsert = r.fotos.map((f, i) => ({
            imovel_id: imovelId,
            url: f.url,
            ordem: i,
            capa: i === 0,
            created_by: userId,
          }));
          await supabase.from("imovel_imagens").insert(fotosInsert as any);
        }
      } catch (e: any) {
        erros.push(`${r.codigoInterno || r.titulo}: ${e.message || String(e)}`);
      }
    }

    setReport({ inseridos, atualizados, erros });
    setStep(3);
    setImporting(false);
    toast.success(`Importação concluída: ${inseridos} novos, ${atualizados} atualizados, ${erros.length} erros.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Rss className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Importação Feed VRSync</h2>
          <p className="text-sm text-muted-foreground">
            Aceita o padrão XML VivaReal/ZAP/OLX. Cole o conteúdo ou envie um arquivo .xml.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 dark:text-amber-200">
          <strong>Atenção:</strong> Proprietário e corretor responsável não vêm no feed VRSync — preencha após a
          importação em cada imóvel.
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="file"
              accept=".xml,application/xml,text/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Clique para enviar arquivo .xml</p>
            <p className="text-xs text-muted-foreground">ou cole o conteúdo abaixo</p>
          </label>

          <Textarea
            placeholder="<Carga><Imoveis><Imovel>...</Imovel></Imoveis></Carga>"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            className="font-mono text-xs h-40"
          />
          <Button onClick={() => handleXml(pasted)} disabled={!pasted.trim()}>
            Analisar XML colado
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Badge variant="secondary">{rows.length} no arquivo</Badge>
              <Badge className="bg-green-600 hover:bg-green-600">{totals.novos} novos</Badge>
              <Badge className="bg-blue-600 hover:bg-blue-600">{totals.atualizar} atualizar</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep(1); setRows([]); }}>Voltar</Button>
              <Button onClick={executar} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Importar {rows.length} imóveis
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Status</th>
                  <th className="p-2">Código</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Transação</th>
                  <th className="p-2">Preço</th>
                  <th className="p-2">Cidade</th>
                  <th className="p-2">Fotos</th>
                  <th className="p-2">Condomínio</th>
                  <th className="p-2">Proprietário</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      {r._status === "atualizar" ? (
                        <Badge className="bg-blue-600 hover:bg-blue-600">Atualizar</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-600">Novo</Badge>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{r.codigoInterno || "—"}</td>
                    <td className="p-2">{r.tipoImovel || "—"}</td>
                    <td className="p-2">{r.tipoTransacao || "—"}</td>
                    <td className="p-2">{r.preco ? `R$ ${r.preco.toLocaleString("pt-BR")}` : "—"}</td>
                    <td className="p-2">{r.cidade || "—"}</td>
                    <td className="p-2">{r.fotos.length}</td>
                    <td className="p-2">{r.nomeCondominio || "—"}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
                        preencher depois
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 3 && report && (
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-bold">Importação concluída</h3>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Badge className="bg-green-600 hover:bg-green-600">{report.inseridos} inseridos</Badge>
              <Badge className="bg-blue-600 hover:bg-blue-600">{report.atualizados} atualizados</Badge>
              <Badge variant={report.erros.length ? "destructive" : "secondary"}>
                {report.erros.length} erros
              </Badge>
            </div>
            {report.erros.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ver erros</summary>
                <ul className="mt-2 space-y-1 max-h-60 overflow-auto">
                  {report.erros.map((e, i) => (
                    <li key={i} className="font-mono text-destructive">{e}</li>
                  ))}
                </ul>
              </details>
            )}
            <Button
              onClick={() => {
                setStep(1);
                setRows([]);
                setReport(null);
                setPasted("");
              }}
            >
              Nova importação
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
