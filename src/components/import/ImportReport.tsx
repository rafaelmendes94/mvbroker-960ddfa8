import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { ImportResult } from "@/lib/import-runner";

export function ImportReport({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 p-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Importados</span>
          </div>
          <div className="text-2xl font-bold mt-1">{result.inserted}</div>
        </div>
        <div className="rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Falhas</span>
          </div>
          <div className="text-2xl font-bold mt-1">{result.failed + result.errors.length}</div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-3 py-2 border-b bg-muted/40 flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Erros ({result.errors.length})
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Linha</th>
                  <th className="text-left px-3 py-1.5 font-medium">Campo</th>
                  <th className="text-left px-3 py-1.5 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">{e.row}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{e.field || "—"}</td>
                    <td className="px-3 py-1.5">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
