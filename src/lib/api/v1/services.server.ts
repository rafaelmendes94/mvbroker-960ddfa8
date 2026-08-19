// Camada de serviços da API v1 — toda regra de negócio vive aqui.
// As rotas HTTP são finas e apenas delegam para estas funções.
import { getFeedSupabase } from "@/lib/feed-supabase.server";
import { ApiError, paginationMeta, parsePagination, type Meta } from "./response";
import { assertCanWriteAgency, scopeToTenant, type Principal } from "./auth.server";
import { emitWebhook } from "./webhooks.server";

function db(): any {
  const { client, error } = getFeedSupabase();
  if (!client) throw new ApiError("CONFIG_ERROR", error ?? "Backend indisponível");
  return client;
}

function pick<T extends Record<string, unknown>>(body: T, allowed: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = (body as any)[key];
  }
  return out;
}

function assertPayload(payload: Record<string, unknown>, required: readonly string[]) {
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === null || payload[k] === "");
  if (missing.length) {
    throw new ApiError("VALIDATION_ERROR", `Campos obrigatórios ausentes: ${missing.join(", ")}`, { missing });
  }
}

// =========================================================
// DEVELOPMENTS
// =========================================================
export const DEVELOPMENT_FIELDS = [
  "agency_id", "name", "slug", "type", "description", "developer", "construction_company",
  "address", "street", "number", "complement", "neighborhood", "city", "state", "country",
  "zipcode", "latitude", "longitude", "delivery_date", "construction_status", "total_units",
  "amenities", "infrastructure", "cover_image", "material_url", "status",
  "external_id", "external_source",
] as const;

export async function listDevelopments(url: URL, principal: Principal) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("developments").select("*", { count: "exact" });
  query = scopeToTenant(query, principal);

  const p = url.searchParams;
  if (p.get("city")) query = query.ilike("city", `%${p.get("city")}%`);
  if (p.get("state")) query = query.eq("state", p.get("state"));
  if (p.get("type")) query = query.eq("type", p.get("type"));
  if (p.get("status")) query = query.eq("status", p.get("status"));
  if (p.get("q")) query = query.ilike("name", `%${p.get("q")}%`);

  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return { data: data ?? [], meta: paginationMeta(page, perPage, count ?? 0) as Meta };
}

export async function getDevelopment(id: string, principal: Principal) {
  const { data, error } = await db().from("developments").select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (!data) throw new ApiError("DEVELOPMENT_NOT_FOUND", "Empreendimento não encontrado");
  if (!principal.crossTenant && data.agency_id && data.agency_id !== principal.agencyId) {
    throw new ApiError("DEVELOPMENT_NOT_FOUND", "Empreendimento não encontrado");
  }
  return data;
}

export async function createDevelopment(body: Record<string, unknown>, principal: Principal) {
  const payload = pick(body, DEVELOPMENT_FIELDS);
  assertPayload(payload, ["name"]);
  if (!payload.agency_id && principal.agencyId) payload.agency_id = principal.agencyId;
  assertCanWriteAgency(principal, payload.agency_id as string | null);
  payload.created_by = principal.userId;
  const { data, error } = await db().from("developments").insert(payload).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  await emitWebhook("development.created", data, data.agency_id);
  return data;
}

export async function updateDevelopment(id: string, body: Record<string, unknown>, principal: Principal) {
  const current = await getDevelopment(id, principal);
  assertCanWriteAgency(principal, current.agency_id);
  const payload = pick(body, DEVELOPMENT_FIELDS);
  const { data, error } = await db().from("developments").update(payload).eq("id", id).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

// =========================================================
// TYPOLOGIES
// =========================================================
export const TYPOLOGY_FIELDS = [
  "development_id", "agency_id", "name", "property_type", "bedrooms", "suites", "bathrooms",
  "parking_spaces", "private_area", "total_area", "built_area", "land_area", "description",
  "floorplan", "external_id", "external_source",
] as const;

export async function listTypologies(url: URL, principal: Principal, developmentId?: string) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("typologies").select("*", { count: "exact" });
  if (developmentId) query = query.eq("development_id", developmentId);
  if (url.searchParams.get("property_type")) query = query.eq("property_type", url.searchParams.get("property_type"));
  const { data, error, count } = await query.order("name").range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  void principal;
  return { data: data ?? [], meta: paginationMeta(page, perPage, count ?? 0) };
}

export async function getTypology(id: string) {
  const { data, error } = await db().from("typologies").select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (!data) throw new ApiError("TYPOLOGY_NOT_FOUND", "Tipologia não encontrada");
  return data;
}

