// Serviços do catálogo no modelo Developer → Building → Typology → Unit.
// Toda regra de visibilidade, sanitização e histórico vive aqui.
import { getFeedSupabase } from "@/lib/feed-supabase.server";
import { ApiError, paginationMeta, parsePagination } from "./response";
import type { Principal } from "./auth.server";
import {
  INTEGRATION_VISIBLE_SHARING,
  PROPERTY_TYPES,
  SHARING_SCOPES,
  TRANSACTION_TYPES,
  UNIT_STATUSES,
  normalizePropertyType,
} from "./scopes";
import {
  applyFieldScope,
  serializeBuilding,
  serializeDeveloper,
  serializeLead,
  serializeMedia,
  serializeTypology,
  serializeUnit,
} from "./serializers";
import { emitWebhook } from "./webhooks.server";

function db(): any {
  const { client, error } = getFeedSupabase();
  if (!client) throw new ApiError("CONFIG_ERROR", error ?? "Backend indisponível");
  return client;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aceita tanto UUID interno quanto id público (bld_..., unt_...). */
function idFilter(query: any, id: string) {
  return UUID_RE.test(id) ? query.eq("id", id) : query.eq("public_id", id);
}

function out<T extends Record<string, any>>(row: T | null, principal: Principal) {
  return row ? applyFieldScope(row, principal.fieldScope) : row;
}

function outList(rows: any[], principal: Principal) {
  return rows.map((r) => applyFieldScope(r, principal.fieldScope));
}

function publicStorageUrl(origin: string, bucket: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${origin}/api/public/img/${encodeURIComponent(bucket)}/${encoded}`;
}

/**
 * A API nova usa unit_media, mas os imóveis já cadastrados guardam as fotos em
 * imovel_imagens. Anexa essas fotos pelo legacy_imovel_id sem exigir migração
 * manual e usa o proxy público, compatível com buckets privados/autohospedados.
 */
async function attachLegacyMedia(rows: any[], origin: string): Promise<any[]> {
  const legacyIds = rows
    .filter((row) => !(row.unit_media?.length) && row.legacy_imovel_id)
    .map((row) => row.legacy_imovel_id as string);
  if (!legacyIds.length) return rows;

  const mediaByImovel = new Map<string, any[]>();
  for (let i = 0; i < legacyIds.length; i += 40) {
    const ids = legacyIds.slice(i, i + 40);
    let offset = 0;
    while (true) {
      const { data, error } = await db()
        .from("imovel_imagens")
        .select("id, imovel_id, storage_path, url, ordem, capa, created_at")
        .in("imovel_id", ids)
        .order("imovel_id", { ascending: true })
        .order("ordem", { ascending: true })
        .range(offset, offset + 999);
      if (error) throw new ApiError("INTERNAL_ERROR", error.message);
      const batch = data ?? [];
      for (const image of batch) {
        const path = image.storage_path || image.url;
        if (!path) continue;
        const current = mediaByImovel.get(image.imovel_id) ?? [];
        current.push({
          id: image.id,
          public_id: null,
          kind: "photo",
          url: /^https?:\/\//i.test(path) ? path : publicStorageUrl(origin, "imoveis", path),
          title: null,
          position: image.ordem ?? 0,
          is_cover: image.capa ?? false,
          created_at: image.created_at,
        });
        mediaByImovel.set(image.imovel_id, current);
      }
      if (batch.length < 1000) break;
      offset += 1000;
    }
  }

  return rows.map((row) => {
    if (row.unit_media?.length || !row.legacy_imovel_id) return row;
    return { ...row, unit_media: mediaByImovel.get(row.legacy_imovel_id) ?? [] };
  });
}

// ---------------------------------------------------------
// Visibilidade
// ---------------------------------------------------------
/** Recorte de tenant + regras de compartilhamento aplicado às unidades. */
function scopeUnits(query: any, principal: Principal) {
  if (principal.crossTenant) return query;
  const shared = INTEGRATION_VISIBLE_SHARING.join(",");
  if (principal.agencyId) {
    // inclui o acervo compartilhado (agency_id nulo)
    return query.or(`agency_id.eq.${principal.agencyId},agency_id.is.null,sharing_scope.in.(${shared})`);
  }
  return query.or(`agency_id.is.null,sharing_scope.in.(${shared})`);
}

function canSeeUnit(row: any, principal: Principal): boolean {
  if (principal.crossTenant) return true;
  if (!row.agency_id) return true;
  if (principal.agencyId && row.agency_id === principal.agencyId) return true;
  return INTEGRATION_VISIBLE_SHARING.includes(row.sharing_scope);
}

function scopeAgency(query: any, principal: Principal) {
  if (principal.crossTenant || !principal.agencyId) return query;
  return query.or(`agency_id.eq.${principal.agencyId},agency_id.is.null`);
}

// ---------------------------------------------------------
// Ordenação / sincronização
// ---------------------------------------------------------
const SORTABLE = new Set(["price", "created_at", "updated_at", "private_area", "name"]);

function applySort(query: any, raw: string | null, fallback = "created_at") {
  const value = raw ?? `-${fallback}`;
  const desc = value.startsWith("-");
  const column = desc ? value.slice(1) : value;
  const col = SORTABLE.has(column) ? column : fallback;
  return query.order(col, { ascending: !desc, nullsFirst: false });
}

function applySync(query: any, params: URLSearchParams) {
  if (params.get("updated_after")) query = query.gte("updated_at", params.get("updated_after"));
  if (params.get("created_after")) query = query.gte("created_at", params.get("created_after"));
  return query;
}

// =========================================================
// DEVELOPERS
// =========================================================
export async function listDevelopers(url: URL, principal: Principal) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("developers").select("*", { count: "exact" }).eq("status", "active");
  const p = url.searchParams;
  if (p.get("q")) query = query.ilike("name", `%${p.get("q")}%`);
  if (p.get("city")) query = query.ilike("city", `%${p.get("city")}%`);
  query = applySync(query, p);
  query = applySort(query, p.get("sort"), "name");
  const { data, error, count } = await query.range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return { data: outList((data ?? []).map(serializeDeveloper), principal), meta: paginationMeta(page, perPage, count ?? 0) };
}

export async function getDeveloper(id: string, principal: Principal) {
  const { data, error } = await idFilter(db().from("developers").select("*"), id).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (!data) throw new ApiError("DEVELOPER_NOT_FOUND", "Construtora não encontrada");
  return out(serializeDeveloper(data), principal);
}

async function resolveInternalId(table: string, id: string, notFound: any, message: string): Promise<string> {
  if (UUID_RE.test(id)) return id;
  const { data } = await db().from(table).select("id").eq("public_id", id).maybeSingle();
  if (!data) throw new ApiError(notFound, message);
  return data.id;
}

// =========================================================
// BUILDINGS (tabela developments)
// =========================================================
const BUILDING_SELECT = "*, developer:developers(id, public_id, name, logo_url, website, status, created_at, updated_at)";

export async function listBuildings(url: URL, principal: Principal, opts?: { developerId?: string }) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("developments").select(BUILDING_SELECT, { count: "exact" });
  query = scopeAgency(query, principal);
  const p = url.searchParams;
  if (opts?.developerId) query = query.eq("developer_id", opts.developerId);
  if (p.get("city")) query = query.ilike("city", `%${p.get("city")}%`);
  if (p.get("state")) query = query.eq("state", p.get("state"));
  if (p.get("neighborhood")) query = query.ilike("neighborhood", `%${p.get("neighborhood")}%`);
  if (p.get("type")) query = query.eq("type", p.get("type"));
  if (p.get("status")) query = query.eq("status", p.get("status"));
  if (p.get("q")) query = query.ilike("name", `%${p.get("q")}%`);
  query = applySync(query, p);
  query = applySort(query, p.get("sort"), "name");
  const { data, error, count } = await query.range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return { data: outList((data ?? []).map(serializeBuilding), principal), meta: paginationMeta(page, perPage, count ?? 0) };
}

export async function getBuildingRow(id: string, principal: Principal) {
  const { data, error } = await idFilter(db().from("developments").select(BUILDING_SELECT), id).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (!data) throw new ApiError("BUILDING_NOT_FOUND", "Empreendimento não encontrado");
  if (!principal.crossTenant && data.agency_id && data.agency_id !== principal.agencyId) {
    throw new ApiError("BUILDING_NOT_FOUND", "Empreendimento não encontrado");
  }
  return data;
}

export async function getBuilding(id: string, principal: Principal) {
  return out(serializeBuilding(await getBuildingRow(id, principal)), principal);
}

// =========================================================
// TYPOLOGIES
// =========================================================
const TYPOLOGY_SELECT = "*, development:developments(id, public_id, name, agency_id)";

export async function listTypologies(url: URL, principal: Principal, buildingId?: string) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("typologies").select(TYPOLOGY_SELECT, { count: "exact" });
  query = scopeAgency(query, principal);
  const p = url.searchParams;
  if (buildingId) query = query.eq("development_id", buildingId);
  const type = normalizePropertyType(p.get("property_type"));
  if (type) query = query.ilike("property_type", `%${type}%`);
  if (p.get("bedrooms")) query = query.gte("bedrooms", Number(p.get("bedrooms")));
  query = applySync(query, p);
  query = applySort(query, p.get("sort"), "name");
  const { data, error, count } = await query.range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return { data: outList((data ?? []).map(serializeTypology), principal), meta: paginationMeta(page, perPage, count ?? 0) };
}

export async function getTypologyRow(id: string, principal: Principal) {
  const { data, error } = await idFilter(db().from("typologies").select(TYPOLOGY_SELECT), id).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (!data) throw new ApiError("TYPOLOGY_NOT_FOUND", "Tipologia não encontrada");
  if (!principal.crossTenant && data.agency_id && data.agency_id !== principal.agencyId) {
    throw new ApiError("TYPOLOGY_NOT_FOUND", "Tipologia não encontrada");
  }
  return data;
}

export async function getTypology(id: string, principal: Principal) {
  return out(serializeTypology(await getTypologyRow(id, principal)), principal);
}

// =========================================================
// UNITS
// =========================================================
const UNIT_SELECT = [
  "*",
  "development:developments(id, public_id, name, type, street, number, neighborhood, city, state, zipcode, latitude, longitude, cover_image, construction_status, delivery_date, amenities, infrastructure, agency_id, status, created_at, updated_at)",
  "typology:typologies(id, public_id, name, property_type, bedrooms, suites, bathrooms, parking_spaces, private_area, total_area, floorplan, created_at, updated_at)",
  "agency:imobiliarias(id, nome_fantasia)",
  "agent:corretores(id, nome, creci)",
  "unit_media(id, public_id, kind, url, title, position, is_cover, created_at)",
  "unit_features(feature)",
].join(", ");

/** Campos aceitos em POST/PATCH — proteção contra mass assignment. */
export const UNIT_WRITABLE = [
  "development_id", "typology_id", "developer_id", "agency_id", "agent_id",
  "unit_number", "tower", "block", "lot", "floor", "orientation", "solar_position",
  "private_area", "total_area", "built_area", "land_area",
  "bedrooms", "suites", "bathrooms", "parking_spaces", "box", "storage",
  "furnished", "decorated", "exclusive", "sea_view", "front_sea",
  "status", "transaction_type", "price", "currency", "property_type",
  "sharing_scope", "reference", "title", "description",
  "city", "state", "neighborhood", "street", "street_number", "postal_code",
  "latitude", "longitude", "delivery_date", "external_id", "external_source",
] as const;

function pick(body: Record<string, unknown>, allowed: readonly string[]) {
  const outObj: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) outObj[key] = body[key];
  }
  return outObj;
}

function validateUnitPayload(payload: Record<string, unknown>) {
  const errors: string[] = [];
  if (payload.status !== undefined && !UNIT_STATUSES.includes(payload.status as any)) {
    errors.push(`status deve ser um de: ${UNIT_STATUSES.join(", ")}`);
  }
  if (payload.transaction_type !== undefined && !TRANSACTION_TYPES.includes(payload.transaction_type as any)) {
    errors.push(`transaction_type deve ser um de: ${TRANSACTION_TYPES.join(", ")}`);
  }
  if (payload.sharing_scope !== undefined && !SHARING_SCOPES.includes(payload.sharing_scope as any)) {
    errors.push(`sharing_scope deve ser um de: ${SHARING_SCOPES.join(", ")}`);
  }
  if (payload.property_type !== undefined && payload.property_type !== null) {
    const normalized = normalizePropertyType(payload.property_type);
    if (!normalized) errors.push(`property_type deve ser um de: ${PROPERTY_TYPES.join(", ")}`);
    else payload.property_type = normalized;
  }
  for (const numeric of ["price", "private_area", "total_area", "bedrooms", "suites", "bathrooms", "parking_spaces", "floor"]) {
    const value = payload[numeric];
    if (value !== undefined && value !== null && Number.isNaN(Number(value))) {
      errors.push(`${numeric} deve ser numérico`);
    }
  }
  if (errors.length) throw new ApiError("VALIDATION_ERROR", "Payload inválido", { errors });
}

export type UnitScopeOpts = { buildingId?: string; typologyId?: string; developerId?: string };

export async function listUnits(url: URL, principal: Principal, opts: UnitScopeOpts = {}) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("units").select(UNIT_SELECT, { count: "exact" });
  query = scopeUnits(query, principal);
  const p = url.searchParams;

  if (opts.buildingId) query = query.eq("development_id", opts.buildingId);
  if (opts.typologyId) query = query.eq("typology_id", opts.typologyId);
  if (opts.developerId) query = query.eq("developer_id", opts.developerId);

  if (p.get("city")) query = query.ilike("city", `%${p.get("city")}%`);
  if (p.get("state")) query = query.eq("state", p.get("state"));
  if (p.get("neighborhood")) query = query.ilike("neighborhood", `%${p.get("neighborhood")}%`);
  if (p.get("street")) query = query.ilike("street", `%${p.get("street")}%`);
  if (p.get("postal_code")) query = query.eq("postal_code", p.get("postal_code"));
  if (p.get("reference")) query = query.eq("reference", p.get("reference"));
  if (p.get("agency_id")) query = query.eq("agency_id", p.get("agency_id"));
  if (p.get("agent_id")) query = query.eq("agent_id", p.get("agent_id"));

  const type = normalizePropertyType(p.get("property_type"));
  if (type) query = query.eq("property_type", type);
  if (p.get("transaction_type")) query = query.eq("transaction_type", p.get("transaction_type"));

  if (p.get("bedrooms")) query = query.gte("bedrooms", Number(p.get("bedrooms")));
  if (p.get("suites")) query = query.gte("suites", Number(p.get("suites")));
  if (p.get("bathrooms")) query = query.gte("bathrooms", Number(p.get("bathrooms")));
  if (p.get("parking_spaces")) query = query.gte("parking_spaces", Number(p.get("parking_spaces")));
  if (p.get("min_price")) query = query.gte("price", Number(p.get("min_price")));
  if (p.get("max_price")) query = query.lte("price", Number(p.get("max_price")));
  if (p.get("min_private_area")) query = query.gte("private_area", Number(p.get("min_private_area")));
  if (p.get("max_private_area")) query = query.lte("private_area", Number(p.get("max_private_area")));

  for (const flag of ["furnished", "decorated", "exclusive", "sea_view", "front_sea"]) {
    if (p.get(flag)) query = query.eq(flag, p.get(flag) === "true");
  }

  if (p.get("status")) query = query.eq("status", p.get("status"));
  else if (p.get("include_archived") !== "true") query = query.neq("status", "archived");

  query = applySync(query, p);
  query = applySort(query, p.get("sort"), "created_at");

  const { data, error, count } = await query.range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  const rows = await attachLegacyMedia(data ?? [], url.origin);
  return { data: outList(rows.map(serializeUnit), principal), meta: paginationMeta(page, perPage, count ?? 0) };
}

export async function getUnitRow(id: string, principal: Principal) {
  const { data, error } = await idFilter(db().from("units").select(UNIT_SELECT), id).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  // resposta idêntica para "não existe" e "sem permissão" → protege contra IDOR
  if (!data || !canSeeUnit(data, principal)) throw new ApiError("UNIT_NOT_FOUND", "Unidade não encontrada");
  return data;
}

export async function getUnit(id: string, principal: Principal, origin?: string) {
  const row = await getUnitRow(id, principal);
  const [withMedia] = origin ? await attachLegacyMedia([row], origin) : [row];
  return out(serializeUnit(withMedia), principal);
}

export async function listUnitMedia(id: string, principal: Principal, origin: string) {
  const unit = await getUnitRow(id, principal);
  const { data, error } = await db()
    .from("unit_media")
    .select("*")
    .eq("unit_id", unit.id)
    .order("position", { ascending: true });
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (data?.length) return data.map(serializeMedia);
  const [withMedia] = await attachLegacyMedia([{ ...unit, unit_media: [] }], origin);
  return (withMedia.unit_media ?? []).map(serializeMedia);
}

async function recordHistory(unitId: string, changes: Record<string, { from: unknown; to: unknown }>, principal: Principal) {
  const rows = Object.entries(changes).map(([field, v]) => ({
    unit_id: unitId,
    field_changed: field,
    old_value: v.from === null || v.from === undefined ? null : String(v.from),
    new_value: v.to === null || v.to === undefined ? null : String(v.to),
    changed_by: principal.userId,
    source: principal.kind === "integration" ? "integration" : "api",
  }));
  if (!rows.length) return;
  try {
    await db().from("unit_history").insert(rows);
  } catch {
    /* histórico nunca derruba a operação */
  }
}

function assertWritableAgency(principal: Principal, agencyId: string | null | undefined) {
  if (principal.crossTenant) return;
  if (!principal.agencyId) throw new ApiError("FORBIDDEN", "Credencial sem imobiliária vinculada");
  if (agencyId && agencyId !== principal.agencyId) throw new ApiError("FORBIDDEN", "Registro pertence a outra imobiliária");
}

export async function createUnit(body: Record<string, unknown>, principal: Principal) {
  const payload = pick(body, UNIT_WRITABLE);
  validateUnitPayload(payload);

  if (payload.development_id) {
    const building = await getBuildingRow(String(payload.development_id), principal);
    payload.development_id = building.id;
    if (!payload.agency_id) payload.agency_id = building.agency_id ?? principal.agencyId;
    if (!payload.developer_id && building.developer_id) payload.developer_id = building.developer_id;
  } else if (!payload.agency_id) {
    payload.agency_id = principal.agencyId;
  }
  if (payload.typology_id) {
    payload.typology_id = await resolveInternalId("typologies", String(payload.typology_id), "TYPOLOGY_NOT_FOUND", "Tipologia não encontrada");
  }
  if (payload.developer_id) {
    payload.developer_id = await resolveInternalId("developers", String(payload.developer_id), "DEVELOPER_NOT_FOUND", "Construtora não encontrada");
  }
  assertWritableAgency(principal, payload.agency_id as string | null);
  payload.created_by = principal.userId;
  if (!payload.sharing_scope) payload.sharing_scope = "agency";

  const { data, error } = await db().from("units").insert(payload).select(UNIT_SELECT).single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  if (!data.reference) {
    const reference = `MV-${String(data.public_id ?? data.id).slice(-8).toUpperCase()}`;
    await db().from("units").update({ reference }).eq("id", data.id);
    data.reference = reference;
  }

  const unit = serializeUnit(data);
  await emitWebhook("unit.created", unit, data.agency_id);
  return out(unit, principal);
}

export async function updateUnit(id: string, body: Record<string, unknown>, principal: Principal) {
  const current = await getUnitRow(id, principal);
  assertWritableAgency(principal, current.agency_id);
  const payload = pick(body, UNIT_WRITABLE);
  validateUnitPayload(payload);
  delete payload.agency_id;

  if (payload.development_id) {
    payload.development_id = (await getBuildingRow(String(payload.development_id), principal)).id;
  }
  if (payload.typology_id) {
    payload.typology_id = await resolveInternalId("typologies", String(payload.typology_id), "TYPOLOGY_NOT_FOUND", "Tipologia não encontrada");
  }

  const { data, error } = await db().from("units").update(payload).eq("id", current.id).select(UNIT_SELECT).single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(payload)) {
    if (String(current[key]) !== String((data as any)[key])) changes[key] = { from: current[key], to: (data as any)[key] };
  }
  await recordHistory(current.id, changes, principal);

  const unit = serializeUnit(data);
  await emitWebhook("unit.updated", unit, data.agency_id);
  if (changes.price) {
    await emitWebhook("unit.price_changed", { id: unit!.id, from: current.price, to: data.price }, data.agency_id);
  }
  if (changes.status) {
    const map: Record<string, any> = { reserved: "unit.reserved", sold: "unit.sold", rented: "unit.rented", archived: "unit.archived" };
    const event = map[String(data.status)];
    if (event) await emitWebhook(event, unit, data.agency_id);
  }
  return out(unit, principal);
}

/** Soft delete: nunca remove a linha, apenas arquiva. */
export async function archiveUnit(id: string, principal: Principal) {
  const current = await getUnitRow(id, principal);
  assertWritableAgency(principal, current.agency_id);
  const { data, error } = await db()
    .from("units")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", current.id)
    .select(UNIT_SELECT)
    .single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  await recordHistory(current.id, { status: { from: current.status, to: "archived" } }, principal);
  const unit = serializeUnit(data);
  await emitWebhook("unit.archived", unit, data.agency_id);
  return out(unit, principal);
}

// =========================================================
// LEADS
// =========================================================
const LEAD_WRITABLE = ["unit_id", "name", "phone", "email", "message", "source"] as const;

export async function createLead(body: Record<string, unknown>, principal: Principal, ip?: string | null) {
  const payload = pick(body, LEAD_WRITABLE);
  if (!payload.name || String(payload.name).trim().length < 2) {
    throw new ApiError("VALIDATION_ERROR", "name é obrigatório");
  }
  if (!payload.phone && !payload.email) {
    throw new ApiError("VALIDATION_ERROR", "Informe ao menos phone ou email");
  }
  if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(payload.email))) {
    throw new ApiError("VALIDATION_ERROR", "email inválido");
  }

  let unit: any = null;
  if (payload.unit_id) {
    unit = await getUnitRow(String(payload.unit_id), principal);
    payload.unit_id = unit.id;
  }

  // anti-spam: mesmo contato + mesma unidade nos últimos 10 minutos
  const since = new Date(Date.now() - 600_000).toISOString();
  let dup = db().from("leads").select("id", { count: "exact", head: true }).gte("created_at", since);
  dup = payload.email ? dup.eq("email", payload.email) : dup.eq("phone", payload.phone);
  if (payload.unit_id) dup = dup.eq("unit_id", payload.unit_id);
  const { count } = await dup;
  if ((count ?? 0) > 0) throw new ApiError("CONFLICT", "Lead duplicado recentemente para este contato");

  const insert = {
    ...payload,
    agency_id: unit?.agency_id ?? principal.agencyId ?? null,
    agent_id: unit?.agent_id ?? null,
    development_id: unit?.development_id ?? null,
    api_key_id: principal.apiKeyId ?? null,
    source: payload.source ?? "api",
    ip: ip ?? null,
  };
  const { data, error } = await db().from("leads").insert(insert).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  await emitWebhook("lead.created", serializeLead(data), data.agency_id);
  return serializeLead(data);
}

export async function listLeads(url: URL, principal: Principal) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("leads").select("*", { count: "exact" });
  query = scopeAgency(query, principal);
  if (url.searchParams.get("status")) query = query.eq("status", url.searchParams.get("status"));
  query = applySync(query, url.searchParams);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return { data: (data ?? []).map(serializeLead), meta: paginationMeta(page, perPage, count ?? 0) };
}
