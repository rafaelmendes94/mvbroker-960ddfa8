import { useEffect, useState } from "react";
import { Download, MapPin, Bed, Bath, Car, Ruler, Star, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useExportacao } from "@/hooks/use-exportacao";
import { logImovel } from "@/lib/audit";
import { getImageUrl, getImageUrls } from "@/lib/imageUrl";

export function ImovelDrawer({ id, open, onOpenChange }: { id: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [imovel, setImovel] = useState<any>(null);
  const [imagens, setImagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const exp = useExportacao();

  useEffect(() => {
    if (!id || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: i }, { data: imgs }] = await Promise.all([
        supabase.from("imoveis").select("*").eq("id", id).single(),
        supabase.from("imovel_imagens").select("*").eq("imovel_id", id).order("ordem", { ascending: true }),
      ]);
      if (cancelled) return;
      setImovel(i);
      setImagens(imgs ?? []);
      setLoading(false);
      logImovel(id, "visualizado");
    })();
    return () => { cancelled = true; };
  }, [id, open]);

  async function baixarFotos() {
    if (!imagens.length) return;
    for (const img of imagens) {
      const { data } = await supabase.storage.from("imoveis").createSignedUrl(img.storage_path, 3600);
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = "";
        a.target = "_blank";
        a.click();
      }
    }
    if (id) logImovel(id, "fotos_baixadas", `${imagens.length} arquivo(s)`);
  }

  const capa = imagens.find((i) => i.capa) ?? imagens[0];
  const inExport = id ? exp.has(id) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{loading ? "Carregando..." : imovel?.titulo ?? "Imóvel"}</SheetTitle>
        </SheetHeader>

        {imovel && (
          <div className="mt-4 space-y-4">
            {capa && (
              <div className="aspect-video rounded-md overflow-hidden bg-muted">
                <img src={capa.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}

            {imagens.length > 1 && (
              <div className="grid grid-cols-5 gap-1.5">
                {imagens.slice(0, 5).map((g) => (
                  <div key={g.id} className="aspect-square rounded overflow-hidden bg-muted">
                    <img src={g.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{imovel.codigo_interno}</p>
                <p className="text-2xl font-bold">{imovel.preco ? `R$ ${Number(imovel.preco).toLocaleString("pt-BR")}` : "—"}</p>
              </div>
              <Badge>{imovel.status_imovel}</Badge>
            </div>

            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {[imovel.bairro, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—"}
            </p>

            <div className="flex gap-1 flex-wrap">
              {imovel.vista_mar && <Badge variant="secondary">Vista Mar</Badge>}
              {imovel.decorado && <Badge variant="secondary">Decorado</Badge>}
              {imovel.publicar_xml && <Badge variant="outline">XML</Badge>}
              {imovel.destaque_home && <Badge variant="default"><Star className="h-3 w-3 mr-1" />Destaque</Badge>}
              {imovel.aceita_permuta && <Badge variant="outline">Aceita Permuta</Badge>}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <Stat icon={Bed} value={imovel.dormitorios} label="Dorm." />
              <Stat icon={Bath} value={imovel.banheiros} label="Banh." />
              <Stat icon={Car} value={imovel.vagas} label="Vagas" />
              <Stat icon={Ruler} value={imovel.area_privativa ? `${imovel.area_privativa}m²` : null} label="Área" />
            </div>

            <Separator />

            {imovel.descricao && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm whitespace-pre-wrap line-clamp-6">{imovel.descricao}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => id && exp.toggle(id)} variant={inExport ? "secondary" : "default"} className="w-full">
                {inExport ? <><Check className="h-4 w-4 mr-1.5" /> Na exportação — Remover</> : <>+ Adicionar à exportação</>}
              </Button>
              <Button variant="outline" onClick={baixarFotos} disabled={!imagens.length} className="w-full">
                <Download className="h-4 w-4 mr-1.5" /> Baixar fotos
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: any; label: string }) {
  return (
    <div className="rounded-md border p-2">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground" />
      <p className="font-semibold mt-1">{value ?? "—"}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
