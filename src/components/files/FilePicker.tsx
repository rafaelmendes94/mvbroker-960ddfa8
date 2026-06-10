import { useEffect, useState } from "react";
import { Search, FileIcon, ImageIcon, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORIAS, type CategoriaKey, isImage, getSignedUrl, formatBytes } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type ArquivoLite = {
  id: string;
  nome: string;
  categoria: CategoriaKey;
  bucket: string;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string | null;
  tamanho: number;
};

/** Seletor de arquivos existentes na biblioteca */
export function FilePicker({
  trigger,
  multiple = false,
  categoria,
  onSelect,
}: {
  trigger?: React.ReactNode;
  multiple?: boolean;
  categoria?: CategoriaKey;
  onSelect: (files: ArquivoLite[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CategoriaKey | "all">(categoria ?? "all");
  const [items, setItems] = useState<ArquivoLite[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, ArquivoLite>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      let q = supabase.from("arquivos").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("categoria", filter);
      const { data } = await q;
      const list = (data ?? []) as ArquivoLite[];
      setItems(list);
      const map: Record<string, string> = {};
      for (const f of list.filter((x) => isImage(x.mime_type))) {
        const u = await getSignedUrl(f.bucket, f.thumb_path ?? f.storage_path);
        if (u) map[f.id] = u;
      }
      setThumbs(map);
    })();
  }, [open, filter]);

  function toggle(f: ArquivoLite) {
    if (!multiple) { setSelected({ [f.id]: f }); return; }
    setSelected((p) => {
      const n = { ...p };
      if (n[f.id]) delete n[f.id]; else n[f.id] = f;
      return n;
    });
  }

  function confirm() {
    onSelect(Object.values(selected));
    setSelected({});
    setOpen(false);
  }

  const filtered = items.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline" size="sm">Escolher da biblioteca</Button>}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Biblioteca de arquivos</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">Todas categorias</option>
            {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum arquivo.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filtered.map((f) => {
              const sel = !!selected[f.id];
              return (
                <button
                  key={f.id} type="button" onClick={() => toggle(f)}
                  className={cn("relative text-left rounded-md border overflow-hidden hover:border-primary transition", sel && "border-primary ring-2 ring-primary/30")}
                >
                  {isImage(f.mime_type) && thumbs[f.id] ? (
                    <img src={thumbs[f.id]} alt={f.nome} className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 grid place-items-center bg-muted">
                      {isImage(f.mime_type) ? <ImageIcon className="h-7 w-7 text-muted-foreground" /> : <FileIcon className="h-7 w-7 text-muted-foreground" />}
                    </div>
                  )}
                  {sel && <span className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                  <div className="p-2">
                    <div className="text-xs font-medium truncate">{f.nome}</div>
                    <div className="text-[10px] text-muted-foreground">{formatBytes(f.tamanho)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={Object.keys(selected).length === 0}>
            Selecionar ({Object.keys(selected).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
