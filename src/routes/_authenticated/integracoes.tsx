import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, RefreshCw, Trash2, Webhook } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createApiKey, createWebhook, deleteApiKey, deleteWebhook, listApiKeys,
  listWebhookDeliveries, listWebhooks, setApiKeyActive, setWebhookActive, testWebhook,
} from "@/lib/integracoes.functions";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações e API — MV Broker" },
      { name: "description", content: "Gerencie chaves de API, webhooks e a documentação da API MV Broker." },
      { property: "og:title", content: "Integrações e API — MV Broker" },
      { property: "og:description", content: "Chaves de API, webhooks e documentação para integrar o MV Broker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegracoesPage,
});

const SCOPES = [
  "developments:read", "developments:write",
  "typologies:read", "typologies:write",
  "units:read", "units:write",
  "offers:read", "offers:write",
];

const EVENTS = [
  "development.created", "development.updated",
  "unit.created", "unit.updated", "unit.status_changed",
  "offer.created", "offer.updated", "offer.price_changed",
];

function copy(value: string) {
  navigator.clipboard.writeText(value);
  toast.success("Copiado para a área de transferência");
}

function IntegracoesPage() {
  return (
    <RoleGate allow={["super_admin", "imobiliaria"]}>
      <PageHeader title="Integrações e API" description="Chaves de acesso, webhooks e documentação da API MV Broker." />
      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys"><KeyRound className="mr-2 h-4 w-4" />Chaves de API</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="mr-2 h-4 w-4" />Webhooks</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
        </TabsList>
        <TabsContent value="keys"><ApiKeysTab /></TabsContent>
        <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
        <TabsContent value="docs"><DocsTab /></TabsContent>
      </Tabs>
    </RoleGate>
  );
}

