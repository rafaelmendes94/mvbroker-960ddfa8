import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { IMOVEIS_FIELDS_UNIQUE } from "./import-schemas";

async function assertImportAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin_staff", { _uid: context.userId });
  if (!data) throw new Error("Apenas administradores podem usar a importação inteligente.");
}

async function gemini(context: { supabase: any }) {
  const { getGeminiKey, geminiJson } = await import("./gemini.server");
  const key = await getGeminiKey(context.supabase);
  return (system: string, user: string, opts?: { model?: string; temperature?: number }) =>
    geminiJson(key, system, user, opts);
}

// ---------------------------------------------------------------- mapeamento

const FIELDS_CATALOG = IMOVEIS_FIELDS_UNIQUE.map((f) => `${f.key} (${f.label}, ${f.type})`).join("\n");

export const iaSugerirMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ headers: z.array(z.string()), sample: z.array(z.record(z.string(), z.any())).max(20) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertImportAdmin(context);
    const call = await gemini(context);
    const out = await call(
      `Você mapeia colunas de planilhas de imóveis para campos do sistema.
Retorne APENAS JSON no formato {"mapping":[{"coluna":"<header da planilha>","campo":"<key do campo do sistema>","confianca":<0..1>}]}.
Use campo null quando a coluna não corresponder a nenhum campo. Nunca invente keys.`,
      `Campos do sistema (key (rótulo, tipo)):\n${FIELDS_CATALOG}\n\nColunas da planilha: ${JSON.stringify(data.headers)}\nAmostra de linhas:\n${JSON.stringify(data.sample).slice(0, 6000)}`,
      { temperature: 0.1 },
    );
    return out as { mapping: Array<{ coluna: string; campo: string | null; confianca: number }> };
  });

// ---------------------------------------------------------------- normalização

const LinhaTexto = z.object({
  i: z.number(),
  titulo: z.string().optional().nullable(),
  tipo_imovel: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  padrao: z.string().optional().nullable(),
  condicao: z.string().optional().nullable(),
  posicao_solar: z.string().optional().nullable(),
  vista: z.string().optional().nullable(),
  empreendimento: z.string().optional().nullable(),
});

const TIPOS = `apartamento, apartamento_garden, cobertura, duplex, loft, studio, casa, casa_condominio, casa_geminada, sobrado, terreno, comercial, sala_comercial, galpao, chacara, rural, outro`;

export const iaNormalizarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ linhas: z.array(LinhaTexto).max(40) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertImportAdmin(context);
    const call = await gemini(context);
    const out = await call(
      `Você normaliza dados de imóveis vindos de planilha, corrigindo erros de digitação.
Para CADA linha retorne um objeto com as mesmas keys de entrada mais:
- tipo_imovel: normalizado para um destes valores: ${TIPOS} (ou null se impossível saber)
- status_imovel: "disponivel" | "reservado" | "vendido" | null, interpretando o campo status mesmo com variações (Ativo, DISPONÍVEL, vend., Livre, Em negociação etc.). "Inativo"/"arquivado" → status_imovel null e arquivado true.
- arquivado: true quando a linha indicar imóvel inativo/desativado/baixado; false quando ativo; null quando não informado.
- cidade/bairro/logradouro: com capitalização correta e digitação corrigida (ex.: "porto alegre" → "Porto Alegre", "menin deus" → "Menino Deus").
- empreendimento_tipo: "condominio" | "edificio" | "loteamento" | "empreendimento" | null — deduza pelo contexto (ex.: "Ed." → edificio, "Cond." → condominio, nomes com "loteamento/parque/reserva" → loteamento).
- empreendimento_nome: nome do empreendimento limpo, sem abreviações de tipo (sem "Ed.", "Cond.").
- titulo: corrigido, sem exageros, mantendo o sentido.
Retorne APENAS JSON {"linhas":[...]} na MESMA ordem e com o mesmo i de entrada.`,
      `Linhas:\n${JSON.stringify(data.linhas)}`,
      { temperature: 0.1 },
    );
    return out as { linhas: any[] };
  });

