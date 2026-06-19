import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  titulo: z.string().optional().default(""),
  tipo: z.string().optional().default(""),
  cidade: z.string().optional().default(""),
  bairro: z.string().optional().default(""),
  dormitorios: z.number().nullable().optional(),
  banheiros: z.number().nullable().optional(),
  vagas: z.number().nullable().optional(),
  area_privativa: z.number().nullable().optional(),
  area_total: z.number().nullable().optional(),
  preco: z.number().nullable().optional(),
  infraestrutura: z.array(z.string()).optional().default([]),
  vista: z.string().optional().default(""),
  posicao_solar: z.string().optional().default(""),
  condicao: z.string().optional().default(""),
  observacoes: z.string().optional().default(""),
});

const SYSTEM_PROMPT =
  "Você é um redator imobiliário profissional brasileiro. Escreva descrições de imóveis envolventes, claras, em português do Brasil, com 2 a 4 parágrafos curtos. Destaque diferenciais, localização, lazer e oportunidade. Não invente atributos não fornecidos. Não use markdown.";

const SYSTEM_PROMPT_PADRAO_ANUNCIO = `Você é um redator imobiliário profissional brasileiro especialista em legendas de anúncios para Marketplace, OLX, Instagram e Facebook.
Gere a legenda EXATAMENTE no formato abaixo, com quebras de linha duplas entre blocos, sem markdown, sem títulos de seção, sem numeração, sem aspas, sem comentários extras.
Use SOMENTE os dados fornecidos — não invente atributos. Se um dado não existir, omita a linha correspondente (não escreva "não informado").

FORMATO OBRIGATÓRIO:

🏡 [Chamada principal curta e persuasiva, 1 linha]

✅ [característica 1]
✅ [característica 2]
✅ [característica 3]
(uma linha ✅ por característica/cômodo/infraestrutura relevante)

✨ [diferencial 1]
✨ [diferencial 2]
✨ [diferencial 3]
(uma linha ✨ por diferencial — acabamento, localização, proximidades)

📐 Área privativa: [X]m²
📐 Área total: [X]m²
(inclua apenas as áreas informadas)

💰 R$ [valor formatado em pt-BR]

📲 Chame no WhatsApp para agendar uma visita.`;

export const gerarDescricaoImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("integration_settings")
      .select("value")
      .eq("key", "gemini_api_key")
      .maybeSingle();
    // Prioriza variável de ambiente (secret GEMINI_API_KEY); usa integration_settings como fallback
    const envKey = process.env.GEMINI_API_KEY?.trim();
    const dbKey = row?.value?.trim();
    const key = envKey || dbKey;
    if (!key) throw new Error("Chave Gemini não configurada. Acesse Configurações → Integrações e cadastre a GEMINI_API_KEY.");

    const ficha = [
      data.titulo && `Título: ${data.titulo}`,
      data.tipo && `Tipo: ${data.tipo}`,
      (data.cidade || data.bairro) && `Localização: ${[data.bairro, data.cidade].filter(Boolean).join(" - ")}`,
      data.dormitorios != null && `Dormitórios: ${data.dormitorios}`,
      data.banheiros != null && `Banheiros: ${data.banheiros}`,
      data.vagas != null && `Vagas: ${data.vagas}`,
      data.area_privativa && `Área privativa: ${data.area_privativa} m²`,
      data.area_total && `Área total: ${data.area_total} m²`,
      data.preco && `Preço: R$ ${data.preco.toLocaleString("pt-BR")}`,
      data.vista && `Vista: ${data.vista}`,
      data.posicao_solar && `Posição solar: ${data.posicao_solar}`,
      data.condicao && `Condição: ${data.condicao}`,
      data.infraestrutura.length > 0 && `Infraestrutura: ${data.infraestrutura.join(", ")}`,
      data.observacoes && `Observações: ${data.observacoes}`,
    ].filter(Boolean).join("\n");

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(key);

    const isPadraoAnuncio = /padrao_anuncio|padrão anúncio/i.test(data.observacoes || "");
    const systemPrompt = isPadraoAnuncio ? SYSTEM_PROMPT_PADRAO_ANUNCIO : SYSTEM_PROMPT;
    const userPrompt = isPadraoAnuncio
      ? `Gere a legenda de anúncio no formato definido para o seguinte imóvel:\n\n${ficha}`
      : `Gere uma descrição comercial para o seguinte imóvel:\n\n${ficha}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: isPadraoAnuncio ? 0.5 : 0.7 },
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error("Falha ao chamar Gemini: " + msg);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
      if (res.status === 401 || res.status === 403)
        throw new Error("Chave do Gemini inválida ou sem permissão. Verifique GEMINI_API_KEY nas Integrações.");
      throw new Error(`Falha ao gerar descrição (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || "";
    if (!text) throw new Error("Gemini retornou resposta vazia.");
    return { description: text };
  });

