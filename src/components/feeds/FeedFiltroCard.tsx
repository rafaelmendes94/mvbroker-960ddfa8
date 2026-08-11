import { useMemo, useState } from "react";
import { Copy, ExternalLink, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DownloadXmlButton } from "@/components/feeds/DownloadXmlButton";

const OPCOES = [
  { key: "fotos", label: "Somente com fotos" },
  { key: "video", label: "Somente com vídeo" },
  { key: "vista_mar", label: "Somente vista para o mar" },
  { key: "casa_condominio", label: "Somente casa em condomínio" },
  { key: "exclusivo", label: "Somente exclusivos" },
  { key: "disponivel", label: "Somente disponíveis" },
] as const;

type Key = (typeof OPCOES)[number]["key"];

export function FeedFiltroCard() {
  const [marcados, setMarcados] = useState<Set<Key>>(new Set());

  const url = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const qs = OPCOES.filter((o) => marcados.has(o.key))
      .map((o) => `${o.key}=1`)
      .join("&");
    return `${origin}/api/public/feed/filtro.xml${qs ? `?${qs}` : ""}`;
  }, [marcados]);

  function toggle(k: Key) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Montar meu XML</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Marque as condições desejadas — a URL do feed é gerada automaticamente. Sem marcações, equivale ao Feed Geral.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {OPCOES.map((o) => (
            <label key={o.key} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
              <Checkbox checked={marcados.has(o.key)} onCheckedChange={() => toggle(o.key)} />
              <Label className="text-sm font-normal cursor-pointer">{o.label}</Label>
            </label>
          ))}
        </div>

        <code className="block rounded bg-background border px-3 py-2 text-[11px] font-mono break-all">{url}</code>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("URL copiada");
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />Copiar URL
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir
            </a>
          </Button>
          <DownloadXmlButton url={url} filename="feed-filtrado.xml" />
        </div>
      </CardContent>
    </Card>
  );
}
