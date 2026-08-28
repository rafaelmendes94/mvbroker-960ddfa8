// Conversão server-side de imagens (webp/avif/heic -> jpeg) para integrações
// externas que não suportam formatos modernos.
// Roda em runtime edge/worker, então usa codecs WASM (jSquash) em vez de sharp.

const JPEG_QUALITY = 82;

export const LESS_COMPATIBLE = /^image\/(webp|avif|heic|heif)$/i;

export function isLessCompatible(contentType: string | null | undefined, path?: string) {
  if (contentType && LESS_COMPATIBLE.test(contentType)) return true;
  if (path && /\.(webp|avif|heic|heif)$/i.test(path)) return true;
  return false;
}

async function decodeToImageData(bytes: ArrayBuffer, contentType: string, path: string) {
  const isWebp = /webp/i.test(contentType) || /\.webp$/i.test(path);
  if (isWebp) {
    const mod = await import("@jsquash/webp/decode");
    const decode = (mod as any).default ?? mod;
    return await decode(bytes);
  }
  // avif/heic: tenta o decoder nativo do runtime, se existir
  const anyGlobal = globalThis as any;
  if (typeof anyGlobal.createImageBitmap === "function" && typeof anyGlobal.OffscreenCanvas === "function") {
    const blob = new Blob([bytes], { type: contentType });
    const bitmap = await anyGlobal.createImageBitmap(blob);
    const canvas = new anyGlobal.OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }
  throw new Error("no decoder for " + contentType);
}

/**
 * Converte bytes de imagem para JPEG. Retorna null se não for possível
 * (o chamador deve then servir a imagem original).
 */
export async function convertToJpeg(
  bytes: ArrayBuffer,
  contentType: string,
  path: string,
): Promise<Uint8Array | null> {
  try {
    const imageData = await decodeToImageData(bytes, contentType, path);
    if (!imageData) return null;
    const mod = await import("@jsquash/jpeg/encode");
    const encode = (mod as any).default ?? mod;
    const out = await encode(imageData, { quality: JPEG_QUALITY });
    return new Uint8Array(out);
  } catch (error) {
    console.error("[image-convert] falha ao converter para jpeg:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Acrescenta ?format=jpg a uma URL de proxy público, sem duplicar. */
export function withJpegFormat(url: string): string {
  if (!url) return url;
  if (/[?&]format=/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "format=jpg";
}
