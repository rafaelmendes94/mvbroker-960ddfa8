import { useState } from "react";
import { Download, Upload, Loader2, FileSpreadsheet, FileDown, CheckCircle2, AlertTriangle, Copy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/import/FileDropzone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MODELO_COLS,
  baixarModeloOficial,
  converterLinha,
  exportarImoveisOficial,
  fingerprintImovel,
  lerPlanilhaOficial,
  norm,
  type LinhaValidada,
} from "@/lib/modelo-oficial-imoveis";

const EMPREENDIMENTO_TABELAS = [
  { table: "edificios", col: "edificio_id" },
  { table: "condominios", col: "condominio_id" },
  { table: "loteamentos", col: "loteamento_id" },
] as const;

export function ModeloOficialImportPage() {
  const [linhas, setLinhas] = useState<LinhaValidada[] | null>(null);
  const [naoMapeadas, setNaoMapeadas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resultado, setResultado] = useState<{ inseridos: number; atualizados: number; ignorados: number; erros: string[] } | null>(null);

  async function carregarReferencias() {
    const nomes = new Map<string, { col: string; id: string }>();
    for (const { table, col } of EMPREENDIMENTO_TABELAS) {
      const { data } = await (supabase as any).from(table).select("id, nome").limit(5000);
      for (const r of (data ?? []) as any[]) {
        const k = norm(r.nome);
        if (k && !nomes.has(k)) nomes.set(k, { col, id: r.id });
      }
    }
    const { data: existentes } = await supabase
      .from("imoveis")
      .select("id, titulo, tipo_imovel, unidade, quadra, lote, cidade, logradouro, numero, preco, codigo_interno")
      .eq("arquivado", false)
      .limit(5000);
    return { nomes, existentes: (existentes ?? []) as any[] };
  }

  async function onFile(file: File) {
    setResultado(null);
    setBusy(true);
    try {
      const { linhas: raw, mapa, headers } = await lerPlanilhaOficial(file);
      if (!raw.length) {
        toast.error("Planilha vazia.");
        return;
      }
      const faltando = MODELO_COLS.filter((c) => c.required && !mapa[c.key]).map((c) => c.key);
      if (faltando.length) {
        toast.error(`Colunas obrigatórias não encontradas: ${faltando.join(", ")}`);
      }
      const usados = new Set(Object.values(mapa).map(norm));
      setNaoMapeadas(headers.filter((h) => !usados.has(norm(h)) && h !== "__row"));

      const { nomes, existentes } = await carregarReferencias();
      const porFingerprint = new Map<string, any>();
      const porExact = new Map<string, any>();
      const porCodigo = new Map<string, any>();
      for (const im of existentes) {
        const { fingerprint, exact } = fingerprintImovel(im);
        if (!porFingerprint.has(fingerprint)) porFingerprint.set(fingerprint, im);
        if (!porExact.has(exact)) porExact.set(exact, im);
        if (im.codigo_interno) porCodigo.set(norm(im.codigo_interno), im);
      }

      const vistosNoArquivo = new Set<string>();
      const out: LinhaValidada[] = raw.map((l) => {
        const base = converterLinha(l, mapa);
        // vincula empreendimento pelo nome, se existir cadastrado
        if (base.empreendimento) {
          const ref = nomes.get(norm(base.empreendimento));
          if (ref) base.registro[ref.col] = ref.id;
        }
        let duplicado: LinhaValidada["duplicado"] = "nao";
        let duplicadoDe: LinhaValidada["duplicadoDe"];
        const porCod = base.registro.codigo_interno ? porCodigo.get(norm(base.registro.codigo_interno)) : null;
        const exato = porCod ?? porExact.get(base.exactFingerprint);
        const possivel = porFingerprint.get(base.fingerprint);
        if (exato) {
          duplicado = "exato";
          duplicadoDe = { id: exato.id, titulo: exato.titulo };
        } else if (possivel) {
          duplicado = "possivel";
          duplicadoDe = { id: possivel.id, titulo: possivel.titulo };
        } else if (vistosNoArquivo.has(base.exactFingerprint)) {
          duplicado = "exato";
        }
        vistosNoArquivo.add(base.exactFingerprint);
        return {
          ...base,
          duplicado,
          duplicadoDe,
          acao: base.erros.length ? "ignorar" : duplicado === "exato" ? "ignorar" : "importar",
        };
      });
      setLinhas(out);
      toast.success(`${out.length} linha(s) analisadas.`);
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function setAcao(row: number, acao: LinhaValidada["acao"]) {
    setLinhas((prev) => prev?.map((l) => (l.row === row ? { ...l, acao } : l)) ?? prev);
  }

  async function importar() {
    if (!linhas) return;
    setBusy(true);
    setResultado(null);
    const erros: string[] = [];
    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;
    try {
      for (const l of linhas) {
        if (l.erros.length || l.acao === "ignorar") {
          ignorados++;
          continue;
        }
        if (l.acao === "atualizar" && l.duplicadoDe) {
          const patch = { ...l.registro };
          delete patch.data_captacao; // nunca alterar a data original de inclusão
          const { error } = await supabase.from("imoveis").update(patch).eq("id", l.duplicadoDe.id);
          if (error) erros.push(`Linha ${l.row}: ${error.message}`);
          else atualizados++;
        } else {
          const { error } = await (supabase as any).from("imoveis").insert(l.registro);
          if (error) erros.push(`Linha ${l.row}: ${error.message}`);
          else inseridos++;
        }
      }
      setResultado({ inseridos, atualizados, ignorados, erros });
      if (inseridos || atualizados) toast.success(`${inseridos} importado(s), ${atualizados} atualizado(s).`);
      if (erros.length) toast.warning(`${erros.length} linha(s) com erro.`);
    } finally {
      setBusy(false);
    }
  }

  async function exportar() {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("imoveis")
        .select("*")
        .eq("arquivado", false)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const imoveis = (data ?? []) as any[];
      const ids = {
        edificios: new Set(imoveis.map((i) => i.edificio_id).filter(Boolean)),
        condominios: new Set(imoveis.map((i) => i.condominio_id).filter(Boolean)),
        loteamentos: new Set(imoveis.map((i) => i.loteamento_id).filter(Boolean)),
      };
      const nomePorId = new Map<string, string>();
      for (const t of ["edificios", "condominios", "loteamentos"] as const) {
        const lista = [...ids[t]];
        if (!lista.length) continue;
        const { data: refs } = await (supabase as any).from(t).select("id, nome").in("id", lista);
        for (const r of (refs ?? []) as any[]) nomePorId.set(r.id, r.nome);
      }
      const nomePorImovel = new Map<string, string>();
      for (const im of imoveis) {
        const nome = nomePorId.get(im.edificio_id) ?? nomePorId.get(im.condominio_id) ?? nomePorId.get(im.loteamento_id);
        if (nome) nomePorImovel.set(im.id, nome);
      }
      exportarImoveisOficial(imoveis, nomePorImovel);
      toast.success(`${imoveis.length} imóvel(is) exportado(s) no modelo oficial.`);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  const total = linhas?.length ?? 0;
  const comErro = linhas?.filter((l) => l.erros.length).length ?? 0;
  const revisar = linhas?.filter((l) => !l.erros.length && l.avisos.length).length ?? 0;
  const duplicados = linhas?.filter((l) => l.duplicado !== "nao").length ?? 0;
  const prontos = linhas?.filter((l) => !l.erros.length && !l.avisos.length && l.duplicado === "nao").length ?? 0;
  const aImportar = linhas?.filter((l) => !l.erros.length && l.acao !== "ignorar").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Modelo Oficial de Importação
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Um único layout para importar, exportar e reimportar. Baixe o modelo, preencha e envie —
            o sistema valida antes de gravar qualquer coisa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={baixarModeloOficial}>
            <Download className="h-4 w-4 mr-1" /> Baixar Modelo de Importação
          </Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Exportar XLS
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-slate-50 p-4 text-sm">
        <p className="font-medium mb-2">Regras do modelo</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><b>property_name</b> é o nome do empreendimento/edifício/condomínio.</li>
          <li>Apartamento, sala e loja usam <b>unit_reference</b>; casa e lote em condomínio usam <b>quadra</b> e <b>lote</b> (nunca concatenados).</li>
          <li>Imóvel de bairro sem quadra/lote usa <b>street</b> + <b>numero_endereco</b>.</li>
          <li><b>included_at</b> é a data original de inclusão e nunca é sobrescrita.</li>
          <li>O arquivo gerado em “Exportar XLS” pode ser editado e reimportado sem ajustar colunas.</li>
        </ul>
      </div>

      <FileDropzone onFile={onFile} />

      {busy && !linhas && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisando planilha…
        </div>
      )}

      {linhas && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Total" value={total} />
            <Stat label="Prontos" value={prontos} tone="ok" />
            <Stat label="Revisar" value={revisar} tone="warn" />
            <Stat label="Duplicados" value={duplicados} tone="warn" />
            <Stat label="Erros" value={comErro} tone="err" />
          </div>

          {naoMapeadas.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Colunas ignoradas do arquivo: {naoMapeadas.join(", ")}
            </p>
          )}

          <div className="border rounded-lg overflow-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr className="text-left">
                  <th className="p-2 w-14">Linha</th>
                  <th className="p-2">Imóvel</th>
                  <th className="p-2 w-28">Unidade</th>
                  <th className="p-2 w-28">Qd / Lt</th>
                  <th className="p-2 w-32">Valor</th>
                  <th className="p-2">Situação</th>
                  <th className="p-2 w-40">Ação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.row} className="border-t align-top">
                    <td className="p-2 text-muted-foreground">{l.row}</td>
                    <td className="p-2">
                      <div className="font-medium">{l.registro.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {[l.registro.tipo_imovel, l.registro.cidade, l.registro.bairro].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="p-2">{l.registro.unidade ?? "—"}</td>
                    <td className="p-2">
                      {l.registro.quadra || l.registro.lote
                        ? `${l.registro.quadra ? `Q ${l.registro.quadra}` : ""} ${l.registro.lote ? `L ${l.registro.lote}` : ""}`.trim()
                        : "—"}
                    </td>
                    <td className="p-2">
                      {l.registro.preco
                        ? l.registro.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                        : "—"}
                    </td>
                    <td className="p-2 space-y-1">
                      {l.erros.map((e) => (
                        <Badge key={e} variant="destructive" className="mr-1 font-normal">
                          <XCircle className="h-3 w-3 mr-1" /> {e}
                        </Badge>
                      ))}
                      {l.avisos.map((a) => (
                        <Badge key={a} variant="secondary" className="mr-1 font-normal">
                          <AlertTriangle className="h-3 w-3 mr-1" /> {a}
                        </Badge>
                      ))}
                      {l.duplicado !== "nao" && (
                        <Badge variant="outline" className="mr-1 font-normal">
                          <Copy className="h-3 w-3 mr-1" />
                          {l.duplicado === "exato" ? "Duplicado exato" : "Possível duplicidade"}
                          {l.duplicadoDe ? `: ${l.duplicadoDe.titulo}` : ""}
                        </Badge>
                      )}
                      {!l.erros.length && !l.avisos.length && l.duplicado === "nao" && (
                        <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Pronto
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full border rounded px-2 py-1 text-xs bg-background disabled:opacity-50"
                        value={l.acao}
                        disabled={!!l.erros.length}
                        onChange={(e) => setAcao(l.row, e.target.value as LinhaValidada["acao"])}
                      >
                        <option value="importar">Importar como novo</option>
                        <option value="atualizar" disabled={!l.duplicadoDe}>Atualizar existente</option>
                        <option value="ignorar">Ignorar</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={importar} disabled={busy || aImportar === 0}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Importar {aImportar} imóvel(is)
            </Button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="font-medium">Resultado da importação</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{resultado.inseridos} inseridos</Badge>
            <Badge variant="secondary">{resultado.atualizados} atualizados</Badge>
            <Badge variant="secondary">{resultado.ignorados} ignorados</Badge>
            {resultado.erros.length > 0 && <Badge variant="destructive">{resultado.erros.length} com erro</Badge>}
          </div>
          {resultado.erros.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-destructive space-y-0.5 max-h-48 overflow-auto">
              {resultado.erros.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "err" }) {
  const color =
    tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "err" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
