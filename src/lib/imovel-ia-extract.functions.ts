import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ texto: z.string().min(5) });

// Subset of ImovelForm FormState — only fields commonly present in free-form
// property descriptions. Everything is nullable/optional; the model returns
// null when a field isn't in the text.
const CamposSchema = z
  .object({
    titulo: z.string().nullable().optional(),
    tipo_imovel: z.string().nullable().optional(),
    descricao: z.string().nullable().optional(),

    cep: z.string().nullable().optional(),
    logradouro: z.string().nullable().optional(),
    numero: z.string().nullable().optional(),
    bairro: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    estado: z.string().nullable().optional(),

    unidade: z.string().nullable().optional(),
    box: z.string().nullable().optional(),
    quadra: z.string().nullable().optional(),
    lote: z.string().nullable().optional(),

    preco: z.number().nullable().optional(),
    comissao_percentual: z.number().nullable().optional(),
    bonus: z.string().nullable().optional(),
    condicoes_pagamento: z.array(z.string()).nullable().optional(),

    responsavel_nome: z.string().nullable().optional(),
    responsavel_telefone: z.string().nullable().optional(),
    local_chaves: z.string().nullable().optional(),

    dormitorios: z.number().nullable().optional(),
    suites: z.number().nullable().optional(),
    banheiros: z.number().nullable().optional(),
    lavabo: z.number().nullable().optional(),
    vagas: z.number().nullable().optional(),
    elevadores: z.number().nullable().optional(),

    area_privativa: z.number().nullable().optional(),
    area_total: z.number().nullable().optional(),

    vista_mar: z.boolean().nullable().optional(),
    decorado: z.boolean().nullable().optional(),
    aceita_permuta: z.boolean().nullable().optional(),
    condicao: z.string().nullable().optional(),
    posicao_solar: z.string().nullable().optional(),
    vista: z.string().nullable().optional(),
    padrao: z.string().nullable().optional(),

    infraestrutura: z.array(z.string()).nullable().optional(),
  })
  .strip();

const SYSTEM_PROMPT = `Você é um extrator de dados imobiliários. Recebe uma descrição livre de imóvel (WhatsApp, e-mail, ficha do proprietário) e retorna SOMENTE um JSON válido, sem markdown, sem crases, sem comentários.

Regras:
- Use exatamente as chaves definidas no schema abaixo.
- Use null quando a informação não estiver no texto. NUNCA invente.
- Números como valores numéricos puros (sem R$, sem pontos de milhar, use ponto decimal). Ex: 1.250.000,00 -> 1250000. 75,05 m² -> 75.05.
- "estado" em UF de 2 letras quando possível (RS, SP...).
- "tipo_imovel" ex: "Apartamento", "Casa", "Comercial", "Terreno", "Lote", "Cobertura".
- "responsavel_nome" e "responsavel_telefone": pegue o PRIMEIRO proprietário/contato listado. Coloque os demais dentro de "descricao".
- "local_chaves": se houver tag, senha, box, código de acesso — resuma tudo aqui (ex: "Tag Lux Group central/sepe - Senha 1745 - Box 26").
- "vista_mar": true se mencionar "vista mar", "beira mar", "frente mar".
- "decorado": true se mencionar "decorado" ou "mobiliado e decorado".
- "condicao": "Mobiliado" | "Semi-mobiliado" | "Vazio" | "Decorado".
- "condicoes_pagamento": array com ex "À Vista", "Estuda Propostas", "Financiamento Bancário", "FGTS", "Permuta".
- "infraestrutura": array com itens curtos: "Piscina", "Elevador", "Hall Decorado", "Beira Mar", "Portaria 24h", "Churrasqueira", "Academia", "Salão de Festas" etc.
- "descricao": reescreva a descrição limpa e comercial em pt-BR, 2-3 parágrafos, sem repetir bruto o WhatsApp. Inclua contatos extras que não couberam em responsavel_*.
- "titulo": monte curto, ex: "Apartamento 2 dorm - Zona Nova, Capão da Canoa".

Schema (todas opcionais/nullable):
{
  "titulo": string|null, "tipo_imovel": string|null, "descricao": string|null,
  "cep": string|null, "logradouro": string|null, "numero": string|null,
  "bairro": string|null, "cidade": string|null, "estado": string|null,
  "unidade": string|null, "box": string|null, "quadra": string|null, "lote": string|null,
  "preco": number|null, "comissao_percentual": number|null, "bonus": string|null,
  "condicoes_pagamento": string[]|null,
  "responsavel_nome": string|null, "responsavel_telefone": string|null, "local_chaves": string|null,
  "dormitorios": number|null, "suites": number|null, "banheiros": number|null,
  "lavabo": number|null, "vagas": number|null, "elevadores": number|null,
  "area_privativa": number|null, "area_total": number|null,
  "vista_mar": boolean|null, "decorado": boolean|null, "aceita_permuta": boolean|null,
  "condicao": string|null, "posicao_solar": string|null, "vista": string|null, "padrao": string|null,
  "infraestrutura": string[]|null
}

Retorne SOMENTE o JSON.`;

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export const extrairImovelDeTexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("integration_settings")
      .select("value")
      .eq("key", "gemini_api_key")
      .maybeSingle();
    const dbKey = (row?.value as string | undefined)?.trim();
    const envKey = process.env.GEMINI_API_KEY?.trim();
    const key = dbKey || envKey;
    if (!key)
      throw new Error(
        "Chave Gemini não configurada. Acesse Configurações → Integrações e cadastre a GEMINI_API_KEY.",
      );

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(key);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [{ text: `Extraia os campos da descrição abaixo:\n\n${data.texto}` }],
            },
          ],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error("Falha ao chamar Gemini: " + msg);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429)
        throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
      if (res.status === 401 || res.status === 403)
        throw new Error("Chave do Gemini inválida. Verifique GEMINI_API_KEY.");
      throw new Error(`Falha ao extrair (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || "";
    if (!raw) throw new Error("IA retornou resposta vazia.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch {
      // tenta extrair o primeiro bloco {...}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("IA não retornou JSON válido.");
      parsed = JSON.parse(m[0]);
    }

    const campos = CamposSchema.parse(parsed);
    return { campos };
  });
