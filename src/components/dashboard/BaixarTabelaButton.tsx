import { useEffect, useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { toast } from "sonner";

type Item = {
  id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
};

export function BaixarTabelaButton() {
  const { roles } = useRoles();
  const [items, setItems] = useState<Item[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(false);

  const isStaff = roles.includes("super_admin") || roles.includes("secretaria");

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("tabela_atual")
        .select("id, file_path, file_name, uploaded_at")
        .order("uploaded_at", { ascending: false });
      setItems((t as Item[] | null) ?? []);

      if (isStaff) {
        setAllowed(true);
      } else {
        const { data: sub } = await supabase.rpc("get_minha_assinatura");
        const ativa = Array.isArray(sub) && sub.some((s: { status?: string | null }) => s.status === "ativa");
        setAllowed(ativa);
      }
    })();
  }, [isStaff]);

  if (!allowed || items.length === 0) return null;

  const handleDownload = async (item: Item) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("tabela")
        .createSignedUrl(item.file_path, 60, { download: item.file_name });
      if (error || !data?.signedUrl) throw error ?? new Error("Falha ao gerar link");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      toast.error("Não foi possível baixar a tabela.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 1) {
    return (
      <Button onClick={() => handleDownload(items[0])} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Baixar tabela em PDF
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar tabela em PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Tabelas disponíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => handleDownload(item)}
            className="flex flex-col items-start gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-2 w-full">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate font-medium">{item.file_name}</span>
            </div>
            <span className="text-xs text-muted-foreground pl-6">
              {new Date(item.uploaded_at).toLocaleString("pt-BR")}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
