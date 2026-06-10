import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Trash2, X, ShoppingBag, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExportacao } from "@/hooks/use-exportacao";

export const Route = createFileRoute("/_authenticated/exportacoes")({
  head: () => ({ meta: [{ title: "Exportações — MV Broker" }] }),
  component: Exportacoes,
});

function Exportacoes() {
  const exp = useExportacao();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (exp.ids.size === 0) { setItems([]); return; }
      setLoading(true);
      const { data } = await supabase.from("imoveis").select("*").in("id", Array.from(exp.ids));
      setItems(data ?? []);
      setLoading(false);
    })();
  }, [exp.ids]);

  return (
    <>
      <PageHeader
        title="Minha exportação"
        description={`${exp.count} imóvel(is) na sua lista de exportação.`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/central"><ShoppingBag className="h-4 w-4 mr-1.5" />Adicionar mais</Link></Button>
            {exp.count > 0 && <Button variant="ghost" onClick={() => exp.clear()}><X className="h-4 w-4 mr-1.5" />Limpar tudo</Button>}
          </div>
        }
      />

      {exp.count === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Nenhum imóvel adicionado à exportação.</p>
            <Button asChild><Link to="/central">Ir para Central de Imóveis</Link></Button>
          </CardContent>
        </Card>
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
                    <Link to="/central/$id" params={{ id: i.id }} className="font-semibold hover:underline truncate block">{i.titulo}</Link>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{[i.bairro, i.cidade].filter(Boolean).join(", ") || "—"}</p>
                  </div>
                  <Badge variant="secondary">{i.status_imovel}</Badge>
                </div>
                <p className="text-lg font-bold mt-2">{i.preco ? `R$ ${Number(i.preco).toLocaleString("pt-BR")}` : "—"}</p>
                <div className="flex gap-2 mt-3">
                  <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/central/$id" params={{ id: i.id }}>Detalhes</Link></Button>
                  <Button variant="ghost" size="sm" onClick={() => exp.remove(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {exp.count > 0 && (
        <Card className="mt-4">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">Geração de PDF/ZIP será disponibilizada em breve.</p>
            <Button disabled><Download className="h-4 w-4 mr-1.5" />Gerar PDF / ZIP</Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
