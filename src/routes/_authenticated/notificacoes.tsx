import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNotifications, type NotifCategoria } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificacoesPage,
});

const FILTROS: { key: "todas" | "nao_lidas" | NotifCategoria; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "nao_lidas", label: "Não lidas" },
  { key: "imoveis", label: "Imóveis" },
  { key: "xml", label: "XML" },
  { key: "portais", label: "Portais" },
  { key: "sistema", label: "Sistema" },
];

function NotificacoesPage() {
  const navigate = useNavigate();
  const { items, unread, marcarLida, marcarTodasLidas, excluir } = useNotifications(200);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("todas");

  const filtered = useMemo(() => {
    if (filtro === "todas") return items;
    if (filtro === "nao_lidas") return items.filter((n) => !n.lida);
    return items.filter((n) => n.categoria === filtro);
  }, [items, filtro]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        description={`${unread} não lidas`}
        actions={
          <Button variant="outline" size="sm" onClick={() => marcarTodasLidas()}>
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        }
      />

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
        <TabsList className="flex flex-wrap h-auto">
          {FILTROS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={filtro} className="mt-4">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              Nenhuma notificação.
            </div>
          ) : (
            <div className="rounded-lg border divide-y bg-card">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-4 transition-colors",
                    !n.lida && "bg-primary/5",
                  )}
                >
                  <div className={cn("mt-1 h-2 w-2 rounded-full shrink-0", n.lida ? "bg-muted" : "bg-primary")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{n.titulo}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">{n.categoria}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.mensagem}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.link && (
                      <Button variant="ghost" size="icon" onClick={() => navigate({ to: n.link! })}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {!n.lida && (
                      <Button variant="ghost" size="icon" onClick={() => marcarLida(n.id)} title="Marcar como lida">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => excluir(n.id)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
