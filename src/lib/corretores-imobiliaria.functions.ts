import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ _token: z.string().min(1) });

function gerarSenha(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i]! % chars.length]!;
  return out;
}

/** Autentica o token e resolve a imobiliária do usuário (owner). */
async function getContext(token: string, imobiliariaIdOverride?: string) {
  const { createNodeSafeSupabaseClient, getNodeSafeSupabaseAdmin } = await import(
    "@/lib/supabase-node-safe"
  );
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY.");
  const supabase = await createNodeSafeSupabaseClient(key, token);

  let userId: string | undefined;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) userId = data.claims.sub as string;
  } catch {
    // fallback abaixo
  }
  if (!userId) {
    const { data: u, error } = await supabase.auth.getUser(token);
    if (error || !u?.user?.id) throw new Error("Unauthorized: token inválido");
    userId = u.user.id;
  }

  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });

  const admin = await getNodeSafeSupabaseAdmin();

  let imobiliariaId: string | null = null;
  if (isSuper && imobiliariaIdOverride) {
    imobiliariaId = imobiliariaIdOverride;
  } else {
    const { data: imob } = await admin
      .from("imobiliarias")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    imobiliariaId = imob?.id ?? null;
  }

  if (!imobiliariaId) {
    throw new Error("Nenhuma imobiliária vinculada a este usuário.");
  }

  return { supabase, admin, userId, imobiliariaId, isSuper: !!isSuper };
}

// ===== Listar corretores + limite do plano =====
export const listarMeusCorretores = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    tokenSchema.extend({ imobiliaria_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin, imobiliariaId } = await getContext(data._token, data.imobiliaria_id);

    const { data: corretores, error } = await admin
      .from("corretores")
      .select("id, user_id, nome, creci, email, telefone, whatsapp, status, created_at")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: limite } = await admin.rpc("imobiliaria_limite_corretores", {
      p_imob: imobiliariaId,
    });
    const row = Array.isArray(limite) ? limite[0] : limite;

    return {
      imobiliaria_id: imobiliariaId,
      corretores: corretores ?? [],
      usados: (row as any)?.usados ?? 0,
      limite: (row as any)?.limite ?? null,
      temPlanoAtivo: Boolean((row as any)?.tem_plano_ativo),
    };
  });

// ===== Criar corretor com login =====
const criarSchema = tokenSchema.extend({
  imobiliaria_id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  senha: z.string().min(6).max(72).optional(),
  creci: z.string().trim().max(50).optional(),
  telefone: z.string().trim().max(30).optional(),
});

export const criarCorretorImobiliaria = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data }) => {
    const { admin, imobiliariaId } = await getContext(data._token, data.imobiliaria_id);

    // Limite do plano
    const { data: limite } = await admin.rpc("imobiliaria_limite_corretores", {
      p_imob: imobiliariaId,
    });
    const row: any = Array.isArray(limite) ? limite[0] : limite;
    if (!row?.tem_plano_ativo) {
      throw new Error("Nenhum plano ativo vinculado à imobiliária. Fale com o administrador.");
    }
    if (row.limite != null && (row?.usados ?? 0) >= row.limite) {
      throw new Error(
        `Limite do plano atingido (${row.usados}/${row.limite} corretores ativos).`,
      );
    }

    // E-mail já usado?
    const emailLower = data.email.toLowerCase();
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existing?.users?.some((u) => (u.email ?? "").toLowerCase() === emailLower)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }

    const senha = data.senha ?? gerarSenha(12);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: data.nome },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Falha ao criar o login do corretor.");
    }
    const novoUserId = created.user.id;

    await admin.from("profiles").upsert({ id: novoUserId, full_name: data.nome });
    await admin.from("user_roles").delete().eq("user_id", novoUserId);
    await admin
      .from("user_roles")
      .upsert(
        { user_id: novoUserId, role: "corretor_imobiliaria" },
        { onConflict: "user_id,role" },
      );

    const { error: corrErr } = await admin.from("corretores").insert({
      user_id: novoUserId,
      imobiliaria_id: imobiliariaId,
      nome: data.nome,
      email: data.email,
      creci: data.creci || null,
      telefone: data.telefone || null,
      status: "ativo",
    } as never);

    if (corrErr) {
      // rollback do login criado
      await admin.auth.admin.deleteUser(novoUserId).catch(() => undefined);
      throw new Error(corrErr.message);
    }

    return { user_id: novoUserId, senha: data.senha ? undefined : senha };
  });

// ===== Bloquear / desbloquear =====
const statusSchema = tokenSchema.extend({
  imobiliaria_id: z.string().uuid().optional(),
  corretor_id: z.string().uuid(),
  bloquear: z.boolean(),
});

export const alterarStatusCorretor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data }) => {
    const { admin, imobiliariaId } = await getContext(data._token, data.imobiliaria_id);

    const { data: corretor } = await admin
      .from("corretores")
      .select("id, user_id, imobiliaria_id")
      .eq("id", data.corretor_id)
      .maybeSingle();
    if (!corretor || corretor.imobiliaria_id !== imobiliariaId) {
      throw new Error("Corretor não encontrado nesta imobiliária.");
    }

    const { error } = await admin
      .from("corretores")
      .update({ status: data.bloquear ? "bloqueado" : "ativo" })
      .eq("id", data.corretor_id);
    if (error) throw new Error(error.message);

    if (corretor.user_id) {
      await admin.auth.admin.updateUserById(corretor.user_id, {
        ban_duration: data.bloquear ? "876000h" : "none",
      } as never);
    }

    return { ok: true };
  });

// ===== Resetar senha =====
const corretorSchema = tokenSchema.extend({
  imobiliaria_id: z.string().uuid().optional(),
  corretor_id: z.string().uuid(),
});

export const resetarSenhaCorretor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => corretorSchema.parse(d))
  .handler(async ({ data }) => {
    const { admin, imobiliariaId } = await getContext(data._token, data.imobiliaria_id);

    const { data: corretor } = await admin
      .from("corretores")
      .select("id, user_id, imobiliaria_id")
      .eq("id", data.corretor_id)
      .maybeSingle();
    if (!corretor || corretor.imobiliaria_id !== imobiliariaId) {
      throw new Error("Corretor não encontrado nesta imobiliária.");
    }
    if (!corretor.user_id) throw new Error("Este corretor não possui login vinculado.");

    const senha = gerarSenha(12);
    const { error } = await admin.auth.admin.updateUserById(corretor.user_id, { password: senha });
    if (error) throw new Error(error.message);
    return { senha };
  });

// ===== Excluir corretor (e o login) =====
export const excluirCorretorImobiliaria = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => corretorSchema.parse(d))
  .handler(async ({ data }) => {
    const { admin, imobiliariaId } = await getContext(data._token, data.imobiliaria_id);

    const { data: corretor } = await admin
      .from("corretores")
      .select("id, user_id, imobiliaria_id")
      .eq("id", data.corretor_id)
      .maybeSingle();
    if (!corretor || corretor.imobiliaria_id !== imobiliariaId) {
      throw new Error("Corretor não encontrado nesta imobiliária.");
    }

    const { error } = await admin.from("corretores").delete().eq("id", data.corretor_id);
    if (error) throw new Error(error.message);

    if (corretor.user_id) {
      await admin.auth.admin.deleteUser(corretor.user_id).catch(() => undefined);
    }
    return { ok: true };
  });
