import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tabela")({
  head: () => ({ meta: [{ title: "Tabela — MV Broker" }] }),
  component: TabelaPage,
});

type Item = {
  id: string;
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

function formatBytes(b?: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function TabelaPage() {
  const { roles, loading: rolesLoading } = useRoles();
  const isStaff = roles.includes("super_admin") || roles.includes("secretaria");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tabela_atual")
      .select("*")
      .order("uploaded_at", { ascending: false });
    setItems((data as Item[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (rolesLoading) return null;
  if (!isStaff) {
    return (
      <PageHeader title="Tabela" description="Acesso restrito a Super Admin e Secretaria." />
    );
  }

  const handleDownload = async (item: Item) => {
    const { data, error } = await supabase.storage
      .from("tabela")
      .createSignedUrl(item.file_path, 60, { download: item.file_name });
    if (error || !data?.signedUrl) {
      toast.error("Falha ao gerar link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Tamanho máximo: 20 MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const path = `tabela-${Date.now()}.pdf`;

      const { error: upErr } = await supabase.storage
        .from("tabela")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("tabela_atual").insert({
        file_path: path,
        file_name: file.name,
        size_bytes: file.size,
        uploaded_by: uid ?? null,
      });
      if (insErr) throw insErr;

      toast.success("Tabela adicionada ao histórico.");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível enviar o PDF.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Excluir "${item.file_name}"? Os clientes deixarão de ter acesso a esta versão.`)) return;
    try {
      await supabase.storage.from("tabela").remove([item.file_path]).catch(() => {});
      const { error } = await supabase.from("tabela_atual").delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Tabela excluída.");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível excluir.");
    }
  };

  return (
    <>
      <PageHeader
        title="Minha Tabela"
        description="Envie quantas tabelas em PDF quiser. Todas ficam disponíveis para download pelos clientes."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-primary" />
            Enviar nova tabela
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Cada envio é adicionado ao histórico e fica disponível para os clientes.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Enviando…" : "Selecionar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Histórico ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tabela enviada ainda.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviado em {new Date(item.uploaded_at).toLocaleString("pt-BR")} · {formatBytes(item.size_bytes)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleDownload(item)} variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <Button onClick={() => handleDelete(item)} variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
