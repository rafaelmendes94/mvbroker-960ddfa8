import { useState } from "react";
import { Download, Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/import/FileDropzone";
import { PreviewTable } from "@/components/import/PreviewTable";
import { ImportReport } from "@/components/import/ImportReport";
import { importBatch, type ImportResult } from "@/lib/import-runner";
import {
  parseMvBrokerFile,
  mvBrokerRowToImovel,
  MV_BROKER_HEADERS,
  type MvBrokerRow,
} from "@/lib/mv-broker-import";
import modeloAsset from "@/assets/modelo-mv-broker.xlsx.asset.json";
import { toast } from "sonner";

export function MvBrokerImportPage() {
  const [rows, setRows] = useState<MvBrokerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(f: File) {
    setResult(null);
    try {
      const parsed = await parseMvBrokerFile(f);
      if (parsed.length === 0) {
        toast.error("Planilha vazia ou fora do formato MV Broker.");
        return;
      }
      setRows(parsed);
      toast.success(`${parsed.length} linha(s) lidas do arquivo.`);
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    }
  }

  async function runImport() {
    if (!rows) return;
    setBusy(true);
    setResult(null);
    try {
      const records = rows.map(mvBrokerRowToImovel);
      const res = await importBatch("imoveis", records);
      setResult(res);
      if (res.inserted > 0) toast.success(`${res.inserted} imóvel(is) importado(s).`);
      if (res.errors.length > 0) toast.warning(`${res.errors.length} linha(s) com erro.`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Modelo MV Broker (AGENCIAMENTOS)
          </h2>
          <p className="text-sm text-muted-foreground">
            Use a sua planilha padrão de agenciamentos. As colunas são mapeadas automaticamente
            para o cadastro de imóveis — não é preciso configurar nada.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={modeloAsset.url} download="AGENCIAMENTOS_MV_BROKER.xlsx">
            <Download className="h-4 w-4 mr-1" />
            Baixar modelo
          </a>
        </Button>
      </div>

      <div className="rounded-lg border bg-slate-50 p-4 text-sm">
        <p className="font-medium mb-2">Como funciona</p>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Baixe o modelo (ou use a sua planilha atual de agenciamentos).</li>
          <li>Preencha as linhas com os imóveis — mantenha as colunas na mesma ordem.</li>
          <li>Envie o arquivo abaixo. Cada linha vira um imóvel no cadastro.</li>
        </ol>
      </div>

      <FileDropzone onFile={onFile} />

      {rows && (
        <>
          <div className="space-y-2">
            <h3 className="font-medium">Pré-visualização</h3>
            <PreviewTable
              headers={MV_BROKER_HEADERS as unknown as string[]}
              rows={rows as any[]}
            />
            <div className="text-xs text-muted-foreground">
              Total de linhas: {rows.length}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={runImport} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Importar {rows.length} imóvel(is)
            </Button>
          </div>
        </>
      )}

      {result && <ImportReport result={result} />}
    </div>
  );
}
