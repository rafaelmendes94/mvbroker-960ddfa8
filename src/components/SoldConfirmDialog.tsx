import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  "WhatsApp",
  "Instagram",
  "Site MV",
  "ZAP Imóveis",
  "VivaReal",
  "Imovelweb",
  "Indicação",
  "Balcão",
  "OLX",
  "Facebook",
  "Outro",
] as const;

export type SoldConfirmPayload = { platform: string; saleDate: string };

interface Props {
  open: boolean;
  propertyTitle: string;
  defaultDate?: string;
  onConfirm: (payload: SoldConfirmPayload) => void;
  onCancel: () => void;
}

export function SoldConfirmDialog({ open, propertyTitle, defaultDate, onConfirm, onCancel }: Props) {
  const [saleDate, setSaleDate] = useState<string>(
    defaultDate || new Date().toISOString().slice(0, 10)
  );

  const handleConfirm = () => {
    onConfirm({ platform: "Balcão", saleDate });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Confirmar venda do imóvel
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-semibold text-foreground">{propertyTitle}</span> será marcado como
            <span className="font-semibold text-emerald-600"> Vendido</span> e enviado automaticamente ao Relatório de Vendas com o valor, corretor e data atuais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold mb-2 block">Data da venda</Label>
            <Input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>


        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!saleDate}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar venda
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