function ApiKeysTab() {
  const qc = useQueryClient();
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const toggle = useServerFn(setApiKeyActive);
  const remove = useServerFn(deleteApiKey);

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["developments:read", "typologies:read", "units:read", "offers:read"]);
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: () => list() });

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, permissions: scopes } }),
    onSuccess: (row: any) => {
      setNewKey(row.key);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Chave criada — copie agora, ela não será exibida novamente.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar chave"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova chave</CardTitle>
          <CardDescription>Use em integrações externas com o header <code>Authorization: Bearer &lt;chave&gt;</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="key-name">Nome</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Portal VivaReal" />
          </div>
          <div className="grid gap-2">
            <Label>Permissões</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(s)}
                    onCheckedChange={(v) => setScopes((prev) => (v ? [...prev, s] : prev.filter((x) => x !== s)))}
                  />
                  <span className="truncate">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
            <Plus className="mr-2 h-4 w-4" />Criar chave
          </Button>

          {newKey && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <p className="mb-2 text-sm font-medium">Copie a chave agora — ela não será exibida novamente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 text-xs">{newKey}</code>
                <Button size="icon" variant="outline" onClick={() => copy(newKey)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Chaves ativas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && keys.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma chave criada.</p>}
          {keys.map((k: any) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{k.key_prefix}…</code> · {k.permissions?.length ?? 0} permissões ·{" "}
                  {k.last_used_at ? `último uso ${new Date(k.last_used_at).toLocaleString("pt-BR")}` : "nunca usada"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={k.active ? "default" : "secondary"}>{k.active ? "Ativa" : "Inativa"}</Badge>
                <Switch
                  checked={k.active}
                  onCheckedChange={async (v) => {
                    await toggle({ data: { id: k.id, active: v } });
                    qc.invalidateQueries({ queryKey: ["api-keys"] });
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await remove({ data: { id: k.id } });
                    qc.invalidateQueries({ queryKey: ["api-keys"] });
                    toast.success("Chave removida");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function WebhooksTab() {
  const qc = useQueryClient();
  const list = useServerFn(listWebhooks);
  const create = useServerFn(createWebhook);
  const toggle = useServerFn(setWebhookActive);
  const remove = useServerFn(deleteWebhook);
  const test = useServerFn(testWebhook);
  const deliveries = useServerFn(listWebhookDeliveries);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["offer.price_changed", "unit.status_changed"]);
  const [openLogs, setOpenLogs] = useState<string | null>(null);

  const { data: hooks = [] } = useQuery({ queryKey: ["webhooks"], queryFn: () => list() });
  const { data: logs = [] } = useQuery({
    queryKey: ["webhook-deliveries", openLogs],
    queryFn: () => deliveries({ data: { webhook_id: openLogs! } }),
    enabled: !!openLogs,
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, url, events } }),
    onSuccess: () => {
      setName(""); setUrl("");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook criado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar webhook"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo webhook</CardTitle>
          <CardDescription>Enviamos um POST assinado com <code>X-MVB-Signature</code> (HMAC-SHA256 do corpo).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="wh-name">Nome</Label>
              <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: CRM do parceiro" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wh-url">URL de destino</Label>
              <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Eventos</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={events.includes(ev)}
                    onCheckedChange={(v) => setEvents((prev) => (v ? [...prev, ev] : prev.filter((x) => x !== ev)))}
                  />
                  <span className="truncate">{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            <Plus className="mr-2 h-4 w-4" />Criar webhook
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Webhooks configurados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {hooks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>}
          {hooks.map((w: any) => (
            <div key={w.id} className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{w.url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{(w.events ?? []).join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={w.active ? "default" : "secondary"}>{w.active ? "Ativo" : "Inativo"}</Badge>
                  <Switch
                    checked={w.active}
                    onCheckedChange={async (v) => {
                      await toggle({ data: { id: w.id, active: v } });
                      qc.invalidateQueries({ queryKey: ["webhooks"] });
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => copy(w.secret)}>Copiar segredo</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await test({ data: { id: w.id } });
                      qc.invalidateQueries({ queryKey: ["webhook-deliveries", w.id] });
                      toast.success("Teste enviado");
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />Testar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpenLogs(openLogs === w.id ? null : w.id)}>
                    {openLogs === w.id ? "Ocultar entregas" : "Ver entregas"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await remove({ data: { id: w.id } });
                      qc.invalidateQueries({ queryKey: ["webhooks"] });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {openLogs === w.id && (
                <div className="space-y-1 border-t pt-2 text-xs">
                  {logs.length === 0 && <p className="text-muted-foreground">Nenhuma entrega registrada.</p>}
                  {logs.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{d.event}</span>
                      <span className="text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                      <Badge variant={d.status === "success" ? "default" : "destructive"}>
                        {d.response_status ?? d.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DocsTab() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const specUrl = useMemo(() => `${origin}/api/public/v1/openapi.json`, [origin]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentação da API v1</CardTitle>
        <CardDescription>Estrutura: Empreendimento → Tipologia → Unidade → Oferta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="font-medium">Base URLs</p>
          <code className="block rounded bg-muted px-2 py-1 text-xs">{origin}/api/v1 — uso interno (app web/mobile)</code>
          <code className="block rounded bg-muted px-2 py-1 text-xs">{origin}/api/public/v1 — integrações externas</code>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Autenticação</p>
          <code className="block rounded bg-muted px-2 py-1 text-xs">Authorization: Bearer &lt;API Key ou JWT&gt;</code>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Exemplo</p>
          <code className="block overflow-x-auto rounded bg-muted px-2 py-1 text-xs">
            curl -H "Authorization: Bearer mvb_live_..." "{origin}/api/public/v1/properties?city=Torres&amp;bedrooms=2"
          </code>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(specUrl)}>Copiar URL do OpenAPI</Button>
          <a className="text-xs text-primary underline" href={specUrl} target="_blank" rel="noreferrer">Abrir openapi.json</a>
        </div>
      </CardContent>
    </Card>
  );
}
