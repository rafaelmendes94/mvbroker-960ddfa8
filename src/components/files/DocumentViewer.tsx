import { useEffect, useState } from "react";
import { Download, FileText, FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSignedUrl, isPdf, isImage, formatBytes, logArquivoAcao } from "@/lib/storage";
import { PdfViewer } from "./PdfViewer";

export type DocumentFile = {
  id: string;
  nome: string;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  tamanho: number;
};

export function DocumentViewer({ file }: { file: DocumentFile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    getSignedUrl(file.bucket, file.storage_path, 3600).then(setUrl);
  }, [file]);

  async function handleDownload() {
    if (!url) return;
    await logArquivoAcao(file.id, "download", { nome: file.nome });
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isPdf(file.mime_type) ? <FileText className="h-4 w-4 text-primary shrink-0" /> : <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{file.nome}</div>
            <div className="text-xs text-muted-foreground">{formatBytes(file.tamanho)} · {file.mime_type ?? "—"}</div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={!url}>
          {url ? <Download className="h-4 w-4 mr-1.5" /> : <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Baixar
        </Button>
      </div>

      {isPdf(file.mime_type) && <PdfViewer bucket={file.bucket} path={file.storage_path} />}
      {isImage(file.mime_type) && url && (
        <img src={url} alt={file.nome} className="w-full max-h-[70vh] object-contain rounded-md border bg-muted" />
      )}
    </div>
  );
}
