import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const ROLES = [
  "super_admin", "secretaria", "imobiliaria",
  "corretor_imobiliaria", "corretor_autonomo",
  "admin", "manager", "user",
] as const;

async function getWsTransport() {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  try {
    const ws = await import("ws");
    return (ws.default ?? ws.WebSocket ?? ws) as any;
  } catch {
    return undefined;
  }
}

async function createNodeSafeSupabaseClient(key: string, token?: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;

  if (!SUPABASE_URL || !key) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!key ? ["SUPABASE_KEY"] : []),
    ];
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

async function getAuthedContext() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_PUBLISHABLE_KEY) throw new Error("Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY.");

  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: No authorization header provided");

  const token = authHeader.replace("Bearer ", "");
  const supabase = await createNodeSafeSupabaseClient(SUPABASE_PUBLISHABLE_KEY, token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

  return { supabase, userId: data.claims.sub, claims: data.claims };
}

async function getSupabaseAdmin() {
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.");
  return createNodeSafeSupabaseClient(SUPABASE_SERVICE_ROLE_KEY);
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: ok } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (!ok) throw new Error("Acesso negado: apenas Super Admin.");
}

function gerarSenha(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

// ===== Listar usuários =====
export const listarUsuariosAdmin = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const authContext = await getAuthedContext();
    await assertAdmin(authContext);
    const { data, error } = await authContext.supabase.rpc("admin_list_users");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ===== Criar usuário =====
const criarSchema = z.object({
  email: z.string().trim().email().max(255),
  nome: z.string().trim().min(1).max(200),
  roles: z.array(z.enum(ROLES)).min(1),
  modo: z.enum(["senha", "convite"]).default("senha"),
  senha: z.string().min(6).max(72).optional(),
  redirectTo: z.string().url().optional(),
});

export const criarUsuarioAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    // garante profile
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.nome });

    // limpa role default e aplica os escolhidos
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert(
      data.roles.map((r) => ({ user_id: userId, role: r })),
    );

    return { user_id: userId, senha: senhaGerada };
  });

// ===== Atualizar papéis =====
const rolesSchema = z.object({
  user_id: z.string().uuid(),
  roles: z.array(z.enum(ROLES)),
});

export const atualizarRolesUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rolesSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    if (data.roles.length > 0) {
      const { error } = await supabaseAdmin.from("user_roles").insert(
        data.roles.map((r) => ({ user_id: data.user_id, role: r })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ===== Excluir usuário =====
export const excluirUsuarioAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir o próprio usuário.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Resetar senha (gera nova) =====
export const resetarSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha = gerarSenha(12);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: senha });
    if (error) throw new Error(error.message);
    return { senha };
  });

// ===== Permissões por módulo =====
export const listarPermissoesUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("user_module_permissions")
      .select("modulo, pode_ver, pode_criar, pode_editar, pode_excluir")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const permsSchema = z.object({
  user_id: z.string().uuid(),
  permissoes: z.array(z.object({
    modulo: z.string().min(1),
    pode_ver: z.boolean(),
    pode_criar: z.boolean(),
    pode_editar: z.boolean(),
    pode_excluir: z.boolean(),
  })),
});

export const salvarPermissoesUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => permsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // upsert por (user_id, modulo)
    const rows = data.permissoes.map((p) => ({ user_id: data.user_id, ...p }));
    if (rows.length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("user_module_permissions")
      .upsert(rows, { onConflict: "user_id,modulo" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
