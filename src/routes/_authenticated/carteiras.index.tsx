import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Rss, Star, ArrowRight, Image as ImageIcon, Home } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getFeedGeralInfo } from "@/lib/carteiras.functions";
import { getFeedPersonalizado } from "@/lib/feed-personalizado.functions";
import { DownloadXmlButton } from "@/components/feeds/DownloadXmlButton";
import { FeedFiltroCard } from "@/components/feeds/FeedFiltroCard";

export const Route = createFileRoute("/_authenticated/carteiras/")({
  head: () => ({ meta: [{ title: "Feeds XML — MV Broker" }] }),
  component: FeedsXmlPage,
});

function FeedsXmlPage() {
  const fnGeral = useServerFn(getFeedGeralInfo);
  const fnPersonalizado = useServerFn(getFeedPersonalizado);

  const [geral, setGeral] = useState<{ id: string; escopo: string; nome: string | null } | null>(null);
  const [personalizado, setPersonalizado] = useState<{ id: string; slug: string; nome: string; total_imoveis: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [g, p] = await Promise.all([fnGeral().catch(() => null), fnPersonalizado().catch(() => null)]);
        setGeral(g);
        setPersonalizado(p as any);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const geralUrl = geral ? `${origin}/api/public/feed/geral/${geral.id}.xml` : "";
  const personalizadoUrl = personalizado ? `${origin}/api/public/feed/${personalizado.slug}.xml` : "";

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada");
  }

  return (
    <>
      <PageHeader
        title="Feeds XML"
        description="Distribua seus imóveis para portais e parceiros via XML."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-4">
          {/* Feed Geral */}
          {geral && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Rss className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">Feed Geral</h3>
                      <Badge variant="secondary">Automático</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Todos os imóveis do sistema. Automático — não precisa marcar nada.
                    </p>
                  </div>
                </div>
                <code className="block rounded bg-background border px-3 py-2 text-[11px] font-mono break-all">{geralUrl}</code>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(geralUrl)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />Copiar URL
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={geralUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir
                    </a>
                  </Button>
                  <DownloadXmlButton url={geralUrl} filename="feed-geral.xml" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feed Fotos */}
          <FeedFixoCard
            icon={<ImageIcon className="h-5 w-5 text-sky-500" />}
            title="XML Fotos"
            description="Somente imóveis marcados neste feed (no cadastro ou pelo atalho no card)."
            url={`${origin}/api/public/feed/fotos.xml`}
            filename="feed-fotos.xml"
            onCopy={copy}
          />

          {/* Feed Casa em Condomínio */}
          <FeedFixoCard
            icon={<Home className="h-5 w-5 text-emerald-600" />}
            title="XML Casa em Condomínio"
            description="Somente imóveis marcados neste feed (no cadastro ou pelo atalho no card)."
            url={`${origin}/api/public/feed/casa-condominio.xml`}
            filename="feed-casa-condominio.xml"
            onCopy={copy}
          />

          {/* Feed Vista para o Mar */}
          <FeedFixoCard
            icon={<Rss className="h-5 w-5 text-blue-500" />}
            title="XML Vista para o Mar"
            description="Somente imóveis marcados neste feed (no cadastro ou pelo atalho no card)."
            url={`${origin}/api/public/feed/vista-mar.xml`}
            filename="feed-vista-mar.xml"
            onCopy={copy}
          />

          {/* Montar meu XML */}
          <FeedFiltroCard />



          {/* Feed Personalizado */}
          {personalizado && (
            <Card className="border-amber-400/40 bg-amber-500/5">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2">
                    <Star className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">Feed Personalizado</h3>
                      <Badge variant="secondary">{personalizado.total_imoveis} imóveis</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Seleção manual de imóveis. Você escolhe quais entram no XML.
                    </p>
                  </div>
                </div>
                <code className="block rounded bg-background border px-3 py-2 text-[11px] font-mono break-all">{personalizadoUrl}</code>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(personalizadoUrl)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />Copiar URL
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={personalizadoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir
                    </a>
                  </Button>
                  <DownloadXmlButton url={personalizadoUrl} filename="feed-personalizado.xml" />
                  <Button size="sm" asChild className="ml-auto">
                    <Link to="/imoveis">
                      Gerenciar imóveis <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="pt-1 border-t border-amber-500/20 mt-2">
                  <p className="text-[11px] text-muted-foreground">
                    💡 Você pode adicionar imóveis aqui, ou marcando o switch <strong>📡 Feed Personalizado</strong> ao editar cada imóvel.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function FeedFixoCard({
  icon,
  title,
  description,
  url,
  filename,
  onCopy,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  url: string;
  filename: string;
  onCopy: (url: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{title}</h3>
              <Badge variant="secondary">Automático</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <code className="block rounded bg-background border px-3 py-2 text-[11px] font-mono break-all">{url}</code>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onCopy(url)}>
            <Copy className="h-3.5 w-3.5 mr-1" />Copiar URL
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir
            </a>
          </Button>
          <DownloadXmlButton url={url} filename={filename} />
        </div>
      </CardContent>
    </Card>
  );
}

