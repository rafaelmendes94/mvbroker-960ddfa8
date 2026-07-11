// Signed URL helper com cache em memória e TTL longo.
// Reduz drasticamente o número de chamadas ao Storage para gerar URLs
// (galeria de N fotos = 1 batch ao invés de N HTTP calls).
import { supabase } from "@/integrations/supabase/client";

// Assinamos por 7 dias (máximo prático). O path já contém timestamp e é imutável.
const SIGN_TTL_SECONDS = 7 * 24 * 60 * 60;
// Removemos do cache 1h antes de expirar para garantir renovação.
const CACHE_TTL_MS = (SIGN_TTL_SECONDS - 3600) * 1000;

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();

function key(bucket: string, path: string) {
  return `${bucket}::${path}`;
}

/**
 * Retorna uma signed URL para o objeto. Usa cache em memória entre chamadas.
 * Retorna null se path for vazio ou o Storage falhar.
 */
export async function getImageUrl(
  path: string | null | undefined,
  bucket = "imoveis"
): Promise<string | null> {
  if (!path) return null;
  const k = key(bucket, path);
  const now = Date.now();
  const cached = cache.get(k);
  if (cached && cached.expiresAt > now) return cached.url;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(k, { url: data.signedUrl, expiresAt: now + CACHE_TTL_MS });
  return data.signedUrl;
}

/**
 * Assina várias paths em uma única chamada (mais eficiente que N getImageUrl).
 * Retorna um Map de path → url. Paths já em cache não são re-assinadas.
 */
export async function getImageUrls(
  paths: string[],
  bucket = "imoveis"
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    const cached = cache.get(key(bucket, p));
    if (cached && cached.expiresAt > now) {
      out.set(p, cached.url);
    } else {
      missing.push(p);
    }
  }

  if (missing.length) {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(missing, SIGN_TTL_SECONDS);
    (data ?? []).forEach((r) => {
      if (r.path && r.signedUrl) {
        cache.set(key(bucket, r.path), {
          url: r.signedUrl,
          expiresAt: now + CACHE_TTL_MS,
        });
        out.set(r.path, r.signedUrl);
      }
    });
  }
  return out;
}
