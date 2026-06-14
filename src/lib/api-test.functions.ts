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

export const testGoogleMaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestResult> => {
    await ensureSuperAdmin(context);
    const lovableKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !mapsKey) {
      return { ok: false, status: 0, latency_ms: 0, detail: "Credenciais Google Maps ausentes" };
    }
    const start = Date.now();
    try {
      const res = await fetch(
        "https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=Avenida+Paulista+1000+Sao+Paulo",
        {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": mapsKey,
          },
        }
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
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) {
      return { ok: false, status: 0, latency_ms: 0, detail: "LOVABLE_API_KEY ausente" };
    }
    const start = Date.now();
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey,
          "X-Lovable-AIG-SDK": "mvbroker-test",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: "Responda apenas: PONG" }],
        }),
      });
      const latency = Date.now() - start;
      const json: any = await res.json().catch(() => ({}));
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const ok = res.ok && content.length > 0;
      const detail = ok
        ? `IA respondeu: "${content.trim().slice(0, 80)}" (${json?.usage?.total_tokens ?? "?"} tokens)`
        : `Falha: ${json?.error?.message ?? res.statusText}`;
      return { ok, status: res.status, latency_ms: latency, detail };
    } catch (e: any) {
      return { ok: false, status: 0, latency_ms: Date.now() - start, detail: e?.message ?? "Erro de rede" };
    }
  });
