import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FolderArchive, HardDrive, Upload as UploadIcon, Download as DownloadIcon, Search, Trash2, Eye, FileIcon, ImageIcon, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoleGate } from "@/components/RoleGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORIAS, type CategoriaKey, formatBytes, getSignedUrl, isImage, logArquivoAcao } from "@/lib/storage";
import { FileUploader } from "@/components/files/FileUploader";
import { DocumentViewer } from "@/components/files/DocumentViewer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({ meta: [{ title: "Biblioteca de Arquivos — MV Broker" }] }),
  component: () => (
    <RoleGate allow={["super_admin", "secretaria"]}>
      <BibliotecaPage />
    </RoleGate>
  ),
});

type Arquivo = {
  id: string; nome: string; categoria: CategoriaKey; bucket: string;
  storage_path: string; mime_type: string | null; tamanho: number;
  created_at: string; publico: boolean; registro_tipo: string | null; registro_id: string | null;
};

function BibliotecaPage() {
  const [items, setItems] = useState<Arquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CategoriaKey | "all">("all");
  const [viewing, setViewing] = useState<Arquivo | null>(null);
  const [stats, setStats] = useState({ uploadsMes: 0, downloadsMes: 0 });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("arquivos").select("*").order("created_at", { ascending: false }).limit(500);
    setItems((data ?? []) as Arquivo[]);
    const since = new Date(); since.setDate(1); since.setHours(0,0,0,0);
    const [up, dl] = await Promise.all([
      supabase.from("arquivo_logs").select("*", { count: "exact", head: true }).eq("acao", "upload").gte("created_at", since.toISOString()),
      supabase.from("arquivo_logs").select("*", { count: "exact", head: true }).eq("acao", "download").gte("created_at", since.toISOString()),
    ]);
    setStats({ uploadsMes: up.count ?? 0, downloadsMes: dl.count ?? 0 });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    items.filter((i) =>
      (filter === "all" || i.categoria === filter) &&
      i.nome.toLowerCase().includes(search.toLowerCase())
    ), [items, search, filter]);

  const totalSize = items.reduce((s, i) => s + Number(i.tamanho ?? 0), 0);

  async function download(f: Arquivo) {
    const url = await getSignedUrl(f.bucket, f.storage_path);
    if (!url) { toast.error("Falha ao gerar link"); return; }
    await logArquivoAcao(f.id, "download", { nome: f.nome });
    window.open(url, "_blank");
  }
  async function remove(f: Arquivo) {
    if (!confirm(`Excluir ${f.nome}?`)) return;
    await supabase.storage.from(f.bucket).remove([f.storage_path]);
    await supabase.from("arquivos").delete().eq("id", f.id);
    await logArquivoAcao(f.id, "exclusao", { nome: f.nome });
    toast.success("Excluído");
    load();
  }

  const kpis = [
    { label: "Total de arquivos", value: items.length.toString(), icon: FolderArchive },
    { label: "Espaço utilizado", value: formatBytes(totalSize), icon: HardDrive },
    { label: "Uploads (mês)", value: stats.uploadsMes.toString(), icon: UploadIcon },
    { label: "Downloads (mês)", value: stats.downloadsMes.toString(), icon: DownloadIcon },
  ];

  return (
    <>
      <PageHeader
        title="Biblioteca de Arquivos"
        description="Armazenamento centralizado de imagens, documentos, contratos e materiais."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" /> Novo upload</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Upload de arquivos</DialogTitle></DialogHeader>
              <FileUploader onUploaded={() => load()} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold leading-tight">{k.value}</div>
                  <div className="text-sm text-muted-foreground">{k.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar arquivos..." value={search} onChange={(e) => setSearch(e.target.value)} />
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

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <FolderArchive className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Vinculado</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isImage(f.mime_type) ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <FileIcon className="h-4 w-4 text-muted-foreground" />}
                        <span className="truncate max-w-[260px]">{f.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{f.categoria}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs"><code>{f.bucket}</code></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatBytes(f.tamanho)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {f.registro_tipo ? `${f.registro_tipo}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(f.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setViewing(f)}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => download(f)}><DownloadIcon className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.nome}</DialogTitle></DialogHeader>
          {viewing && <DocumentViewer file={viewing} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
