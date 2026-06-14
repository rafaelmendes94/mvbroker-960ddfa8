import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BUILTIN_ROLES = [
  "super_admin",
  "secretaria",
  "imobiliaria",
  "corretor_imobiliaria",
  "corretor_autonomo",
  "admin",
  "manager",
  "user",
] as const;

const BUILTIN_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  secretaria: "Secretária",
  imobiliaria: "Imobiliária",
  corretor_imobiliaria: "Corretor da Imobiliária",
  corretor_autonomo: "Corretor Autônomo",
  admin: "Administrador",
  manager: "Gerente",
  user: "Usuário",
};

type AppSupabaseClient = SupabaseClient<Database>;
type RealtimeTransport = NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"];

async function getWsTransport() {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  try {
    const ws = await import("ws");
    return (ws.default ?? ws.WebSocket ?? ws) as unknown as RealtimeTransport;
  } catch {
    return undefined;
  }
}

async function createNodeSafeSupabaseClient(key: string, token?: string): Promise<AppSupabaseClient> {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !key) throw new Error("Missing Supabase env");
  const transport = await getWsTransport();
  return createClient<Database>(SUPABASE_URL, key, {
    ...(transport ? { realtime: { transport } } : {}),
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthed(token: string) {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = await createNodeSafeSupabaseClient(key, token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");
  return { supabase, userId: data.claims.sub as string };
}

async function assertAdmin(supabase: AppSupabaseClient, userId: string) {
  const { data: ok } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!ok) throw new Error("Acesso negado: apenas Super Admin.");
}

async function getAdmin(): Promise<AppSupabaseClient> {
  return createNodeSafeSupabaseClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const tokenSchema = z.object({ _token: z.string().min(1) });

// ===== Listar papéis (built-in + custom) =====
export const listarPapeis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthed(data._token);
    await assertAdmin(supabase, userId);
    const admin = await getAdmin();
    const { data: custom, error } = await admin
      .from("custom_roles")
      .select("slug, nome, descricao")
      .order("nome");
    if (error) throw new Error(error.message);

    const builtin = BUILTIN_ROLES.map((slug) => ({
      slug,
      nome: BUILTIN_LABEL[slug] ?? slug,
      descricao: null as string | null,
      sistema: true,
    }));
    const custos = (custom ?? []).map((c) => ({ ...c, sistema: false }));
    return [...builtin, ...custos];
  });

// ===== Criar papel customizado =====
const novoPapelSchema = tokenSchema.extend({
  slug: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, "Slug inválido (use a-z, 0-9, _)"),
  nome: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(300).optional().nullable(),
});

export const criarPapel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => novoPapelSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthed(data._token);
    await assertAdmin(supabase, userId);
    if ((BUILTIN_ROLES as readonly string[]).includes(data.slug)) {
      throw new Error("Slug em uso por um papel do sistema.");
    }
    const admin = await getAdmin();
    const { error } = await admin.from("custom_roles").insert({
      slug: data.slug,
      nome: data.nome,
      descricao: data.descricao ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Renomear papel customizado =====
export const renomearPapel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => novoPapelSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthed(data._token);
    await assertAdmin(supabase, userId);
    if ((BUILTIN_ROLES as readonly string[]).includes(data.slug)) {
      throw new Error("Papéis do sistema não podem ser renomeados.");
    }
    const admin = await getAdmin();
    const { error } = await admin
      .from("custom_roles")
      .update({ nome: data.nome, descricao: data.descricao ?? null })
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Excluir papel customizado =====
const slugSchema = tokenSchema.extend({ slug: z.string().min(1) });

export const excluirPapel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthed(data._token);
    await assertAdmin(supabase, userId);
    if ((BUILTIN_ROLES as readonly string[]).includes(data.slug)) {
      throw new Error("Papéis do sistema não podem ser excluídos.");
    }
    const admin = await getAdmin();
    const { count } = await admin
      .from("user_custom_roles")
      .select("id", { count: "exact", head: true })
      .eq("role_slug", data.slug);
    if ((count ?? 0) > 0) {
      throw new Error("Existem usuários com esse papel. Remova-os antes de excluir.");
    }
    await admin.from("role_module_permissions").delete().eq("role_slug", data.slug);
    const { error } = await admin.from("custom_roles").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Permissões do papel =====
export const listarPermissoesPapel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthed(data._token);
    await assertAdmin(supabase, userId);
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("role_module_permissions")
      .select("modulo, pode_ver, pode_criar, pode_editar, pode_excluir")
      .eq("role_slug", data.slug);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const permsSchema = tokenSchema.extend({
  slug: z.string().min(1),
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

export const salvarPermissoesPapel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => permsSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthed(data._token);
    await assertAdmin(supabase, userId);
    const admin = await getAdmin();
    if (data.permissoes.length === 0) return { ok: true };
    const rows = data.permissoes.map((p) => ({ role_slug: data.slug, ...p }));
    const { error } = await admin
      .from("role_module_permissions")
      .upsert(rows, { onConflict: "role_slug,modulo" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
