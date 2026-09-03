// Helper compartilhado para chamar o Gemini externo (mesma configuração da VPS).
// Chave lida de integration_settings (Configurações → Integrações) com fallback para env GEMINI_API_KEY.

export async function getGeminiKey(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("integration_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .maybeSingle();
  const key = data?.value?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Chave Gemini não configurada. Acesse Configurações → Integrações e cadastre a GEMINI_API_KEY.",
    );
  }
  return key;
}

export async function geminiJson<T = any>(
  key: string,
  systemPrompt: string,
  userPrompt: string,
  opts?: { model?: string; temperature?: number },
): Promise<T> {
  const model = opts?.model || "gemini-2.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
    encodeURIComponent(key);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: opts?.temperature ?? 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (err) {
    throw new Error("Falha ao chamar Gemini: " + (err instanceof Error ? err.message : String(err)));
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429)
      throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
    if (res.status === 401 || res.status === 403)
      throw new Error("Chave do Gemini inválida ou sem permissão. Verifique GEMINI_API_KEY nas Integrações.");
    throw new Error(`Falha no Gemini (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || "";
  if (!text) throw new Error("Gemini retornou resposta vazia.");

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (m) return JSON.parse(m[1]) as T;
    throw new Error("Gemini não retornou JSON válido.");
  }
}
