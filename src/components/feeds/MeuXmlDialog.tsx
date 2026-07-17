import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Loader2, Search, Rss } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ensureMinhaCarteiraXml,
  listCarteiraItems,
  addCarteiraItems,
  removeCarteiraItems,
} from "@/lib/carteiras.functions";
import { DownloadXmlButton } from "@/components/feeds/DownloadXmlButton";

type PropLike = {
  id: string;
  codigo_interno?: string | null;
  titulo?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  preco?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropLike[];
};

export function MeuXmlDialog({ open, onOpenChange, properties }: Props) {
  const fnEnsure = useServerFn(ensureMinhaCarteiraXml);
  const fnList = useServerFn(listCarteiraItems);
  const fnAdd = useServerFn(addCarteiraItems);
  const fnRemove = useServerFn(removeCarteiraItems);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [carteira, setCarteira] = useState<{ id: string; slug: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const c = await fnEnsure();
        setCarteira({ id: c.id, slug: c.slug });
        const items = await fnList({ data: { carteira_id: c.id } });
        const ids = new Set((items ?? []).map((i: any) => i.imovel_id));
        setSelected(new Set(ids));
        setInitial(new Set(ids));
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao carregar Meu XML");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const feedUrl = useMemo(
    () => (carteira ? `${window.location.origin}/api/public/feed/${carteira.slug}.xml` : ""),
    [carteira],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.codigo_interno, p.titulo, p.cidade, p.bairro]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [properties, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const clearAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((p) => next.delete(p.id));
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const id of selected) if (!initial.has(id)) return true;
    return false;
  }, [selected, initial]);

  const save = async () => {
    if (!carteira) return;
    setSaving(true);
    try {
      const toAdd: string[] = [];
      const toRemove: string[] = [];
      for (const id of selected) if (!initial.has(id)) toAdd.push(id);
      for (const id of initial) if (!selected.has(id)) toRemove.push(id);
      if (toAdd.length) await fnAdd({ data: { carteira_id: carteira.id, imovel_ids: toAdd } });
      if (toRemove.length) await fnRemove({ data: { carteira_id: carteira.id, imovel_ids: toRemove } });
      setInitial(new Set(selected));
      toast.success("Meu XML atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    toast.success("URL copiada");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rss className="w-5 h-5" /> Meu XML
          </DialogTitle>
        </DialogHeader>

        {loading || !carteira ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Seu link exclusivo</div>
              <div className="flex items-center gap-2">
                <Input value={feedUrl} readOnly className="text-xs font-mono" />
                <Button size="sm" variant="outline" onClick={copyUrl} title="Copiar URL">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(feedUrl, "_blank")} title="Abrir XML">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
                <DownloadXmlButton url={feedUrl} filename={`${carteira.slug}.xml`} label="Baixar" />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Esta URL é sua e contém apenas os imóveis que você selecionar abaixo.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por código, título, cidade..."
                  className="pl-8"
                />
              </div>
              <Button size="sm" variant="outline" onClick={selectAllFiltered}>Marcar todos</Button>
              <Button size="sm" variant="outline" onClick={clearAllFiltered}>Desmarcar</Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {selected.size} selecionado(s) · {filtered.length} listado(s)
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
              {filtered.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {p.codigo_interno ? <span className="text-muted-foreground mr-2">{p.codigo_interno}</span> : null}
                        {p.titulo ?? "Sem título"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[p.bairro, p.cidade].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum imóvel encontrado</div>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={save} disabled={!dirty || saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Salvar seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
