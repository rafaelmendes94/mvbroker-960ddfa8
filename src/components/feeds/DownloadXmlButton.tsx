import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  url: string;
  filename: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
};

export function DownloadXmlButton({ url, filename, label = "Baixar XML", size = "sm", variant = "outline" }: Props) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      const res = await fetch(url);
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !/xml/i.test(ct)) {
        const body = await res.text();
        const msg = body.slice(0, 200).replace(/<[^>]+>/g, " ").trim();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("XML baixado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao baixar XML");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size={size} variant={variant} onClick={handle} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
      {label}
    </Button>
  );
}
