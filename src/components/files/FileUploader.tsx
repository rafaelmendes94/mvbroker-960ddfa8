import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, X, FileIcon, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CATEGORIAS, type CategoriaKey, getCategoryConfig, resizeImage,
  ACCEPTED_BY_BUCKET, logArquivoAcao,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

export type UploaderProps = {
  defaultCategoria?: CategoriaKey;
  registroTipo?: string;
  registroId?: string;
  publico?: boolean;
  onUploaded?: (arquivoId: string) => void;
  multiple?: boolean;
  className?: string;
};

type Item = { file: File; progress: number; done: boolean; error?: string };

export function FileUploader({
  defaultCategoria = "outros",
  registroTipo, registroId, publico = false,
  onUploaded, multiple = true, className,
}: UploaderProps) {
  const [categoria, setCategoria] = useState<CategoriaKey>(defaultCategoria);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = getCategoryConfig(categoria);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setItems(files.map((f) => ({ file: f, progress: 0, done: false })));
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const ext = file.name.split(".").pop() ?? "bin";
        const base = `${categoria}/${Date.now()}-${i}`;
        const path = `${base}.${ext}`;
        setItems((p) => p.map((it, idx) => idx === i ? { ...it, progress: 15 } : it));

        const main = await supabase.storage.from(cfg.bucket).upload(path, file, { contentType: file.type });
        if (main.error) throw main.error;

        setItems((p) => p.map((it, idx) => idx === i ? { ...it, progress: 55 } : it));

        let thumb_path: string | null = null;
        let medium_path: string | null = null;
        if (file.type.startsWith("image/")) {
          const thumb = await resizeImage(file, 320, 0.8);
          if (thumb) {
            thumb_path = `${base}-thumb.webp`;
            await supabase.storage.from(cfg.bucket).upload(thumb_path, thumb, { contentType: "image/webp" });
          }
          const medium = await resizeImage(file, 1200, 0.85);
          if (medium) {
            medium_path = `${base}-medium.webp`;
            await supabase.storage.from(cfg.bucket).upload(medium_path, medium, { contentType: "image/webp" });
          }
        }
        setItems((p) => p.map((it, idx) => idx === i ? { ...it, progress: 85 } : it));

        const { data: row, error: insErr } = await supabase.from("arquivos").insert({
          nome: file.name,
          categoria,
          bucket: cfg.bucket,
          storage_path: path,
          thumb_path,
          medium_path,
          tamanho: file.size,
          mime_type: file.type,
          publico,
          registro_tipo: registroTipo ?? null,
          registro_id: registroId ?? null,
          usuario_id: userId ?? null,
        }).select().single();
        if (insErr) throw insErr;

        await logArquivoAcao(row.id, "upload", { nome: file.name });
        onUploaded?.(row.id);
        setItems((p) => p.map((it, idx) => idx === i ? { ...it, progress: 100, done: true } : it));
      } catch (err: any) {
        setItems((p) => p.map((it, idx) => idx === i ? { ...it, error: err.message ?? "Erro", progress: 100 } : it));
      }
    }
    setBusy(false);
    toast.success("Upload concluído");
  }, [categoria, cfg.bucket, publico, registroId, registroTipo, onUploaded]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">Categoria:</label>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaKey)}
          disabled={busy}
        >
          {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">Bucket: <code className="text-foreground/70">{cfg.bucket}</code></span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Arraste arquivos ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground mt-1">{ACCEPTED_BY_BUCKET[cfg.bucket]?.split(",").length} formatos aceitos</p>
        <input
          ref={inputRef} type="file" className="hidden"
          multiple={multiple}
          accept={ACCEPTED_BY_BUCKET[cfg.bucket]}
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              {it.file.type.startsWith("image/")
                ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                : <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="truncate">{it.file.name}</div>
                <Progress value={it.progress} className="h-1.5 mt-1" />
                {it.error && <div className="text-xs text-destructive mt-1">{it.error}</div>}
              </div>
              {it.done && !it.error && <span className="text-xs text-primary">OK</span>}
              {busy && !it.done && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!busy && (
                <Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
