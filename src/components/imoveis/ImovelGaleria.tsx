import { useEffect, useState } from "react";
import { Star, Trash2, Upload, GripVertical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logImovel } from "@/lib/audit";
import { compressImageToWebp } from "@/lib/imageCompress";
import { getImageUrls } from "@/lib/imageUrl";
import {
  DndContext, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function load() {
    if (!imovelId) return;
    const { data } = await supabase
      .from("imovel_imagens")
      .select("*")
      .eq("imovel_id", imovelId)
      .order("ordem", { ascending: true });
    if (!data) return;
    const paths = data.map((r) => r.storage_path).filter(Boolean) as string[];
    const urlMap = await getImageUrls(paths, "imoveis");
    setImgs(data.map((r) => ({ ...r, url: urlMap.get(r.storage_path) ?? "" } as Img)));
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
          cacheControl: "31536000",
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

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = imgs.findIndex((i) => i.id === active.id);
    const newIndex = imgs.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(imgs, oldIndex, newIndex).map((img, idx) => ({ ...img, ordem: idx }));
    setImgs(next);
    await Promise.all(
      next.map((img) =>
        supabase.from("imovel_imagens").update({ ordem: img.ordem }).eq("id", img.id),
      ),
    );
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
        {imgs.length > 0 && <span className="text-xs text-muted-foreground">{imgs.length} foto(s) — arraste para reordenar</span>}
      </div>

      {imgs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma foto ainda.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={imgs.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {imgs.map((img) => (
                <SortableImage
                  key={img.id}
                  img={img}
                  onSetCapa={() => setCapa(img.id)}
                  onRemove={() => remove(img)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableImage({
  img, onSetCapa, onRemove,
}: {
  img: Img; onSetCapa: () => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-md overflow-hidden border bg-muted">
      <img src={img.url} alt="" className="w-full h-32 object-cover pointer-events-none select-none" />
      {img.capa && (
        <span className="absolute top-1.5 left-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">CAPA</span>
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1.5 right-1.5 h-7 w-7 grid place-items-center rounded bg-background/80 backdrop-blur text-foreground/80 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Arrastar para reordenar"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={onSetCapa} title="Definir como capa"><Star className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
