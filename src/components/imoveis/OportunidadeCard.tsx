import { Link } from "@tanstack/react-router";
import { ImageIcon, MapPin, BedDouble, Bath, Car, Scan, Maximize2, Waves, Paintbrush } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OportunidadeImovel = {
  id: string;
  codigo_interno: string | null;
  titulo: string | null;
  cidade: string | null;
  bairro: string | null;
  preco: number | null;
  bonus?: string | null;
  vista_mar?: boolean | null;
  decorado?: boolean | null;
  dormitorios?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  area_privativa?: number | null;
  area_total?: number | null;
  capa?: string | null;
};

const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function OportunidadeCard({
  im,
  badge,
  mostraBonus,
  to = "/imoveis/$id/editar",
}: {
  im: OportunidadeImovel;
  badge?: { label: string; className: string };
  mostraBonus?: boolean;
  to?: "/imoveis/$id/editar" | "/imovel/$id";
}) {
  const endereco = [im.bairro, im.cidade].filter(Boolean).join(", ");
  return (
    <Link
      to={to}
      params={{ id: im.id }}
      className="elevated-card rounded-xl overflow-hidden relative transition-all duration-300 group/card border bg-card block"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {im.capa ? (
          <img
            src={im.capa}
            alt={im.titulo ?? "Imóvel"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {im.codigo_interno && (
          <span className="absolute left-3 top-3 z-20 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {im.codigo_interno}
          </span>
        )}

        {badge && (
          <span className={cn("absolute right-3 top-3 z-20 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase text-white", badge.className)}>
            {badge.label}
          </span>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-end">
          <div className="flex gap-1">
            {im.vista_mar && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/90 text-white backdrop-blur-sm flex items-center gap-0.5">
                <Waves className="w-2.5 h-2.5" /> Mar
              </span>
            )}
            {im.decorado && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/90 text-white backdrop-blur-sm flex items-center gap-0.5">
                <Paintbrush className="w-2.5 h-2.5" /> Dec.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xl font-bold text-foreground">{fmtBRL(im.preco)}</p>
          <h3 className="font-semibold text-card-foreground text-sm uppercase mt-1 line-clamp-2">
            {im.titulo ?? "Sem título"}
          </h3>
          {endereco && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground line-clamp-1">{endereco}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-y border-border">
          {im.dormitorios ? (
            <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {im.dormitorios}</span>
          ) : null}
          {im.banheiros ? (
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {im.banheiros}</span>
          ) : null}
          {im.vagas ? (
            <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {im.vagas}</span>
          ) : null}
          {im.area_total ? (
            <span className="flex items-center gap-1"><Scan className="w-3.5 h-3.5" /> {Number(im.area_total)}m² t.</span>
          ) : null}
          {im.area_privativa ? (
            <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> {Number(im.area_privativa)}m² p.</span>
          ) : null}
        </div>

        {mostraBonus && im.bonus && (
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
            +{im.bonus}
          </Badge>
        )}
      </div>
    </Link>
  );
}
