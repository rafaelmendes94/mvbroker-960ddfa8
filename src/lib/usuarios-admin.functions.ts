import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ROLES = [
  "super_admin",
  "secretaria",
  "imobiliaria",
  "corretor_imobiliaria",
  "corretor_autonomo",
  "admin",
  "manager",
  "user",
] as const;

type Role = (typeof ROLES)[number];
type AppSupabaseClient = SupabaseClient<Database>;
type RealtimeTransport = NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"];
type AuthedContext = {
  supabase: AppSupabaseClient;
  userId: string;
  claims: Record<string, unknown>;
};

async function getWsTransport() {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  try {
    const ws = await import("ws");
    return (ws.default ?? ws.WebSocket ?? ws) as unknown as RealtimeTransport;
  } catch {
    return undefined;
  }
}

async function createNodeSafeSupabaseClient(key: string, token?: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;

  if (!SUPABASE_URL || !key) {
    const missing = [...(!SUPABASE_URL ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_KEY"] : [])];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  const transport = await getWsTransport();
  return createClient<Database>(SUPABASE_URL, key, {
    ...(transport ? { realtime: { transport } } : {}),
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthedContext(token: string): Promise<AuthedContext> {
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY.");
  }
  if (!token) throw new Error("Unauthorized: No token provided");

  const supabase = await createNodeSafeSupabaseClient(SUPABASE_PUBLISHABLE_KEY, token);

  // Tenta getClaims (cloud / JWKS). Em Supabase self-hosted (VPS) com JWT HS256
  // legado, getClaims pode falhar — caímos para getUser(token).
  let userId: string | undefined;
  let claims: Record<string, unknown> = {};
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      userId = data.claims.sub as string;
      claims = data.claims as Record<string, unknown>;
    }
  } catch {
    // ignora — tenta fallback
  }
  if (!userId) {
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user?.id) throw new Error("Unauthorized: Invalid token");
    userId = u.user.id;
    claims = { sub: u.user.id, email: u.user.email } as Record<string, unknown>;
  }

  return { supabase, userId, claims };
}

async function getSupabaseAdmin() {
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createNodeSafeSupabaseClient(SUPABASE_SERVICE_ROLE_KEY);
}

async function assertAdmin(ctx: Pick<AuthedContext, "supabase" | "userId">) {
  const { data: isSuper } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (isSuper) return;
  const { data: isSec } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "secretaria",
  });
  if (!isSec) throw new Error("Acesso negado: apenas Super Admin ou Secretaria.");
}

function gerarSenha(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

const tokenSchema = z.object({ _token: z.string().min(1) });

// ===== Listar usuários =====
export const listarUsuariosAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const { data: rows, error } = await authContext.supabase.rpc("admin_list_users");
    if (error) throw new Error(error.message);
    // Anexa roles customizadas
    const admin = await getSupabaseAdmin();
    const { data: customs } = await admin
      .from("user_custom_roles")
      .select("user_id, role_slug");
    const byUser = new Map<string, string[]>();
    (customs ?? []).forEach((c: any) => {
      const cur = byUser.get(c.user_id) ?? [];
      cur.push(c.role_slug);
      byUser.set(c.user_id, cur);
    });
    return (rows ?? []).map((u: any) => ({
      ...u,
      roles: [...(u.roles ?? []), ...(byUser.get(u.id) ?? [])],
    }));
  });

// ===== Criar usuário =====
const criarSchema = tokenSchema.extend({
  email: z.string().trim().email().max(255),
  nome: z.string().trim().min(1).max(200),
  roles: z.array(z.enum(ROLES)).default([]),
  custom_role_slugs: z.array(z.string().min(1)).default([]),
  modo: z.enum(["senha", "convite"]).default("senha"),
  senha: z.string().min(6).max(72).optional(),
  redirectTo: z.string().url().optional(),
});

export const criarUsuarioAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const supabaseAdmin = await getSupabaseAdmin();

    if (data.roles.length === 0 && data.custom_role_slugs.length === 0) {
      throw new Error("Selecione ao menos um papel.");
    }

    let userId: string;
    let senhaGerada: string | undefined;

    if (data.modo === "senha") {
      const senha = data.senha ?? gerarSenha(12);
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: data.nome },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
      userId = created.user.id;
      if (!data.senha) senhaGerada = senha;
    } else {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: data.redirectTo,
        data: { full_name: data.nome },
      });
      if (error || !inv.user) throw new Error(error?.message ?? "Falha ao enviar convite");
      userId = inv.user.id;
    }

    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.nome });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    if (data.roles.length > 0) {
      await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((r: Role) => ({ user_id: userId, role: r })));
    }
    if (data.custom_role_slugs.length > 0) {
      await supabaseAdmin
        .from("user_custom_roles")
        .insert(data.custom_role_slugs.map((s) => ({ user_id: userId, role_slug: s })));
    }

    return { user_id: userId, senha: senhaGerada };
  });

// ===== Atualizar papéis =====
const rolesSchema = tokenSchema.extend({
  user_id: z.string().uuid(),
  roles: z.array(z.enum(ROLES)).default([]),
  custom_role_slugs: z.array(z.string().min(1)).default([]),
});

export const atualizarRolesUsuario = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => rolesSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const supabaseAdmin = await getSupabaseAdmin();
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_custom_roles").delete().eq("user_id", data.user_id);
    if (data.roles.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((r: Role) => ({ user_id: data.user_id, role: r })));
      if (error) throw new Error(error.message);
    }
    if (data.custom_role_slugs.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_custom_roles")
        .insert(data.custom_role_slugs.map((s) => ({ user_id: data.user_id, role_slug: s })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


// ===== Excluir usuário =====
const userIdSchema = tokenSchema.extend({ user_id: z.string().uuid() });

export const excluirUsuarioAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => userIdSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    if (data.user_id === authContext.userId) {
      throw new Error("Você não pode excluir o próprio usuário.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Resetar senha =====
export const resetarSenhaUsuario = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => userIdSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const supabaseAdmin = await getSupabaseAdmin();
    const senha = gerarSenha(12);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: senha,
    });
    if (error) throw new Error(error.message);
    return { senha };
  });

// ===== Definir senha personalizada =====
const definirSenhaSchema = tokenSchema.extend({
  user_id: z.string().uuid(),
  senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
});
export const definirSenhaUsuario = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => definirSenhaSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Permissões por módulo =====
export const listarPermissoesUsuario = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => userIdSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const { data: rows, error } = await authContext.supabase
      .from("user_module_permissions")
      .select("modulo, pode_ver, pode_criar, pode_editar, pode_excluir")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const permsSchema = tokenSchema.extend({
  user_id: z.string().uuid(),
  permissoes: z.array(
    z.object({
      modulo: z.string().min(1),
      pode_ver: z.boolean(),
      pode_criar: z.boolean(),
      pode_editar: z.boolean(),
      pode_excluir: z.boolean(),
    }),
  ),
});

export const salvarPermissoesUsuario = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => permsSchema.parse(d))
  .handler(async ({ data }) => {
    const authContext = await getAuthedContext(data._token);
    await assertAdmin(authContext);
    const supabaseAdmin = await getSupabaseAdmin();
    const rows = data.permissoes.map((p) => ({ user_id: data.user_id, ...p }));
    if (rows.length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("user_module_permissions")
      .upsert(rows, { onConflict: "user_id,modulo" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
