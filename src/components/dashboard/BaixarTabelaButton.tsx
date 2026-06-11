import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { toast } from "sonner";

export function BaixarTabelaButton() {
  const { roles } = useRoles();
  const [available, setAvailable] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("tabela.pdf");
  const [loading, setLoading] = useState(false);

  const isStaff = roles.includes("super_admin") || roles.includes("secretaria");

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("tabela_atual")
        .select("file_path, file_name")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (t?.file_path) {
        setAvailable(true);
        setFilePath(t.file_path);
        setFileName(t.file_name ?? "tabela.pdf");
      }

      if (isStaff) {
        setAllowed(true);
      } else {
        const { data: sub } = await supabase.rpc("get_minha_assinatura");
        const ativa = Array.isArray(sub) && sub.some((s: { status?: string | null }) => s.status === "ativa");
        setAllowed(ativa);
      }
    })();
  }, [isStaff]);

  if (!available || !allowed || !filePath) return null;

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("tabela")
        .createSignedUrl(filePath, 60, { download: fileName });
      if (error || !data?.signedUrl) throw error ?? new Error("Falha ao gerar link");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      toast.error("Não foi possível baixar a tabela.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Baixar tabela em PDF
    </Button>
  );
}
