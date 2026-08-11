import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Rss } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listFeedsDoImovel,
  toggleImovelNoFeed,
  criarFeedNoEscopo,
} from "@/lib/feeds-imovel.functions";

type Feed = { id: string; nome: string; slug: string; checked: boolean };

/** Botão no card do imóvel: marca em quais feeds XML o imóvel está. */
export function XmlFeedsButton({ imovelId, className }: { imovelId: string; className?: string }) {
  const fnList = useServerFn(listFeedsDoImovel);
  const fnToggle = useServerFn(toggleImovelNoFeed);
  const fnCreate = useServerFn(criarFeedNoEscopo);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [escopo, setEscopo] = useState<"equipe" | "privada">("privada");
  const [novo, setNovo] = useState("");
  const [criando, setCriando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const res = await fnList({ data: { imovel_id: imovelId } });
      setFeeds(res.feeds as Feed[]);
      setEscopo(res.escopo);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar os feeds XML.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(f: Feed) {
    setBusy(f.id);
    const incluir = !f.checked;
    setFeeds((prev) => prev.map((x) => (x.id === f.id ? { ...x, checked: incluir } : x)));
    try {
      await fnToggle({ data: { carteira_id: f.id, imovel_id: imovelId, incluir } });
      toast.success(incluir ? `Incluído em "${f.nome}"` : `Removido de "${f.nome}"`);
    } catch (e: any) {
      setFeeds((prev) => prev.map((x) => (x.id === f.id ? { ...x, checked: !incluir } : x)));
      toast.error(e?.message ?? "Não foi possível atualizar o feed.");
    } finally {
      setBusy(null);
    }
  }

  async function criar() {
    if (novo.trim().length < 2) return;
    setCriando(true);
    try {
      const c = await fnCreate({ data: { nome: novo.trim() } });
      setNovo("");
      setFeeds((prev) => [...prev, { id: c.id, nome: c.nome, slug: c.slug, checked: false }]);
      toast.success("Feed XML criado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar o feed.");
    } finally {
      setCriando(false);
    }
  }

  const marcados = feeds.filter((f) => f.checked).length;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void carregar();
      }}
    >
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          title="Feeds XML deste imóvel"
          className={cn(
            "relative w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors",
            className,
          )}
        >
          <Rss className="w-3.5 h-3.5 text-foreground" />
          {marcados > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {marcados}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-semibold text-foreground">Feeds XML</div>
        <div className="text-[11px] text-muted-foreground mb-2">
          {escopo === "equipe" ? "Feeds da equipe (compartilhados)" : "Seus feeds pessoais"}
        </div>

        {loading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {feeds.length === 0 && (
              <div className="text-[11px] text-muted-foreground py-2">
                Nenhum feed ainda. Crie o primeiro abaixo.
              </div>
            )}
            {feeds.map((f) => (
              <label
                key={f.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={f.checked}
                  disabled={busy === f.id}
                  onCheckedChange={() => void toggle(f)}
                />
                <span className="text-xs truncate">{f.nome}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Novo feed XML"
            maxLength={80}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void criar();
              }
            }}
          />
          <Button size="sm" className="h-8 px-2" disabled={criando} onClick={() => void criar()}>
            {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
