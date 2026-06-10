import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { NotifTipo } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_authenticated/configuracoes/notificacoes")({
  component: PreferenciasPage,
});

const TIPO_LABEL: Record<NotifTipo, string> = {
  novo_imovel: "Novo imóvel cadastrado",
  imovel_atualizado: "Imóvel atualizado",
  novo_exclusivo: "Novo imóvel exclusivo",
  novo_bonus: "Imóvel com bônus",
  xml_atualizado: "XML atualizado",
  erro_xml: "Erro no XML",
  publicacao_aprovada: "Publicação aprovada",
  publicacao_rejeitada: "Publicação rejeitada",
  sistema: "Sistema",
};

type Pref = {
  tipo: NotifTipo;
  canal_sistema: boolean;
  canal_email: boolean;
  canal_whatsapp: boolean;
  canal_push: boolean;
};

function PreferenciasPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_preferencias_notificacao");
      setPrefs((data ?? []) as Pref[]);
      setLoading(false);
    })();
  }, []);

  async function atualiza(tipo: NotifTipo, canal: keyof Pref, valor: boolean) {
    if (!user) return;
    setPrefs((p) => p.map((x) => (x.tipo === tipo ? { ...x, [canal]: valor } : x)));
    const current = prefs.find((p) => p.tipo === tipo);
    const payload = {
      usuario_id: user.id,
      tipo,
      canal_sistema: current?.canal_sistema ?? true,
      canal_email: current?.canal_email ?? false,
      canal_whatsapp: current?.canal_whatsapp ?? false,
      canal_push: current?.canal_push ?? false,
      [canal]: valor,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("notification_preferences") as any)
      .upsert(payload, { onConflict: "usuario_id,tipo" });
    if (error) toast.error("Erro ao salvar preferência");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preferências de Notificação"
        description="Escolha como você quer ser avisado para cada tipo de evento."
      />

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Evento</th>
                <th className="p-3">Sistema</th>
                <th className="p-3">E-mail</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Push</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {prefs.map((p) => (
                <tr key={p.tipo}>
                  <td className="p-3 font-medium">{TIPO_LABEL[p.tipo]}</td>
                  <td className="p-3 text-center">
                    <Switch checked={p.canal_sistema} onCheckedChange={(v) => atualiza(p.tipo, "canal_sistema", v)} />
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={p.canal_email} onCheckedChange={(v) => atualiza(p.tipo, "canal_email", v)} />
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch checked={p.canal_whatsapp} onCheckedChange={(v) => atualiza(p.tipo, "canal_whatsapp", v)} disabled />
                      <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch checked={p.canal_push} onCheckedChange={(v) => atualiza(p.tipo, "canal_push", v)} disabled />
                      <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
