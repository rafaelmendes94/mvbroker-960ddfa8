import { useState } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/import/FileDropzone";
import { PreviewTable } from "@/components/import/PreviewTable";
import { ColumnMapper } from "@/components/import/ColumnMapper";
import { ImportReport } from "@/components/import/ImportReport";
import { parseFile, autoMatch, buildRows, importBatch, downloadTemplate, type ImportResult, type ParsedFile } from "@/lib/import-runner";
import type { ImportField } from "@/lib/import-schemas";
import { toast } from "sonner";

type Props = {
  title: string;
  description?: string;
  table: string;
  fields: ImportField[];
  templateName: string;
  showMapper?: boolean;
};

export function ImportPage({ title, description, table, fields, templateName, showMapper }: Props) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(f: File) {
    setResult(null);
    try {
      const p = await parseFile(f);
      setParsed(p);
      setMapping(autoMatch(fields, p.headers));
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    }
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    setResult(null);
    try {
      const { records, errors } = await buildRows(fields, mapping, parsed.rows);
      if (records.length === 0) {
        setResult({ inserted: 0, failed: errors.length, errors });
        toast.error("Nenhum registro válido para importar.");
        return;
      }
      const res = await importBatch(table, records);
      const finalRes: ImportResult = {
        inserted: res.inserted,
        failed: res.failed,
        errors: [...errors, ...res.errors],
      };
      setResult(finalRes);
      if (finalRes.inserted > 0) toast.success(`${finalRes.inserted} registro(s) importado(s).`);
      if (finalRes.errors.length > 0) toast.warning(`${finalRes.errors.length} linha(s) com erro.`);
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
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateName, fields, "csv")}>
            <Download className="h-4 w-4 mr-1" /> Modelo CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateName, fields, "xlsx")}>
            <Download className="h-4 w-4 mr-1" /> Modelo Excel
          </Button>
        </div>
      </div>

      <FileDropzone onFile={onFile} />

      {parsed && (
        <>
          {showMapper && (
            <div className="space-y-2">
              <h3 className="font-medium">Mapeamento de colunas</h3>
              <p className="text-xs text-muted-foreground">
                Associe cada campo do sistema à coluna do seu arquivo. Os campos com nome compatível foram preenchidos automaticamente.
              </p>
              <ColumnMapper fields={fields} headers={parsed.headers} mapping={mapping} onChange={setMapping} />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">Pré-visualização</h3>
            <PreviewTable headers={parsed.headers} rows={parsed.rows} />
            <div className="text-xs text-muted-foreground">Total de linhas: {parsed.rows.length}</div>
          </div>

          <div className="flex justify-end">
            <Button onClick={runImport} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Importar {parsed.rows.length} linha(s)
            </Button>
          </div>
        </>
      )}

      {result && <ImportReport result={result} />}
    </div>
  );
}
