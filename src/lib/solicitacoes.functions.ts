import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signupSchema = z
  .object({
    tipo: z.enum(["corretor", "imobiliaria"]).default("corretor"),
    nome: z.string().trim().min(3).max(200),
    email: z.string().trim().email().max(255),
    telefone: z.string().trim().min(8).max(40),
    creci: z.string().trim().max(40).optional().default(""),
    cidade: z.string().trim().min(2).max(120),
    cnpj: z.string().trim().max(30).optional().default(""),
    razao_social: z.string().trim().max(200).optional().default(""),
    senha: z.string().min(8).max(72),
  })
  .refine((d) => d.tipo === "imobiliaria" || d.creci.length >= 2, {
    message: "Informe o CRECI.",
    path: ["creci"],
  })
  .refine((d) => d.tipo === "corretor" || d.cnpj.length >= 11, {
    message: "Informe o CNPJ.",
    path: ["cnpj"],
  });

// Cadastro público (corretor ou imobiliária) — conta em estado "pendente", sem plano.
export const signupCorretor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("./solicitacoes.server");
    const admin = await getSupabaseAdmin();
    const isImob = data.tipo === "imobiliaria";

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { full_name: data.nome },
    });
    if (error || !created.user) {
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Já existe uma conta com este e-mail.");
      }
      throw new Error(error?.message ?? "Não foi possível criar a conta.");
    }
    const userId = created.user.id;

    await admin.from("profiles").upsert({ id: userId, full_name: data.nome });

    // Papel conforme o tipo escolhido no cadastro.
    const role = isImob ? "imobiliaria" : "corretor_autonomo";
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role });

    if (isImob) {
      await admin.from("imobiliarias").insert({
        owner_id: userId,
        nome_fantasia: data.nome,
        razao_social: data.razao_social || null,
        cnpj: data.cnpj || null,
        email: data.email,
        telefone: data.telefone,
        status: "pendente",
      });
    }

    const { error: solErr } = await admin.from("solicitacoes_cadastro").insert({
      user_id: userId,
      tipo: data.tipo,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      creci: data.creci || null,
      cidade: data.cidade,
      cnpj: data.cnpj || null,
      razao_social: data.razao_social || null,
      status: "pendente",
    });
    if (solErr) throw new Error(solErr.message);

    return { ok: true };
  });


const tokenSchema = z.object({ _token: z.string().min(1) });

export const listarSolicitacoes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { getAuthedContext, assertAdmin, getSupabaseAdmin } = await import("./solicitacoes.server");
    const ctx = await getAuthedContext(data._token);
    await assertAdmin(ctx);
    const admin = await getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from("solicitacoes_cadastro")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const aprovarSchema = tokenSchema.extend({
  solicitacao_id: z.string().uuid(),
  plano_id: z.string().uuid(),
  ciclo: z.enum(["mensal", "anual"]),
  valor: z.number().nonnegative().max(1_000_000),
  proximo_vencimento: z.string().min(8).max(10).optional(),
});

export const aprovarSolicitacao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => aprovarSchema.parse(d))
  .handler(async ({ data }) => {
    const { getAuthedContext, assertAdmin, getSupabaseAdmin } = await import("./solicitacoes.server");
    const ctx = await getAuthedContext(data._token);
    await assertAdmin(ctx);
    const admin = await getSupabaseAdmin();

    const { data: sol, error: solErr } = await admin
      .from("solicitacoes_cadastro")
      .select("*")
      .eq("id", data.solicitacao_id)
      .maybeSingle();
    if (solErr) throw new Error(solErr.message);
    if (!sol) throw new Error("Solicitação não encontrada.");
    if (sol.status === "aprovado") throw new Error("Esta solicitação já foi aprovada.");

    const { data: plano } = await admin
      .from("planos")
      .select("id, nome")
      .eq("id", data.plano_id)
      .maybeSingle();
    if (!plano) throw new Error("Plano inválido.");

    const { error: assErr } = await admin.from("assinaturas").insert({
      plano_id: data.plano_id,
      usuario_id: sol.user_id,
      ciclo: data.ciclo,
      valor: data.valor,
      status: "ativa",
      inicio_em: new Date().toISOString().slice(0, 10),
      proximo_vencimento: data.proximo_vencimento ?? null,
    });
    if (assErr) throw new Error(assErr.message);

    const { error: updErr } = await admin
      .from("solicitacoes_cadastro")
      .update({
        status: "aprovado",
        aprovado_por: ctx.userId,
        aprovado_em: new Date().toISOString(),
        motivo_recusa: null,
      })
      .eq("id", data.solicitacao_id);
    if (updErr) throw new Error(updErr.message);

    let emailEnviado = false;
    try {
      const { enviarEmailContaAprovada } = await import("./solicitacoes-email.server");
      emailEnviado = await enviarEmailContaAprovada({
        solicitacaoId: sol.id,
        email: sol.email,
        nome: sol.nome,
        plano: plano.nome,
      });
    } catch (e) {
      console.error("[solicitacoes] falha ao enviar e-mail de aprovação:", e);
    }

    return { ok: true, emailEnviado };
  });

const recusarSchema = tokenSchema.extend({
  solicitacao_id: z.string().uuid(),
  motivo: z.string().trim().min(3).max(500),
});

export const recusarSolicitacao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recusarSchema.parse(d))
  .handler(async ({ data }) => {
    const { getAuthedContext, assertAdmin, getSupabaseAdmin } = await import("./solicitacoes.server");
    const ctx = await getAuthedContext(data._token);
    await assertAdmin(ctx);
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from("solicitacoes_cadastro")
      .update({ status: "recusado", motivo_recusa: data.motivo, aprovado_por: ctx.userId })
      .eq("id", data.solicitacao_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
