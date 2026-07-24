// Compressão de imagem no navegador para WebP, mantendo qualidade visual.
// Reduz dimensões para no máximo `maxDim` (lado maior) e converte para WebP.
// Se o navegador não suportar WebP ou o arquivo já for menor que `minBytes`,
// retorna o arquivo original.

export type CompressOptions = {
  maxDim?: number;     // maior lado em px (default 2000)
  quality?: number;    // 0..1 (default 0.85)
  minBytes?: number;   // não comprime se já menor que isso (default 80KB)
};

const DEFAULTS: Required<CompressOptions> = {
  maxDim: 1600,
  quality: 0.72,
  minBytes: 80 * 1024,
};

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function isAlreadyCompressible(file: File) {
  // SVG, GIF animado e HEIC -> não tocar
  return /svg|gif|heic|heif/i.test(file.type);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback abaixo */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function compressImageToWebp(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const o = { ...DEFAULTS, ...opts };
  if (!isImage(file) || isAlreadyCompressible(file)) return file;
  if (file.size < o.minBytes && /webp/i.test(file.type)) return file;

  try {
    const bmp = await loadBitmap(file);
    const w0 = "width" in bmp ? bmp.width : (bmp as HTMLImageElement).naturalWidth;
    const h0 = "height" in bmp ? bmp.height : (bmp as HTMLImageElement).naturalHeight;
    if (!w0 || !h0) return file;

    const scale = Math.min(1, o.maxDim / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", o.quality),
    );
    if (!blob) return file;
    // Se ficou maior que o original, devolve o original
    if (blob.size >= file.size && /webp/i.test(file.type)) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("[compressImageToWebp] falha, enviando original", e);
    return file;
  }
}
