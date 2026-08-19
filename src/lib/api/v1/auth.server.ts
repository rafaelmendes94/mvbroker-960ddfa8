// Resolução do "principal" da API v1.
// Aceita dois tipos de credencial no header Authorization:
//   1. Bearer <JWT do usuário logado>
//   2. Bearer <API Key mvb_live_...>  (habilitado na Fase 5)
import { createHash } from "crypto";
import { getFeedSupabase } from "@/lib/feed-supabase.server";
import { ApiError } from "./response";

export type ApiRole = "ADMIN" | "GESTOR" | "CORRETOR" | "INTEGRATION";

export type Scope =
  | "developments:read" | "developments:write"
  | "typologies:read" | "typologies:write"
  | "units:read" | "units:write"
  | "offers:read" | "offers:write"
  | "brokers:read" | "brokers:write"
  | "catalogs:read" | "catalogs:write";

export const ALL_SCOPES: Scope[] = [
  "developments:read", "developments:write",
  "typologies:read", "typologies:write",
  "units:read", "units:write",
  "offers:read", "offers:write",
  "brokers:read", "brokers:write",
  "catalogs:read", "catalogs:write",
];

const READ_SCOPES: Scope[] = ALL_SCOPES.filter((s) => s.endsWith(":read"));

export type Principal = {
  kind: "user" | "integration";
  role: ApiRole;
  userId: string | null;
  agencyId: string | null;
  /** true quando o principal pode enxergar/editar dados de todas as imobiliárias */
  crossTenant: boolean;
  scopes: Scope[];
  apiKeyId?: string;
};

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  const alt = request.headers.get("x-api-key");
  return alt?.trim() || null;
}

export function requireScope(principal: Principal, scope: Scope): void {
  if (!principal.scopes.includes(scope)) {
    throw new ApiError("FORBIDDEN_SCOPE", `Credencial sem permissão para "${scope}"`);
  }
}

/** Aplica o recorte multi-tenant a uma query PostgREST. */
export function scopeToTenant<T>(query: T, principal: Principal): T {
  if (principal.crossTenant || !principal.agencyId) return query;
  // registros sem imobiliária são do acervo compartilhado e continuam visíveis
  return (query as any).or(`agency_id.eq.${principal.agencyId},agency_id.is.null`) as T;
}

/** Garante que o principal pode escrever num registro de determinada imobiliária. */
export function assertCanWriteAgency(principal: Principal, agencyId: string | null | undefined): void {
  if (principal.crossTenant) return;
  if (!principal.agencyId) throw new ApiError("FORBIDDEN", "Credencial sem imobiliária vinculada");
  if (agencyId && agencyId !== principal.agencyId) {
    throw new ApiError("FORBIDDEN", "Registro pertence a outra imobiliária");
  }
}

export async function resolvePrincipal(request: Request): Promise<Principal> {
  const token = bearerFrom(request);
  if (!token) throw new ApiError("UNAUTHORIZED", "Credencial ausente");

  const { client, error } = getFeedSupabase();
  if (!client) throw new ApiError("CONFIG_ERROR", error ?? "Backend indisponível");
  const db = client as any;

  // --- API Key ---
  if (token.startsWith("mvb_")) {
    const keyHash = hashApiKey(token);
    let row: any = null;
    try {
      const { data } = await db
        .from("api_keys")
        .select("id, agency_id, permissions, active, expires_at")
        .eq("key_hash", keyHash)
        .maybeSingle();
      row = data ?? null;
    } catch {
      row = null;
    }
    if (!row || row.active === false) throw new ApiError("UNAUTHORIZED", "API Key inválida");
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new ApiError("UNAUTHORIZED", "API Key expirada");
    }
    try {
      await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
    } catch { /* não bloqueia a requisição */ }

    return {
      kind: "integration",
      role: "INTEGRATION",
      userId: null,
      agencyId: row.agency_id ?? null,
      crossTenant: !row.agency_id,
      scopes: (row.permissions ?? READ_SCOPES) as Scope[],
      apiKeyId: row.id,
    };
  }

  // --- JWT de usuário ---
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user?.id) throw new ApiError("UNAUTHORIZED", "Token inválido");
  const userId: string = userData.user.id;

  const [{ data: roleRows }, { data: ownedAgency }, { data: brokerRow }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    db.from("imobiliarias").select("id").eq("owner_id", userId).maybeSingle(),
    db.from("corretores").select("imobiliaria_id").eq("user_id", userId).maybeSingle(),
  ]);

  const roles: string[] = (roleRows ?? []).map((r: any) => r.role);
  const isAdmin = roles.includes("super_admin");
  const isStaff = isAdmin || roles.includes("secretaria");
  const agencyId: string | null = ownedAgency?.id ?? brokerRow?.imobiliaria_id ?? null;

  const role: ApiRole = isAdmin
    ? "ADMIN"
    : roles.includes("secretaria") || roles.includes("imobiliaria")
      ? "GESTOR"
      : "CORRETOR";

  const canWrite = isStaff || roles.includes("imobiliaria");

  return {
    kind: "user",
    role,
    userId,
    agencyId,
    crossTenant: isStaff,
    scopes: canWrite ? ALL_SCOPES : READ_SCOPES,
  };
}