export async function createTypology(body: Record<string, unknown>, principal: Principal) {
  const payload = pick(body, TYPOLOGY_FIELDS);
  assertPayload(payload, ["development_id", "name"]);
  const development = await getDevelopment(payload.development_id as string, principal);
  if (!payload.agency_id) payload.agency_id = development.agency_id;
  assertCanWriteAgency(principal, payload.agency_id as string | null);
  const { data, error } = await db().from("typologies").insert(payload).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

export async function updateTypology(id: string, body: Record<string, unknown>, principal: Principal) {
  const current = await getTypology(id);
  assertCanWriteAgency(principal, current.agency_id);
  const payload = pick(body, TYPOLOGY_FIELDS);
  const { data, error } = await db().from("typologies").update(payload).eq("id", id).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

// =========================================================
// UNITS
// =========================================================
export const UNIT_FIELDS = [
  "development_id", "typology_id", "agency_id", "unit_number", "tower", "block", "lot", "floor",
  "orientation", "solar_position", "private_area", "total_area", "built_area", "land_area",
  "bedrooms", "suites", "bathrooms", "parking_spaces", "box", "storage", "furnished", "decorated",
  "status", "delivery_date", "external_id", "external_source",
] as const;

export async function listUnits(url: URL, principal: Principal, opts?: { typologyId?: string; developmentId?: string }) {
  const { page, perPage, from, to } = parsePagination(url);
  let query = db().from("units").select("*", { count: "exact" });
  query = scopeToTenant(query, principal);
  if (opts?.typologyId) query = query.eq("typology_id", opts.typologyId);
  if (opts?.developmentId) query = query.eq("development_id", opts.developmentId);
  const p = url.searchParams;
  if (p.get("status")) query = query.eq("status", p.get("status"));
  if (p.get("bedrooms")) query = query.gte("bedrooms", Number(p.get("bedrooms")));
  if (p.get("suites")) query = query.gte("suites", Number(p.get("suites")));

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return { data: data ?? [], meta: paginationMeta(page, perPage, count ?? 0) };
}

export async function getUnit(id: string, principal: Principal) {
  const { data, error } = await db()
    .from("units")
    .select("*, development:developments(*), typology:typologies(*), offers(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  if (!data) throw new ApiError("UNIT_NOT_FOUND", "Unidade não encontrada");
  if (!principal.crossTenant && data.agency_id && data.agency_id !== principal.agencyId) {
    throw new ApiError("UNIT_NOT_FOUND", "Unidade não encontrada");
  }
  return sanitizeOffers(data, principal);
}

export async function createUnit(body: Record<string, unknown>, principal: Principal) {
  const payload = pick(body, UNIT_FIELDS);
  assertPayload(payload, ["development_id"]);
  const development = await getDevelopment(payload.development_id as string, principal);
  if (!payload.agency_id) payload.agency_id = development.agency_id ?? principal.agencyId;
  assertCanWriteAgency(principal, payload.agency_id as string | null);
  payload.created_by = principal.userId;
  const { data, error } = await db().from("units").insert(payload).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

export async function updateUnit(id: string, body: Record<string, unknown>, principal: Principal) {
  const current = await getUnit(id, principal);
  assertCanWriteAgency(principal, current.agency_id);
  const payload = pick(body, UNIT_FIELDS);
  const { data, error } = await db().from("units").update(payload).eq("id", id).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

// =========================================================
// OFFERS
// =========================================================
export const OFFER_FIELDS = [
  "unit_id", "broker_id", "agency_id", "transaction_type", "sale_price", "promotional_price",
  "rent_price", "condo_fee", "property_tax", "status", "exclusive", "commission_percentage",
  "commission_value", "accepts_vehicle", "accepts_property_exchange", "accepts_financing",
  "accepts_installments", "down_payment", "installments", "annual_reinforcements",
  "monthly_correction", "incc", "payment_conditions", "bonus", "internal_notes", "public_notes",
  "available_from", "external_id", "external_source",
] as const;

/** Observações internas só são expostas a quem pode escrever no registro. */
function sanitizeOffers<T extends Record<string, any>>(row: T, principal: Principal): T {
  const canSeeInternal = principal.crossTenant || principal.role === "GESTOR";
  if (canSeeInternal) return row;
  const strip = (o: any) => (o ? { ...o, internal_notes: undefined } : o);
  if (Array.isArray(row.offers)) return { ...row, offers: row.offers.map(strip) };
  if (row.offer) return { ...row, offer: strip(row.offer) };
  return row;
}

export async function listOffers(unitId: string, principal: Principal) {
  await getUnit(unitId, principal);
  const { data, error } = await db().from("offers").select("*").eq("unit_id", unitId).order("created_at", { ascending: false });
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return sanitizeOffers({ offers: data ?? [] }, principal).offers;
}

export async function createOffer(unitId: string, body: Record<string, unknown>, principal: Principal) {
  const unit = await getUnit(unitId, principal);
  const payload = pick(body, OFFER_FIELDS);
  payload.unit_id = unitId;
  if (!payload.agency_id) payload.agency_id = unit.agency_id ?? principal.agencyId;
  assertCanWriteAgency(principal, payload.agency_id as string | null);
  payload.created_by = principal.userId;
  const { data, error } = await db().from("offers").insert(payload).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

export async function updateOffer(id: string, body: Record<string, unknown>, principal: Principal) {
  const { data: current, error: curErr } = await db().from("offers").select("*").eq("id", id).maybeSingle();
  if (curErr) throw new ApiError("INTERNAL_ERROR", curErr.message);
  if (!current) throw new ApiError("OFFER_NOT_FOUND", "Oferta não encontrada");
  assertCanWriteAgency(principal, current.agency_id);
  const payload = pick(body, OFFER_FIELDS);
  delete payload.unit_id;
  const { data, error } = await db().from("offers").update(payload).eq("id", id).select("*").single();
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return data;
}

// =========================================================
// PROPERTIES — visão agregada (development + typology + unit + offer)
// =========================================================
export async function listProperties(url: URL, principal: Principal) {
  const { page, perPage, from, to } = parsePagination(url);
  const p = url.searchParams;

  const devFilters = ["city", "neighborhood", "development_id", "launch"].some((k) => p.get(k));
  const offerFilters = ["min_price", "max_price", "transaction_type", "exclusive", "broker_id", "offer_status"].some(
    (k) => p.get(k),
  );
  const typologyFilters = ["property_type"].some((k) => p.get(k));

  const select = [
    "id, unit_number, tower, block, lot, floor, private_area, total_area, built_area, land_area,",
    "bedrooms, suites, bathrooms, parking_spaces, box, status, agency_id, created_at,",
    `development:developments${devFilters ? "!inner" : ""}(id, name, type, city, neighborhood, street, number, state, latitude, longitude, cover_image, construction_status),`,
    `typology:typologies${typologyFilters ? "!inner" : ""}(id, name, property_type, bedrooms, suites, bathrooms, parking_spaces, private_area, total_area),`,
    `offers${offerFilters ? "!inner" : ""}(id, transaction_type, sale_price, promotional_price, rent_price, condo_fee, property_tax, status, exclusive, accepts_financing, accepts_property_exchange, payment_conditions, public_notes, broker_id)`,
  ].join(" ");

  let query = db().from("units").select(select, { count: "exact" });
  query = scopeToTenant(query, principal);

  if (p.get("city")) query = query.ilike("developments.city", `%${p.get("city")}%`);
  if (p.get("neighborhood")) query = query.ilike("developments.neighborhood", `%${p.get("neighborhood")}%`);
  if (p.get("development_id")) query = query.eq("developments.id", p.get("development_id"));
  if (p.get("launch")) query = query.eq("developments.construction_status", p.get("launch"));
  if (p.get("property_type")) query = query.ilike("typologies.property_type", `%${p.get("property_type")}%`);

  if (p.get("bedrooms")) query = query.gte("bedrooms", Number(p.get("bedrooms")));
  if (p.get("suites")) query = query.gte("suites", Number(p.get("suites")));
  if (p.get("parking")) query = query.gte("parking_spaces", Number(p.get("parking")));
  if (p.get("min_area")) query = query.gte("private_area", Number(p.get("min_area")));
  if (p.get("max_area")) query = query.lte("private_area", Number(p.get("max_area")));
  if (p.get("status")) query = query.eq("status", p.get("status"));
  if (p.get("agency_id")) query = query.eq("agency_id", p.get("agency_id"));

  if (p.get("min_price")) query = query.gte("offers.sale_price", Number(p.get("min_price")));
  if (p.get("max_price")) query = query.lte("offers.sale_price", Number(p.get("max_price")));
  if (p.get("transaction_type")) query = query.eq("offers.transaction_type", p.get("transaction_type"));
  if (p.get("offer_status")) query = query.eq("offers.status", p.get("offer_status"));
  if (p.get("exclusive")) query = query.eq("offers.exclusive", p.get("exclusive") === "true");
  if (p.get("broker_id")) query = query.eq("offers.broker_id", p.get("broker_id"));

  const sort = p.get("sort") ?? "created_desc";
  const sortMap: Record<string, [string, boolean]> = {
    created_desc: ["created_at", false],
    created_asc: ["created_at", true],
    area_desc: ["private_area", false],
    area_asc: ["private_area", true],
  };
  const [sortCol, asc] = sortMap[sort] ?? sortMap.created_desc;
  query = query.order(sortCol, { ascending: asc, nullsFirst: false });

  const { data, error, count } = await query.range(from, to);
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  const rows = (data ?? []).map((row: any) => {
    const offers = Array.isArray(row.offers) ? row.offers : [];
    const active = offers.find((o: any) => o.status === "available") ?? offers[0] ?? null;
    const { offers: _drop, development, typology, ...unit } = row;
    return sanitizeOffers(
      {
        id: unit.id,
        development: development ?? null,
        typology: typology ?? null,
        unit,
        offer: active,
      },
      principal,
    );
  });

  return { data: rows, meta: paginationMeta(page, perPage, count ?? 0) };
}
