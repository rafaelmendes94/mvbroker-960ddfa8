import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Definir nova senha — MV Broker" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase coloca o token de recovery/invite no hash da URL e dispara PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salvar() {
    if (nova.length < 8) return toast.error("Mínimo de 8 caracteres.");
    if (nova !== conf) return toast.error("As senhas não coincidem.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha definida! Você já está conectado.");
    navigate({ to: "/dashboard" }).catch(() => navigate({ to: "/" }));
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Definir nova senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ready ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando link...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Confirmar nova senha</Label>
                <Input type="password" value={conf} onChange={(e) => setConf(e.target.value)} />
              </div>
              <Button className="w-full" onClick={salvar} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova senha
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
