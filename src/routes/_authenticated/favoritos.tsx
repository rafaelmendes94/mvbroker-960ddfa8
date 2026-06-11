import { IMOVEL_PUBLIC_COLUMNS } from "@/lib/db-columns";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, MapPin, ShoppingBag, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFavoritos } from "@/hooks/use-favoritos";
import { useExportacao } from "@/hooks/use-exportacao";

export const Route = createFileRoute("/_authenticated/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos — MV Broker" }] }),
  component: Favoritos,
});

function Favoritos() {
  const fav = useFavoritos();
  const exp = useExportacao();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (fav.ids.size === 0) { setItems([]); return; }
      setLoading(true);
      const { data } = await supabase.from("imoveis").select(IMOVEL_PUBLIC_COLUMNS).in("id", Array.from(fav.ids));
      setItems(data ?? []);
      setLoading(false);
    })();
  }, [fav.ids]);

  return (
    <>
      <PageHeader title="Meus favoritos" description={`${fav.count} imóvel(is) favoritados.`}
        actions={<Button asChild variant="outline"><Link to="/imoveis">Voltar aos Imóveis</Link></Button>} />

      {fav.count === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Heart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Você ainda não favoritou nenhum imóvel.</p>
          <Button asChild><Link to="/imoveis">Ir para Imóveis</Link></Button>
        </CardContent></Card>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">{i.codigo_interno}</p>
                    <p className="font-semibold truncate">{i.titulo}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{[i.bairro, i.cidade].filter(Boolean).join(", ") || "—"}</p>
                  </div>
                  <Badge variant="secondary">{i.status_imovel}</Badge>
                </div>
                <p className="text-lg font-bold mt-2">{i.preco ? `R$ ${Number(i.preco).toLocaleString("pt-BR")}` : "—"}</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant={exp.has(i.id) ? "secondary" : "default"} className="flex-1" onClick={() => exp.toggle(i.id)}>
                    {exp.has(i.id) ? <><Check className="h-3.5 w-3.5 mr-1" />Na lista</> : <><ShoppingBag className="h-3.5 w-3.5 mr-1" />+ Exportação</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => fav.toggle(i.id)}><Heart className="h-3.5 w-3.5 fill-destructive text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