// ---------------------------------------------------------------- empreendimentos

function bigramDice(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const g = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) g.set(s.slice(i, i + 2), (g.get(s.slice(i, i + 2)) || 0) + 1);
    return g;
  };
  const ga = grams(x);
  const gb = grams(y);
  let inter = 0;
  for (const [g, c] of ga) inter += Math.min(c, gb.get(g) || 0);
  return (2 * inter) / (x.length - 1 + (y.length - 1));
}

export const iaVincularEmpreendimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nomes: z.array(z.object({ nome: z.string(), tipo: z.string().nullable().optional() })).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertImportAdmin(context);
    const tabelas = ["condominios", "edificios", "loteamentos", "empreendimentos"] as const;
    const pool: Array<{ tabela: string; id: string; nome: string }> = [];
    for (const t of tabelas) {
      const { data: rows } = await context.supabase.from(t).select("id, nome").limit(5000);
      for (const r of rows || []) if (r.nome) pool.push({ tabela: t, id: r.id, nome: r.nome });
    }
    const resultado = data.nomes.map((n) => {
      let best: { tabela: string; id: string; nome: string; score: number } | null = null;
      for (const p of pool) {
        let s = bigramDice(n.nome, p.nome);
        if (n.tipo && p.tabela === n.tipo) s += 0.05; // leve bônus quando o tipo deduzido bate
        if (!best || s > best.score) best = { ...p, score: s };
      }
      return best && best.score >= 0.55
        ? { nome: n.nome, encontrado: true, tabela: best.tabela, id: best.id, nome_oficial: best.nome, score: best.score }
        : { nome: n.nome, encontrado: false, tabela: null, id: null, nome_oficial: null, score: best?.score ?? 0 };
    });
    return { resultado };
  });

// ---------------------------------------------------------------- duplicados

const LinhaDup = z.object({
  i: z.number(),
  codigo_interno: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  unidade: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  titulo: z.string().optional().nullable(),
});

export const buscarDuplicados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ linhas: z.array(LinhaDup).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertImportAdmin(context);
    const resultados: any[] = [];
    const CONC = 5;
    for (let k = 0; k < data.linhas.length; k += CONC) {
      const slice = data.linhas.slice(k, k + CONC);
      const partes = await Promise.all(
        slice.map(async (l) => {
          const { data: cands } = await context.supabase.rpc("buscar_imoveis_similares", {
            p_codigo: l.codigo_interno || undefined,
            p_cidade: l.cidade || undefined,
            p_logradouro: l.logradouro || undefined,
            p_numero: l.numero || undefined,
            p_unidade: l.unidade || undefined,
            p_bairro: l.bairro || undefined,
            p_titulo: l.titulo || undefined,
            p_limit: 3,
          } as any);
          const candidatos = (cands || []) as any[];
          const top = candidatos[0] || null;
          const codigoExato =
            l.codigo_interno &&
            candidatos.some(
              (c) => (c.codigo_interno || "").toLowerCase() === l.codigo_interno!.toLowerCase(),
            );
          let status: "novo" | "exato" | "alto" | "duvidoso" = "novo";
          if (codigoExato) status = "exato";
          else if (top && top.score >= 0.85) status = "alto";
          else if (top && top.score >= 0.5) status = "duvidoso";
          return { i: l.i, status, candidatos };
        }),
      );
      resultados.push(...partes);
    }
    return { resultados };
  });

export const iaResolverDuplicados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        pares: z
          .array(z.object({ i: z.number(), linha: z.record(z.string(), z.any()), candidato: z.record(z.string(), z.any()) }))
          .max(60),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertImportAdmin(context);
    const call = await gemini(context);
    const out = await call(
      `Você decide se a linha de uma planilha e um imóvel já cadastrado são o MESMO imóvel, tolerando erros de digitação e abreviações.
Considere: mesmo endereço + unidade/quadra/lote = mesmo imóvel; preço parecido ajuda; tipos ou endereços claramente diferentes = diferente.
Retorne APENAS JSON {"decisoes":[{"i":<numero>,"veredito":"mesmo_imovel"|"diferente"|"incerto","motivo":"<frase curta>"}]}.`,
      `Pares:\n${JSON.stringify(data.pares).slice(0, 12000)}`,
      { temperature: 0.1, model: "gemini-2.5-pro" },
    );
    return out as { decisoes: Array<{ i: number; veredito: string; motivo?: string }> };
  });

