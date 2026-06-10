import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AlterarSenhaCard() {
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (nova.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (nova !== conf) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso");
    setNova("");
    setConf("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Segurança
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <Input
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label>Confirmar nova senha</Label>
          <Input
            type="password"
            value={conf}
            onChange={(e) => setConf(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end pt-2">
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Atualizar senha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
