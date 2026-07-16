import { useEffect, useState } from "react";
import { FileUp, Trash2, Loader2, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  tipo: "edificio" | "condominio" | "empreendimento" | "loteamento";
  estruturaId: string | null;
  table: "edificios" | "condominios" | "empreendimentos" | "loteamentos";
  currentPath: string | null;
  onChange: (path: string | null) => void;
  column?: "implantacao_pdf_path" | "mapa_pdf_path";
  labelSend?: string;
  labelReplace?: string;
  labelEmpty?: string;
  fileSlug?: string;
};

export function PdfImplantacaoUpload({
  tipo, estruturaId, table, currentPath, onChange,
  column = "implantacao_pdf_path",
  labelSend = "Enviar PDF de implantação",
  labelReplace = "Substituir PDF",
  labelEmpty = "Nenhum PDF de implantação enviado.",
  fileSlug = "implantacao",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentPath) { setSigned(null); return; }
      const { data } = await supabase.storage.from("estrutura-arquivos").createSignedUrl(currentPath, 3600);
      if (alive) setSigned(data?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [currentPath]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!estruturaId) { toast.error("Salve o registro antes de anexar o PDF"); return; }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie apenas arquivos PDF"); return;
    }
    setUploading(true);
    try {
      if (currentPath) {
        await supabase.storage.from("estrutura-arquivos").remove([currentPath]);
      }
      const path = `${tipo}/${estruturaId}/${fileSlug}-${Date.now()}.pdf`;
      const up = await supabase.storage.from("estrutura-arquivos").upload(path, file, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (up.error) { toast.error(up.error.message); return; }
      const { error } = await supabase.from(table).update({ [column]: path } as any).eq("id", estruturaId);
      if (error) { toast.error(error.message); return; }
      onChange(path);
      toast.success("Enviado");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remove() {
    if (!estruturaId || !currentPath) return;
    if (!confirm("Remover o PDF?")) return;
    await supabase.storage.from("estrutura-arquivos").remove([currentPath]);
    await supabase.from(table).update({ [column]: null } as any).eq("id", estruturaId);
    onChange(null);
    toast.success("Removido");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer">
          <input type="file" accept="application/pdf,.pdf" onChange={handleUpload} className="hidden" disabled={!estruturaId || uploading} />
          <Button type="button" variant="outline" size="sm" disabled={!estruturaId || uploading} asChild>
            <span>
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileUp className="h-4 w-4 mr-1.5" />}
              {currentPath ? labelReplace : labelSend}
            </span>
          </Button>
        </label>
        {currentPath && signed && (
          <>
            <Button asChild type="button" variant="ghost" size="sm">
              <a href={signed} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir
              </a>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Remover
            </Button>
          </>
        )}
        {!estruturaId && <span className="text-xs text-muted-foreground">Salve o registro para habilitar o envio.</span>}
      </div>
      {currentPath && signed ? (
        <div className="rounded-md border bg-muted/30 overflow-hidden">
          <iframe src={signed} title="Implantação (PDF)" className="w-full h-[420px]" />
        </div>
      ) : (
        <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
          <FileText className="h-6 w-6" />
          Nenhum PDF de implantação enviado.
        </div>
      )}
    </div>
  );
}
