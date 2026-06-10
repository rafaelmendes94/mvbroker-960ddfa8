import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileUploader } from "./FileUploader";
import { ImageGallery, type GalleryFile } from "./ImageGallery";
import { DocumentViewer, type DocumentFile } from "./DocumentViewer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { isImage } from "@/lib/storage";
import type { CategoriaKey } from "@/lib/storage";

/** Gerencia todos os arquivos de um registro: imagens + documentos + upload */
export function MediaManager({
  registroTipo,
  registroId,
  defaultCategoria = "fotos",
  publico = false,
}: {
  registroTipo: string;
  registroId: string;
  defaultCategoria?: CategoriaKey;
  publico?: boolean;
}) {
  const [files, setFiles] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("arquivos")
      .select("*")
      .eq("registro_tipo", registroTipo)
      .eq("registro_id", registroId)
      .order("created_at", { ascending: false });
    setFiles(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [registroTipo, registroId]);

  const images = files.filter((f) => isImage(f.mime_type)) as GalleryFile[];
  const docs = files.filter((f) => !isImage(f.mime_type)) as DocumentFile[];

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList>
        <TabsTrigger value="upload">Upload</TabsTrigger>
        <TabsTrigger value="imagens">Imagens ({images.length})</TabsTrigger>
        <TabsTrigger value="documentos">Documentos ({docs.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="pt-4">
        <FileUploader
          defaultCategoria={defaultCategoria}
          registroTipo={registroTipo}
          registroId={registroId}
          publico={publico}
          onUploaded={load}
        />
      </TabsContent>
      <TabsContent value="imagens" className="pt-4">
        <ImageGallery files={images} onChange={load} />
      </TabsContent>
      <TabsContent value="documentos" className="pt-4 space-y-3">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum documento.</p>
        ) : docs.map((d) => (
          <Card key={d.id}><CardContent className="p-4"><DocumentViewer file={d} /></CardContent></Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
