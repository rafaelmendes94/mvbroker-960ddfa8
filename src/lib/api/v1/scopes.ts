// Escopos, enums normalizados e vocabulário público da API MV Broker v1.

export const SCOPES = [
  "developers:read",
  "developers:write",
  "buildings:read",
  "buildings:write",
  "typologies:read",
  "typologies:write",
  "units:read",
  "units:write",
  "media:read",
  "media:write",
  "leads:read",
  "leads:write",
  "reports:read",
] as const;

export type Scope = (typeof SCOPES)[number];

export const READ_SCOPES: Scope[] = SCOPES.filter((s) => s.endsWith(":read"));

/** Escopos herdados da versão anterior da API (developments:* → buildings:*). */
const LEGACY_SCOPE_MAP: Record<string, Scope> = {
  "developments:read": "buildings:read",
  "developments:write": "buildings:write",
  "offers:read": "units:read",
  "offers:write": "units:write",
  "catalogs:read": "reports:read",
  "catalogs:write": "reports:read",
  "brokers:read": "reports:read",
  "brokers:write": "reports:read",
};

export function normalizeScopes(raw: unknown): Scope[] {
  const list = Array.isArray(raw) ? raw : [];
  const out = new Set<Scope>();
  for (const item of list) {
    const value = String(item);
    if ((SCOPES as readonly string[]).includes(value)) out.add(value as Scope);
    else if (LEGACY_SCOPE_MAP[value]) out.add(LEGACY_SCOPE_MAP[value]);
  }
  return [...out];
}

// ---------------------------------------------------------
// Status / transação / tipo de imóvel — vocabulário fechado
// ---------------------------------------------------------
export const UNIT_STATUSES = ["available", "reserved", "sold", "rented", "inactive", "archived"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const TRANSACTION_TYPES = ["sale", "rent", "seasonal_rent"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "penthouse",
  "studio",
  "land",
  "office",
  "commercial",
  "warehouse",
  "farm",
  "development_unit",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

const PROPERTY_TYPE_ALIASES: Record<string, PropertyType> = {
  apartamento: "apartment", apto: "apartment", "apto.": "apartment", ap: "apartment",
  apartament: "apartment", flat: "apartment", apartment: "apartment",
  casa: "house", sobrado: "house", "casa em condominio": "house", "casa de condominio": "house",
  residencia: "house", house: "house",
  cobertura: "penthouse", penthouse: "penthouse", duplex: "penthouse",
  studio: "studio", "studio/loft": "studio", loft: "studio", kitnet: "studio", jk: "studio",
  terreno: "land", lote: "land", "area": "land", gleba: "land", land: "land",
  sala: "office", "sala comercial": "office", conjunto: "office", escritorio: "office", office: "office",
  loja: "commercial", "ponto comercial": "commercial", comercial: "commercial", commercial: "commercial",
  pavilhao: "warehouse", galpao: "warehouse", deposito: "warehouse", barracao: "warehouse", warehouse: "warehouse",
  fazenda: "farm", sitio: "farm", chacara: "farm", rural: "farm", farm: "farm",
};

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Converte qualquer grafia livre num tipo de imóvel padronizado. */
export function normalizePropertyType(raw: unknown): PropertyType | null {
  if (!raw) return null;
  const key = slug(String(raw));
  if (!key) return null;
  if (PROPERTY_TYPE_ALIASES[key]) return PROPERTY_TYPE_ALIASES[key];
  for (const [alias, value] of Object.entries(PROPERTY_TYPE_ALIASES)) {
    if (key.includes(alias)) return value;
  }
  return null;
}

export const SHARING_SCOPES = ["private", "agency", "network", "public_api"] as const;
export type SharingScope = (typeof SHARING_SCOPES)[number];

/** Compartilhamentos visíveis para uma integração externa (API Key). */
export const INTEGRATION_VISIBLE_SHARING: SharingScope[] = ["network", "public_api"];
