import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImovelPreview = {
  found: boolean;
  titulo: string;
  descricao: string;
  image: string | null;
  url: string;
};

/**
 * Metadados públicos (SSR) usados para o preview de compartilhamento
 * (WhatsApp, Facebook, etc). Não exige login.
 */
export const getImovelPreview = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data }): Promise<ImovelPreview> => {
    const req = getRequest();
    const url = new URL(req.url);
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = isLocal
      ? req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")
      : "https";
    const origin = `${proto}://${host}`;
    const pageUrl = `${origin}/imovel/${data.id}`;

    const empty: ImovelPreview = {
      found: false,
      titulo: "Imóvel — MV BROKER",
      descricao: "Confira os detalhes deste imóvel.",
      image: null,
      url: pageUrl,
    };
    if (!UUID_RE.test(data.id)) return empty;

    try {
      const { getFeedSupabase } = await import("@/lib/feed-supabase.server");
      const { client } = getFeedSupabase();
      if (!client) return empty;

      const { data: im } = await client
        .from("imoveis")
        .select(
          "titulo, preco, cidade, bairro, dormitorios, banheiros, vagas, area_privativa, area_total, tipo_imovel, arquivado",
        )
        .eq("id", data.id)
        .maybeSingle();

      if (!im || (im as any).arquivado) return empty;

      const { data: img } = await client
        .from("imovel_imagens")
        .select("storage_path, url")
        .eq("imovel_id", data.id)
        .order("capa", { ascending: false })
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();

      const path = (img as any)?.storage_path || (img as any)?.url || null;
      const image = path
        ? String(path).startsWith("http")
          ? String(path)
          : `${origin}/api/public/img/imoveis/${String(path).split("/").map(encodeURIComponent).join("/")}`
        : null;

      const preco =
        (im as any).preco != null
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            }).format(Number((im as any).preco))
          : "Sob consulta";

      const local = [(im as any).bairro, (im as any).cidade].filter(Boolean).join(", ");
      const specs = [
        (im as any).dormitorios ? `${(im as any).dormitorios} dorm.` : null,
        (im as any).banheiros ? `${(im as any).banheiros} banh.` : null,
        (im as any).vagas ? `${(im as any).vagas} vaga(s)` : null,
        (im as any).area_privativa || (im as any).area_total
          ? `${(im as any).area_privativa || (im as any).area_total} m²`
          : null,
      ]
        .filter(Boolean)
        .join(" • ");

      const titulo = `${(im as any).titulo || (im as any).tipo_imovel || "Imóvel"}${local ? ` — ${local}` : ""}`;
      const descricao = [preco, specs].filter(Boolean).join(" | ");

      return { found: true, titulo, descricao, image, url: pageUrl };
    } catch {
      return empty;
    }
  });
