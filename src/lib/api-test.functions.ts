import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TestResult = {
  ok: boolean;
  status: number;
  latency_ms: number;
  detail: string;
};

async function ensureSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

async function getIntegrationKey(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("integration_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}

export const testGoogleMaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestResult> => {
    await ensureSuperAdmin(context);
    const mapsKey = await getIntegrationKey(context.supabase, "google_maps_api_key");
    if (!mapsKey) {
      return { ok: false, status: 0, latency_ms: 0, detail: "google_maps_api_key não configurada em Integrações" };
    }
    const start = Date.now();
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=Avenida+Paulista+1000+Sao+Paulo&key=${mapsKey}`
      );
      const latency = Date.now() - start;
      const json: any = await res.json().catch(() => ({}));
      const ok = res.ok && json?.status === "OK" && Array.isArray(json?.results) && json.results.length > 0;
      const detail = ok
        ? `Geocoding OK — ${json.results[0]?.formatted_address ?? "endereço retornado"}`
        : `Falha: ${json?.error_message ?? json?.status ?? res.statusText}`;
      return { ok, status: res.status, latency_ms: latency, detail };
    } catch (e: any) {
      return { ok: false, status: 0, latency_ms: Date.now() - start, detail: e?.message ?? "Erro de rede" };
    }
  });

export const testLovableAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestResult> => {
    await ensureSuperAdmin(context);
    const geminiKey = await getIntegrationKey(context.supabase, "gemini_api_key");
    if (!geminiKey) {
      return { ok: false, status: 0, latency_ms: 0, detail: "Chave Gemini não configurada em Integrações" };
    }
    const start = Date.now();
    const model = "gemini-2.5-flash";
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Responda apenas: PONG" }] }],
          }),
        }
      );
      const latency = Date.now() - start;
      const json: any = await res.json().catch(() => ({}));
      const content: string =
        json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") ?? "";
      const ok = res.ok && content.length > 0;
      const detail = ok
        ? `Gemini (${model}) respondeu: "${content.trim().slice(0, 80)}"`
        : `Falha: ${json?.error?.message ?? res.statusText}`;
      return { ok, status: res.status, latency_ms: latency, detail };
    } catch (e: any) {
      return { ok: false, status: 0, latency_ms: Date.now() - start, detail: e?.message ?? "Erro de rede" };
    }
  });
