import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Trash2, Eye, ImageIcon, Upload, Link as LinkIcon,
  Star, ArrowLeft, X, ChevronLeft, ChevronRight, Tag, Loader2, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSignedUrl, resizeImage } from "@/lib/storage";
import { useRoles } from "@/hooks/use-roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({ meta: [{ title: "Banco de Imagens — MV Broker" }] }),
  component: BancoImagensPage,
});

type Categoria = { id: string; slug: string; nome: string; ordem: number; sistema: boolean };
type Galeria = {
  id: string; nome: string; descricao: string | null;
  categoria_id: string | null; drive_url: string | null;
  capa_arquivo_id: string | null; created_at: string;
};
type GaleriaArquivo = {
  id: string; galeria_id: string; nome: string; storage_path: string;
  bucket: string; mime_type: string | null; tamanho: number; ordem: number;
};

const BUCKET = "banco-imagens";

function BancoImagensPage() {
  const { roles } = useRoles();
  const isAdmin = roles.includes("super_admin") || roles.includes("secretaria");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [openGalleryId, setOpenGalleryId] = useState<string | null>(null);
  const [openNewCat, setOpenNewCat] = useState(false);
  const [openNewGal, setOpenNewGal] = useState(false);
  const [editGal, setEditGal] = useState<Galeria | null>(null);
  const [capasUrls, setCapasUrls] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [c, g] = await Promise.all([
      supabase.from("banco_categorias").select("*").order("ordem"),
      supabase.from("banco_galerias").select("*").order("created_at", { ascending: false }),
    ]);
    setCategorias((c.data ?? []) as Categoria[]);
    setGalerias((g.data ?? []) as Galeria[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Load cover URLs
  useEffect(() => {
    (async () => {
      const ids = galerias.filter((g) => g.capa_arquivo_id).map((g) => g.capa_arquivo_id!) ;
      if (ids.length === 0) { setCapasUrls({}); return; }
      const { data } = await supabase.from("banco_galeria_arquivos").select("id,bucket,storage_path").in("id", ids);
      const map: Record<string, string> = {};
      for (const a of data ?? []) {
        const url = await getSignedUrl((a as any).bucket, (a as any).storage_path, 3600);
        if (url) map[(a as any).id] = url;
      }
      setCapasUrls(map);
    })();
  }, [galerias]);

  const filtered = useMemo(() => {
    return galerias.filter((g) => {
      const matchCat = filterCat === "all" || g.categoria_id === filterCat;
      const matchSearch = !search || g.nome.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [galerias, search, filterCat]);

  const catById = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias]);

  return (
    <>
      <PageHeader
        title="Banco de Imagens"
        description="Galerias de imagens organizadas por categoria. Compartilhe fotos de praias, praças, pontos turísticos e mais."
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpenNewCat(true)}>
                <Tag className="h-4 w-4 mr-1.5" /> Nova categoria
              </Button>
              <Button onClick={() => setOpenNewGal(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Nova galeria
              </Button>
            </div>
          )
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome da galeria..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma galeria encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((g) => {
                const capa = g.capa_arquivo_id ? capasUrls[g.capa_arquivo_id] : null;
                return (
                  <div
                    key={g.id}
                    onClick={() => setOpenGalleryId(g.id)}
                    className="group cursor-pointer rounded-lg border bg-card overflow-hidden hover:border-primary transition-colors"
                  >
                    <div className="aspect-video bg-muted relative">
                      {capa ? (
                        <img src={capa} alt={g.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {g.drive_url && (
                        <Badge className="absolute top-2 right-2" variant="secondary">
                          <LinkIcon className="h-3 w-3 mr-1" /> Drive
                        </Badge>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium truncate">{g.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {g.categoria_id ? catById[g.categoria_id]?.nome ?? "—" : "Sem categoria"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {openNewCat && (
        <NovaCategoriaDialog
          open={openNewCat}
          onClose={() => setOpenNewCat(false)}
          onSaved={load}
          categorias={categorias}
        />
      )}
      {openNewGal && (
        <GaleriaFormDialog
          open={openNewGal}
          onClose={() => setOpenNewGal(false)}
          onSaved={load}
          categorias={categorias}
        />
      )}
      {editGal && (
        <GaleriaFormDialog
          open={!!editGal}
          galeria={editGal}
          onClose={() => setEditGal(null)}
          onSaved={load}
          categorias={categorias}
        />
      )}
      {openGalleryId && (
        <GaleriaDetailDialog
          galeriaId={openGalleryId}
          isAdmin={isAdmin}
          onClose={() => setOpenGalleryId(null)}
          onChanged={load}
          onEdit={(g) => { setOpenGalleryId(null); setEditGal(g); }}
          categorias={categorias}
        />
      )}
    </>
  );
}

/* ---------- Nova Categoria ---------- */
function NovaCategoriaDialog({ open, onClose, onSaved, categorias }: {
  open: boolean; onClose: () => void; onSaved: () => void; categorias: Categoria[];
}) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const slug = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ordem = (categorias.at(-1)?.ordem ?? 0) + 1;
    const { error } = await supabase.from("banco_categorias").insert({ nome: nome.trim(), slug, ordem, sistema: false });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoria criada");
    setNome("");
    onSaved(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Eventos" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Form de Galeria (criar/editar) ---------- */
function GaleriaFormDialog({ open, onClose, onSaved, categorias, galeria }: {
  open: boolean; onClose: () => void; onSaved: () => void; categorias: Categoria[]; galeria?: Galeria;
}) {
  const [nome, setNome] = useState(galeria?.nome ?? "");
  const [descricao, setDescricao] = useState(galeria?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState(galeria?.categoria_id ?? "");
  const [driveUrl, setDriveUrl] = useState(galeria?.drive_url ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setUploading(true);
    try {
      let galId = galeria?.id;
      if (galId) {
        const { error } = await supabase.from("banco_galerias").update({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          categoria_id: categoriaId || null,
          drive_url: driveUrl.trim() || null,
        }).eq("id", galId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("banco_galerias").insert({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          categoria_id: categoriaId || null,
          drive_url: driveUrl.trim() || null,
        }).select("id").single();
        if (error) throw error;
        galId = data.id;
      }

      // Upload arquivos novos
      if (files.length > 0 && galId) {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        const { data: maxRow } = await supabase.from("banco_galeria_arquivos").select("ordem").eq("galeria_id", galId).order("ordem", { ascending: false }).limit(1).maybeSingle();
        let ordem = (maxRow?.ordem ?? 0) + 1;
        for (const f of files) {
          const blob = await resizeImage(f, 2400, 0.9) ?? f;
          const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${galId}/${ordem}-${Math.random().toString(36).slice(2, 8)}.${ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" ? "webp" : ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
            contentType: blob instanceof Blob && !(blob instanceof File) ? "image/webp" : f.type,
            upsert: false,
          });
          if (upErr) throw upErr;
          const { error: insErr, data: insData } = await supabase.from("banco_galeria_arquivos").insert({
            galeria_id: galId,
            nome: f.name,
            storage_path: path,
            bucket: BUCKET,
            mime_type: "image/webp",
            tamanho: (blob as Blob).size,
            ordem: ordem++,
            created_by: uid,
          }).select("id").single();
          if (insErr) throw insErr;
          // Define capa se ainda não há
          if (!galeria?.capa_arquivo_id && insData) {
            await supabase.from("banco_galerias").update({ capa_arquivo_id: insData.id }).eq("id", galId).is("capa_arquivo_id", null);
          }
        }
      }

      toast.success(galeria ? "Galeria atualizada" : "Galeria criada");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{galeria ? "Editar galeria" : "Nova galeria"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Praça Central" autoFocus />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoriaId || "none"} onValueChange={(v) => setCategoriaId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> Link do Google Drive (alta resolução)</Label>
            <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." />
          </div>
          <div>
            <Label>Adicionar imagens</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <Button variant="outline" type="button" onClick={() => inputRef.current?.click()} className="w-full">
              <Upload className="h-4 w-4 mr-1.5" />
              {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Selecionar arquivos"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
          <Button onClick={save} disabled={uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Salvando…</> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Detalhe da galeria ---------- */
function GaleriaDetailDialog({ galeriaId, isAdmin, onClose, onChanged, onEdit, categorias }: {
  galeriaId: string; isAdmin: boolean;
  onClose: () => void; onChanged: () => void; onEdit: (g: Galeria) => void;
  categorias: Categoria[];
}) {
  const [galeria, setGaleria] = useState<Galeria | null>(null);
  const [arquivos, setArquivos] = useState<GaleriaArquivo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const [g, a] = await Promise.all([
      supabase.from("banco_galerias").select("*").eq("id", galeriaId).maybeSingle(),
      supabase.from("banco_galeria_arquivos").select("*").eq("galeria_id", galeriaId).order("ordem"),
    ]);
    setGaleria((g.data as Galeria) ?? null);
    const arqs = (a.data ?? []) as GaleriaArquivo[];
    setArquivos(arqs);
    const map: Record<string, string> = {};
    for (const f of arqs) {
      const u = await getSignedUrl(f.bucket, f.storage_path, 3600);
      if (u) map[f.id] = u;
    }
    setUrls(map);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [galeriaId]);

  async function setCapa(arqId: string) {
    await supabase.from("banco_galerias").update({ capa_arquivo_id: arqId }).eq("id", galeriaId);
    toast.success("Capa definida");
    load(); onChanged();
  }

  async function removeArq(arq: GaleriaArquivo) {
    if (!confirm("Excluir imagem?")) return;
    await supabase.storage.from(arq.bucket).remove([arq.storage_path]);
    await supabase.from("banco_galeria_arquivos").delete().eq("id", arq.id);
    if (galeria?.capa_arquivo_id === arq.id) {
      await supabase.from("banco_galerias").update({ capa_arquivo_id: null }).eq("id", galeriaId);
    }
    toast.success("Removida");
    load(); onChanged();
  }

  async function removeGaleria() {
    if (!confirm("Excluir esta galeria e todas as imagens?")) return;
    if (arquivos.length > 0) {
      await supabase.storage.from(BUCKET).remove(arquivos.map((a) => a.storage_path));
    }
    await supabase.from("banco_galerias").delete().eq("id", galeriaId);
    toast.success("Galeria excluída");
    onChanged(); onClose();
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      let ordem = Date.now();
      for (const f of Array.from(files)) {
        const blob = await resizeImage(f, 2400, 0.9) ?? f;
        const path = `${galeriaId}/${ordem}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
          contentType: "image/webp", upsert: false,
        });
        if (upErr) throw upErr;
        await supabase.from("banco_galeria_arquivos").insert({
          galeria_id: galeriaId, nome: f.name, storage_path: path, bucket: BUCKET,
          mime_type: "image/webp", tamanho: (blob as Blob).size, ordem: ordem++, created_by: uid,
        });
      }
      toast.success("Imagens adicionadas");
      load(); onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const cat = galeria?.categoria_id ? categorias.find((c) => c.id === galeria.categoria_id) : null;
  const current = viewerIdx !== null ? arquivos[viewerIdx] : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate">{galeria?.nome ?? "…"}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {cat && <Badge variant="secondary">{cat.nome}</Badge>}
                {galeria?.drive_url && (
                  <a href={galeria.drive_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <LinkIcon className="h-3 w-3" /> Material em alta no Drive
                  </a>
                )}
              </div>
              {galeria?.descricao && <p className="text-sm text-muted-foreground mt-2">{galeria.descricao}</p>}
            </div>
            {isAdmin && galeria && (
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => onEdit(galeria)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  Adicionar fotos
                </Button>
                <Button size="sm" variant="destructive" onClick={removeGaleria}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
                       onChange={(e) => addFiles(e.target.files)} />
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : arquivos.length === 0 ? (
          <div className="py-12 text-center">
            <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma imagem nesta galeria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {arquivos.map((f, i) => (
              <div key={f.id} className="relative group rounded-md overflow-hidden border bg-muted cursor-pointer"
                   onClick={() => setViewerIdx(i)}>
                {urls[f.id] ? (
                  <img src={urls[f.id]} alt={f.nome} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 grid place-items-center text-xs text-muted-foreground">…</div>
                )}
                {galeria?.capa_arquivo_id === f.id && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">CAPA</span>
                )}
                {isAdmin && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                       onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setCapa(f.id)} title="Definir capa">
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => removeArq(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Viewer */}
        {current && (
          <Dialog open onOpenChange={() => setViewerIdx(null)}>
            <DialogContent className="max-w-5xl p-0 bg-black border-0">
              <div className="relative">
                <button className="absolute top-3 right-3 z-10 p-1.5 rounded bg-black/50 text-white" onClick={() => setViewerIdx(null)}>
                  <X className="h-5 w-5" />
                </button>
                {viewerIdx! > 0 && (
                  <button className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white"
                          onClick={() => setViewerIdx(viewerIdx! - 1)}>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {viewerIdx! < arquivos.length - 1 && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white"
                          onClick={() => setViewerIdx(viewerIdx! + 1)}>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
                <img src={urls[current.id]} alt={current.nome} className="w-full max-h-[85vh] object-contain" />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* Voltar (não usado, mas mantido caso ative roteamento por id) */
function _BackBtn({ onClick }: { onClick: () => void }) {
  return <Button size="sm" variant="ghost" onClick={onClick}><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Button>;
}
