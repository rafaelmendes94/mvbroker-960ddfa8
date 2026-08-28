// Conversão server-side de imagens (webp/avif/heic -> jpeg) para integrações
// externas que não suportam formatos modernos.
// Roda em runtime edge/worker, então usa codecs WASM (jSquash) em vez de sharp.
// Os binários ficam em public/wasm e são carregados por URL em runtime
// (nunca importados do código-fonte, para não entrarem no bundle do servidor).

const WEBP_DEC_WASM = "/wasm/webp_dec.wasm";
const JPEG_ENC_WASM = "/wasm/mozjpeg_enc.wasm";

const JPEG_QUALITY = 82;

export const LESS_COMPATIBLE = /^image\/(webp|avif|heic|heif)$/i;

export function isLessCompatible(contentType: string | null | undefined, path?: string) {
  if (contentType && LESS_COMPATIBLE.test(contentType)) return true;
  if (path && /\.(webp|avif|heic|heif)$/i.test(path)) return true;
  return false;
}

/** Carrega os bytes do .wasm de forma portátil (node/worker/dev). */
async function loadWasm(url: string, origin?: string): Promise<WebAssembly.Module> {
  // 1) filesystem (Node / VPS): arquivo estático em public/ ou no output
  try {
    const { readFile } = await import("node:fs/promises");
    const name = url.replace(/^\//, "");
    const candidates = [`public/${name}`, name, `.output/public/${name}`, `dist/${name}`];
    for (const candidate of candidates) {
      try {
        const bytes = await readFile(candidate);
        return await WebAssembly.compile(bytes);
      } catch {
        /* tenta próximo */
      }
    }
  } catch {
    /* sem fs (worker) */
  }
  // 2) fetch same-origin (worker / edge)
  const abs = url.startsWith("http") ? url : `${(origin || "").replace(/\/$/, "")}${url}`;
  const res = await fetch(abs);
  if (!res.ok) throw new Error(`wasm fetch ${res.status}`);
  return await WebAssembly.compile(await res.arrayBuffer());
}


let webpReady: Promise<any> | null = null;
let jpegReady: Promise<any> | null = null;

async function getWebpDecoder(origin?: string) {
  if (!webpReady) {
    webpReady = (async () => {
      const mod: any = await import("@jsquash/webp/decode");
      await mod.init(await loadWasm(WEBP_DEC_WASM, origin));
      return mod.default ?? mod;
    })().catch((error) => {
      webpReady = null;
      throw error;
    });
  }
  return webpReady;
}

async function getJpegEncoder(origin?: string) {
  if (!jpegReady) {
    jpegReady = (async () => {
      const mod: any = await import("@jsquash/jpeg/encode");
      await mod.init(await loadWasm(JPEG_ENC_WASM, origin));
      return mod.default ?? mod;
    })().catch((error) => {
      jpegReady = null;
      throw error;
    });
  }
  return jpegReady;
}

async function decodeToImageData(bytes: ArrayBuffer, contentType: string, path: string, origin?: string) {
  const isWebp = /webp/i.test(contentType) || /\.webp$/i.test(path);
  if (isWebp) {
    const decode = await getWebpDecoder(origin);
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
 * (o chamador deve então servir a imagem original).
 */
export async function convertToJpeg(
  bytes: ArrayBuffer,
  contentType: string,
  path: string,
  origin?: string,
): Promise<Uint8Array | null> {
  try {
    const imageData = await decodeToImageData(bytes, contentType, path, origin);
    if (!imageData) return null;
    const encode = await getJpegEncoder(origin);
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
