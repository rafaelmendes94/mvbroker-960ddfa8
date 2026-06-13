import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Settings2, ArrowRight, MessageCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { IntegracoesCard } from "@/components/configuracoes/IntegracoesCard";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — MV Broker" }] }),
  component: Configuracoes,
});

function WhatsAppConfigCard() {
  const { isSuperAdmin } = useAuth();
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_options")
        .select("nome")
        .eq("categoria", "contato")
        .eq("slug", "whatsapp_comercial")
        .maybeSingle();
      setWhatsapp(data?.nome ?? "");
      setLoading(false);
    })();
  }, []);

  async function salvar() {
    const limpo = whatsapp.replace(/\D/g, "");
    if (limpo.length < 10) {
      toast.error("Informe um número válido (somente dígitos, com DDD).");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("system_options")
      .upsert(
        { categoria: "contato", slug: "whatsapp_comercial", nome: limpo, ativo: true, ordem: 1 },
        { onConflict: "categoria,slug" }
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWhatsapp(limpo);
    toast.success("WhatsApp comercial atualizado");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          WhatsApp Comercial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Número (com DDI + DDD, somente dígitos)</Label>
          <Input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Ex.: 5551999999999"
            disabled={loading || !isSuperAdmin}
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            Este é o número usado nos botões de contato e nos planos da página inicial.
          </p>
        </div>
        {whatsapp && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <span className="text-muted-foreground">Pré-visualização: </span>
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://wa.me/{whatsapp.replace(/\D/g, "")}
            </a>
          </div>
        )}
        <Separator />
        <Button onClick={salvar} disabled={saving || loading || !isSuperAdmin}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar WhatsApp
        </Button>
        {!isSuperAdmin && (
          <p className="text-xs text-muted-foreground">
            Apenas super administradores podem alterar este número.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Configuracoes() {
  return (
    <>
      <PageHeader title="Configurações" description="Personalize sua experiência na plataforma." />

      <Link
        to="/configuracoes/opcoes"
        className="block mb-4 group"
      >
        <Card className="border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Settings2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">Opções do Sistema</div>
              <p className="text-xs text-muted-foreground">Gerencie listas dinâmicas usadas em formulários: tipos, status, infraestrutura e mais.</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Organização</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Nome da empresa</Label><Input defaultValue="MV Broker Ltda." /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input defaultValue="00.000.000/0001-00" /></div>
            <div className="space-y-2"><Label>E-mail de contato</Label><Input type="email" defaultValue="contato@mvbroker.com" /></div>
          </CardContent>
        </Card>

        <WhatsAppConfigCard />

        <Card>
          <CardHeader><CardTitle className="text-base">Preferências</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Notificações por e-mail", "Receba atualizações importantes."],
              ["Resumo semanal", "Relatório consolidado toda segunda-feira."],
              ["Modo compacto", "Reduzir espaçamento das listas."],
            ].map(([t, d]) => (
              <div key={t} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{t}</div>
                  <div className="text-xs text-muted-foreground">{d}</div>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
            <Separator />
            <Button><Save className="h-4 w-4" /> Salvar alterações</Button>
          </CardContent>
        </Card>

        <IntegracoesCard />
      </div>

    </>
  );
}
