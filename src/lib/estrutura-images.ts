import { supabase } from "@/integrations/supabase/client";

const BUCKET = "estrutura-imagens";

export type EstruturaImageUrls = {
  url: string;
  fallbackUrl: string;
};

export async function getEstruturaImageUrls(path?: string | null): Promise<EstruturaImageUrls | null> {
  if (!path) return null;

  const cleanPath = String(path).replace(/^\/+/, "");
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(cleanPath);
  const { data: signedData } = await supabase.storage.from(BUCKET).createSignedUrl(cleanPath, 60 * 60);

  return {
    url: publicData.publicUrl || signedData?.signedUrl || cleanPath,
    fallbackUrl: signedData?.signedUrl || publicData.publicUrl || cleanPath,
  };
}