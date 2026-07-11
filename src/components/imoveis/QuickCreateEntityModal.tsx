import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { EntityOption } from "@/components/imoveis/EntitySelector";

type Table = "edificios" | "condominios" | "loteamentos";

const LABELS: Record<Table, string> = {
  edificios: "Edifício",
  condominios: "Condomínio",
  loteamentos: "Loteamento",
};

export function QuickCreateEntityModal({
  open,
  onClose,
  table,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  table: Table;
  initialName?: string;
  onCreated: (entity: EntityOption) => void;
}) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initialName);
      setCidade("");
      setEstado("");
    }
  }, [open, initialName]);

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setSaving(true);
    const payload: any = {
      nome: nome.trim(),
      cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase() || null,
      ativo: true,
    };
    const { data, error } = await supabase
      .from(table as any)
      .insert(payload)
      .select("id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, infraestrutura")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${LABELS[table]} criado`);
    onCreated(data as any);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo {LABELS[table]}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={estado} maxLength={2} onChange={(e) => setEstado(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Você pode completar os demais dados depois na tela de {LABELS[table]}s.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
