import { useEffect, useState } from "react";
import { Download, Star, Trash2, X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getSignedUrl, logArquivoAcao } from "@/lib/storage";
import { toast } from "sonner";

export type GalleryFile = {
  id: string;
  nome: string;
  storage_path: string;
  thumb_path: string | null;
  medium_path: string | null;
  bucket: string;
  mime_type: string | null;
  metadata?: any;
};

export function ImageGallery({
  files,
  onChange,
  capaArquivoId,
  onSetCapa,
}: {
  files: GalleryFile[];
  onChange?: () => void;
  capaArquivoId?: string | null;
  onSetCapa?: (id: string) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const f of files) {
        const path = f.thumb_path ?? f.storage_path;
        const url = await getSignedUrl(f.bucket, path, 3600);
        if (url) map[f.id] = url;
      }
      setUrls(map);
    })();
  }, [files]);

  async function openViewer(i: number) {
    setIdx(i); setOpen(true);
    const f = files[i];
    const path = f.medium_path ?? f.storage_path;
    const u = await getSignedUrl(f.bucket, path);
    if (u) setUrls((p) => ({ ...p, [`big:${f.id}`]: u }));
  }

  async function download(f: GalleryFile) {
    const url = await getSignedUrl(f.bucket, f.storage_path);
    if (!url) { toast.error("Falha ao gerar link"); return; }
    await logArquivoAcao(f.id, "download", { nome: f.nome });
    window.open(url, "_blank");
  }

  async function remove(f: GalleryFile) {
    if (!confirm("Excluir imagem?")) return;
    const paths = [f.storage_path, f.thumb_path, f.medium_path].filter(Boolean) as string[];
    await supabase.storage.from(f.bucket).remove(paths);
    await supabase.from("arquivos").delete().eq("id", f.id);
    await logArquivoAcao(f.id, "exclusao", { nome: f.nome });
    toast.success("Excluído");
    onChange?.();
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <ImageOff className="h-8 w-8 mx-auto mb-2" />
        Nenhuma imagem.
      </div>
    );
  }

  const current = files[idx];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map((f, i) => (
          <div key={f.id} className="relative group rounded-md overflow-hidden border bg-muted cursor-pointer" onClick={() => openViewer(i)}>
            {urls[f.id] ? (
              <img src={urls[f.id]} alt={f.nome} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 grid place-items-center text-xs text-muted-foreground">…</div>
            )}
            {capaArquivoId === f.id && (
              <span className="absolute top-1.5 left-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">CAPA</span>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              {onSetCapa && (
                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => onSetCapa(f.id)} title="Capa"><Star className="h-3.5 w-3.5" /></Button>
              )}
              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => download(f)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
              {onChange && <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(f)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-0 bg-black border-0">
          <div className="relative">
            <button className="absolute top-3 right-3 z-10 p-1.5 rounded bg-black/50 text-white" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            {idx > 0 && (
              <button className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white" onClick={() => openViewer(idx - 1)}><ChevronLeft className="h-5 w-5" /></button>
            )}
            {idx < files.length - 1 && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white" onClick={() => openViewer(idx + 1)}><ChevronRight className="h-5 w-5" /></button>
            )}
            {current && (urls[`big:${current.id}`] ?? urls[current.id]) ? (
              <img src={urls[`big:${current.id}`] ?? urls[current.id]} alt={current.nome} className="w-full max-h-[85vh] object-contain" />
            ) : (
              <div className="h-[60vh] grid place-items-center text-white/60">Carregando…</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