// ---------------------------------------------------------------- execução

const Acao = z.object({
  tipo: z.enum(["criar", "atualizar", "ignorar"]),
  id: z.string().optional().nullable(),
  dados: z.record(z.string(), z.any()),
});

export const executarImportacaoIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        arquivoNome: z.string(),
        totalLinhas: z.number(),
        acoes: z.array(Acao).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertImportAdmin(context);
    const { supabase } = context;
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;
    let falhas = 0;
    const erros: Array<{ i: number; message: string }> = [];

    const criarRaw = data.acoes.filter((a) => a.tipo === "criar").map((a) => a.dados);
    const atualizar = data.acoes.filter((a) => a.tipo === "atualizar");
    ignorados = data.acoes.filter((a) => a.tipo === "ignorar").length;
    let recodificados = 0;

    // Códigos já usados no banco (para não colidir) — só os que aparecem no arquivo
    const codigosArquivo = criarRaw
      .map((d) => String((d as any).codigo_interno ?? "").trim())
      .filter(Boolean);
    const usados = new Set<string>();
    for (let i = 0; i < codigosArquivo.length; i += 200) {
      const fatia = codigosArquivo.slice(i, i + 200);
      const { data: exist } = await supabase
        .from("imoveis")
        .select("codigo_interno")
        .or(fatia.map((c) => `codigo_interno.ilike.${c.replace(/[,()]/g, "")}%`).join(","));
      for (const r of exist || []) {
        const c = (r as any).codigo_interno;
        if (c) usados.add(String(c).toLowerCase());
      }
    }

    function codigoLivre(base: string) {
      if (!usados.has(base.toLowerCase())) {
        usados.add(base.toLowerCase());
        return base;
      }
      let n = 2;
      while (usados.has(`${base}-${n}`.toLowerCase())) n++;
      const novo = `${base}-${n}`;
      usados.add(novo.toLowerCase());
      recodificados++;
      return novo;
    }

    // Toda linha marcada como "criar" vira um imóvel novo, com código livre
    const criar: any[] = criarRaw.map((d) => {
      const cod = String((d as any).codigo_interno ?? "").trim();
      return cod ? { ...(d as any), codigo_interno: codigoLivre(cod) } : d;
    });

    for (let i = 0; i < criar.length; i += 50) {
      const batch = criar.slice(i, i + 50);
      const { error, data: ins } = await supabase.from("imoveis").insert(batch as any).select("id");
      if (error) {
        for (let j = 0; j < batch.length; j++) {
          const { error: e1 } = await supabase.from("imoveis").insert(batch[j] as any).select("id").maybeSingle();
          if (e1) {
            falhas++;
            erros.push({ i: i + j, message: e1.message });
          } else criados++;
        }
      } else criados += ins?.length || batch.length;
    }



    for (const a of atualizar) {
      if (!a.id) {
        falhas++;
        continue;
      }
      const { error } = await supabase.from("imoveis").update(a.dados as any).eq("id", a.id);
      if (error) {
        falhas++;
        erros.push({ i: -1, message: error.message });
      } else atualizados++;
    }

    await supabase.from("import_jobs").insert({
      usuario_id: context.userId,
      tipo: "imoveis_ia",
      arquivo_nome: data.arquivoNome,
      status: falhas > 0 ? "concluido_com_erros" : "concluido",
      total_linhas: data.totalLinhas,
      criados,
      atualizados,
      ignorados,
      falhas,
      resultado: { erros: erros.slice(0, 200) },
    });

    return { criados, atualizados, ignorados, falhas, erros };
  });
