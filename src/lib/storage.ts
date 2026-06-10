import { supabase } from "@/integrations/supabase/client";

export const CATEGORIAS = [
  { key: "fotos", label: "Fotos", bucket: "imoveis", publico: false },
  { key: "documentos", label: "Documentos", bucket: "documentos", publico: false },
  { key: "contratos", label: "Contratos", bucket: "documentos", publico: false },
  { key: "exclusividades", label: "Exclusividades", bucket: "exclusividades", publico: false },
  { key: "materiais", label: "Materiais", bucket: "materiais", publico: false },
  { key: "plantas", label: "Plantas", bucket: "documentos", publico: false },
  { key: "outros", label: "Outros", bucket: "materiais", publico: false },
] as const;

export type CategoriaKey = (typeof CATEGORIAS)[number]["key"];

export function getCategoryConfig(key: CategoriaKey) {
  return CATEGORIAS.find((c) => c.key === key)!;
}

export const ACCEPTED_BY_BUCKET: Record<string, string> = {
  imoveis: "image/jpeg,image/png,image/webp,application/pdf",
  documentos: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  exclusividades: "application/pdf,image/jpeg,image/png",
  materiais: "application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Resize image client-side to a max dimension, returning a Blob (WebP). */
export async function resizeImage(file: File, maxDim: number, quality = 0.85): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => { URL.revokeObjectURL(url); resolve(b); }, "image/webp", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function logArquivoAcao(arquivoId: string, acao: "upload" | "download" | "exclusao" | "atualizacao", metadata?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("arquivo_logs").insert({
      arquivo_id: arquivoId,
      usuario_id: data.user.id,
      acao,
      metadata: (metadata ?? null) as never,
    });
  } catch { /* silencioso */ }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024, units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isImage(mime?: string | null) { return !!mime?.startsWith("image/"); }
export function isPdf(mime?: string | null) { return mime === "application/pdf"; }
