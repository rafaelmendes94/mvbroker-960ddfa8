import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { extrairImovelDeTexto, type CamposExtraidos } from "@/lib/imovel-ia-extract.functions";

export function CadastroIAModal({
  open,
  onClose,
  onExtracted,
}: {
  open: boolean;
  onClose: () => void;
  onExtracted: (campos: CamposExtraidos) => void;
}) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const extrair = useServerFn(extrairImovelDeTexto);

  async function handleAnalisar() {
    if (texto.trim().length < 10) {
      toast.error("Cole uma descrição mais completa.");
      return;
    }
    setLoading(true);
    try {
      const { campos } = await extrair({ data: { texto } });
      onExtracted(campos);
      toast.success("Dados preenchidos pela IA. Revise antes de salvar.");
      setTexto("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao analisar descrição");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" /> Cadastrar por IA
          </DialogTitle>
          <DialogDescription>
            Cole a descrição bruta do imóvel (WhatsApp, e-mail, ficha do proprietário). A IA vai extrair os campos e preencher o formulário para você revisar.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={14}
          placeholder={`Ex.:
Rio Tevere 303 box 26
R$ 1.250.000,00
Paga 4% comissão

2 dorm sendo 1 suíte, banheiro social, mobiliado e decorado
Sacada frente beira mar — 75,05 m² privativos / 109,50 m² total
1 vaga de garagem

Edifício: hall decorado, elevador, piscina, beira mar
Capão da Canoa — Zona Nova — Av. Beira Mar, 1301

Proprietário: Júlio 51 98022-8125
Tag Lux Group central/sepe — Senha 1745`}
          disabled={loading}
          className="font-mono text-xs"
        />

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleAnalisar} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? "Analisando..." : "Analisar com IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
