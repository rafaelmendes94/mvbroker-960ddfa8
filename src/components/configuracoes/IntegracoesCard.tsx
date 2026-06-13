import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound, Eye, EyeOff, MapPin, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";

type Row = { key: string; value: string | null };

const KEYS = [
  "google_maps_api_key",
  "gemini_api_key",
  "resend_api_key",
  "resend_from_email",
  "resend_from_name",
] as const;
type IntegrationKey = (typeof KEYS)[number];

function SecretInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className="pr-10 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function IntegracoesCard() {
  const { roles, loading: rolesLoading } = useRoles();
  const isSuperAdmin = roles.includes("super_admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<IntegrationKey, string>>({
    google_maps_api_key: "",
    gemini_api_key: "",
    resend_api_key: "",
    resend_from_email: "",
    resend_from_name: "",
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("integration_settings" as any)
        .select("key,value");
      if (error) {
        // Provavelmente usuário sem permissão de leitura
        setLoading(false);
        return;
      }
      const next = { ...values };
      (data as unknown as Row[] | null)?.forEach((r) => {
        if ((KEYS as readonly string[]).includes(r.key)) {
          next[r.key as IntegrationKey] = r.value ?? "";
        }
      });
      setValues(next);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(k: IntegrationKey, v: string) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function salvar() {
    setSaving(true);
    const rows = KEYS.map((k) => ({ key: k, value: values[k]?.trim() || null }));
    const { error } = await supabase
      .from("integration_settings" as any)
      .upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Integrações atualizadas");
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Integrações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Apenas super administradores podem gerenciar chaves de integração.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Integrações & Chaves de API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Google Maps */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" /> Google Maps
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmaps">API Key (Browser / Maps JavaScript API)</Label>
            <SecretInput
              id="gmaps"
              value={values.google_maps_api_key}
              onChange={(v) => set("google_maps_api_key", v)}
              disabled={loading}
              placeholder="AIza..."
            />
            <p className="text-xs text-muted-foreground">
              Use uma chave restrita por referrer aos seus domínios. Habilite: Maps
              JavaScript API, Places API (New) e Geocoding API.
            </p>
          </div>
        </section>

        <Separator />

        {/* Gemini */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Google Gemini (IA)
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini">API Key</Label>
            <SecretInput
              id="gemini"
              value={values.gemini_api_key}
              onChange={(v) => set("gemini_api_key", v)}
              disabled={loading}
              placeholder="AIza..."
            />
            <p className="text-xs text-muted-foreground">
              Gere em{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                aistudio.google.com/app/apikey
              </a>
              . Será usada como fallback quando o módulo de IA precisar.
            </p>
          </div>
        </section>

        <Separator />

        {/* Resend (SMTP / Email) */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4 text-primary" /> Resend (envio de e-mails)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="resend">API Key</Label>
              <SecretInput
                id="resend"
                value={values.resend_api_key}
                onChange={(v) => set("resend_api_key", v)}
                disabled={loading}
                placeholder="re_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-from">Remetente (e-mail)</Label>
              <Input
                id="resend-from"
                type="email"
                value={values.resend_from_email}
                onChange={(e) => set("resend_from_email", e.target.value)}
                disabled={loading}
                placeholder="contato@seudominio.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-name">Nome do remetente</Label>
              <Input
                id="resend-name"
                value={values.resend_from_name}
                onChange={(e) => set("resend_from_name", e.target.value)}
                disabled={loading}
                placeholder="MV Broker"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Crie a chave em{" "}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              resend.com/api-keys
            </a>{" "}
            e verifique seu domínio em{" "}
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              resend.com/domains
            </a>{" "}
            antes de enviar com um remetente próprio.
          </p>
        </section>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            As chaves ficam armazenadas no banco do sistema e só são visíveis ao
            super administrador.
          </p>
          <Button onClick={salvar} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar integrações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
