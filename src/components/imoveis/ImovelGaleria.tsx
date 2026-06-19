import { useEffect, useState } from "react";
import { Star, Trash2, Upload, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logImovel } from "@/lib/audit";

type Img = {
  id: string;
  storage_path: string;
  url: string;
  ordem: number;
  capa: boolean;
};

export function ImovelGaleria({ imovelId }: { imovelId: string | null }) {
  const [imgs, setImgs] = useState<Img[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (!imovelId) return;
    const { data } = await supabase
      .from("imovel_imagens")
      .select("*")
      .eq("imovel_id", imovelId)
      .order("ordem", { ascending: true });
    if (!data) return;
    const enriched = await Promise.all(
      data.map(async (r) => {
        const { data: s } = await supabase.storage.from("imoveis").createSignedUrl(r.storage_path, 3600);
        return { ...r, url: s?.signedUrl ?? "" } as Img;
      })
    );
    setImgs(enriched);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [imovelId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!imovelId) { toast.error("Salve o imóvel antes de enviar fotos"); return; }
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (let i = 0; i < files.length; i++) {
        const original = files[i];
        const f = await compressImageToWebp(original);
        const ext = (f.name.split(".").pop() || "webp").toLowerCase();
        const path = `${imovelId}/${Date.now()}-${i}.${ext}`;
        const up = await supabase.storage.from("imoveis").upload(path, f, {
          contentType: f.type || "image/webp",
          upsert: false,
        });
        if (up.error) { toast.error(up.error.message); continue; }
        await supabase.from("imovel_imagens").insert({
          imovel_id: imovelId,
          storage_path: path,
          url: path,
          ordem: imgs.length + i,
          capa: imgs.length === 0 && i === 0,
          created_by: u.user?.id ?? null,
        });
      }
      await logImovel(imovelId, "upload_imagens", `${files.length} imagem(ns) enviada(s)`);
      await load();
      toast.success("Imagens enviadas");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function setCapa(id: string) {
    if (!imovelId) return;
    await supabase.from("imovel_imagens").update({ capa: false }).eq("imovel_id", imovelId);
    await supabase.from("imovel_imagens").update({ capa: true }).eq("id", id);
    load();
  }

  async function remove(img: Img) {
    if (!confirm("Excluir imagem?")) return;
    await supabase.storage.from("imoveis").remove([img.storage_path]);
    await supabase.from("imovel_imagens").delete().eq("id", img.id);
    load();
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= imgs.length) return;
    const a = imgs[idx], b = imgs[next];
    await supabase.from("imovel_imagens").update({ ordem: b.ordem }).eq("id", a.id);
    await supabase.from("imovel_imagens").update({ ordem: a.ordem }).eq("id", b.id);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" disabled={!imovelId || uploading} />
          <Button type="button" variant="outline" size="sm" disabled={!imovelId || uploading} asChild>
            <span>
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Enviar fotos
            </span>
          </Button>
        </label>
        {!imovelId && <span className="text-xs text-muted-foreground">Salve o imóvel para habilitar uploads.</span>}
        {imgs.length > 0 && <span className="text-xs text-muted-foreground">{imgs.length} foto(s) — a primeira é a principal</span>}
      </div>

      {imgs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma foto ainda.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {imgs.map((img, idx) => (
            <div key={img.id} className="relative group rounded-md overflow-hidden border bg-muted">
              <img src={img.url} alt="" className="w-full h-32 object-cover" />
              {img.capa && (
                <span className="absolute top-1.5 left-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">CAPA</span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-0.5">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex gap-0.5">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setCapa(img.id)} title="Definir como capa"><Star className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(img)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
