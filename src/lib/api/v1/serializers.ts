// Serializadores públicos: só campos explicitamente permitidos saem da API.
// Nenhum campo interno (comissão, proprietário, observações internas, documentos)
// é exposto — mesmo que exista na linha do banco.
import { normalizePropertyType } from "./scopes";

/** Aplica o recorte de campos configurado na API Key (field_scope). */
export function applyFieldScope<T extends Record<string, any>>(row: T, fields?: string[] | null): Record<string, any> {
  if (!fields || fields.length === 0) return row;
  const keep = new Set([...fields, "id", "public_id"]);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) if (keep.has(k)) out[k] = v;
  return out;
}

export function serializeDeveloper(row: any) {
  if (!row) return null;
  return {
    id: row.public_id ?? row.id,
    uuid: row.id,
    name: row.name,
    slug: row.slug ?? null,
    website: row.website ?? null,
    logo_url: row.logo_url ?? null,
    description: row.description ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    status: row.status ?? "active",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeBuilding(row: any) {
  if (!row) return null;
  return {
    id: row.public_id ?? row.id,
    uuid: row.id,
    name: row.name,
    slug: row.slug ?? null,
    type: row.type ?? null,
    developer_id: row.developer?.public_id ?? row.developer_id ?? null,
    developer: row.developer ? serializeDeveloper(row.developer) : undefined,
    construction_company: row.construction_company ?? row.developer_name ?? null,
    description: row.description ?? null,
    address: {
      street: row.street ?? null,
      number: row.number ?? null,
      complement: row.complement ?? null,
      neighborhood: row.neighborhood ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      postal_code: row.zipcode ?? null,
      country: row.country ?? "BR",
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    },
    status: row.status ?? null,
    construction_status: row.construction_status ?? null,
    delivery_date: row.delivery_date ?? null,
    total_units: row.total_units ?? null,
    amenities: row.amenities ?? [],
    infrastructure: row.infrastructure ?? [],
    cover_image: row.cover_image ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeTypology(row: any) {
  if (!row) return null;
  return {
    id: row.public_id ?? row.id,
    uuid: row.id,
    building_id: row.development?.public_id ?? row.development_id ?? null,
    name: row.name,
    property_type: normalizePropertyType(row.property_type) ?? row.property_type ?? null,
    bedrooms: row.bedrooms ?? null,
    suites: row.suites ?? null,
    bathrooms: row.bathrooms ?? null,
    parking_spaces: row.parking_spaces ?? null,
    private_area: row.private_area ?? null,
    total_area: row.total_area ?? null,
    built_area: row.built_area ?? null,
    land_area: row.land_area ?? null,
    description: row.description ?? null,
    floorplan: row.floorplan ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeMedia(row: any) {
  if (!row) return null;
  return {
    id: row.public_id ?? row.id,
    kind: row.kind ?? "photo",
    url: row.url,
    title: row.title ?? null,
    position: row.position ?? 0,
    is_cover: row.is_cover ?? false,
    created_at: row.created_at,
  };
}

export function serializeUnit(row: any) {
  if (!row) return null;
  const typology = row.typology ?? null;
  const building = row.development ?? null;
  const agency = row.agency ?? null;
  const agent = row.agent ?? null;

  return {
    id: row.public_id ?? row.id,
    uuid: row.id,
    reference: row.reference ?? null,
    building_id: building?.public_id ?? row.development_id ?? null,
    typology_id: typology?.public_id ?? row.typology_id ?? null,
    developer_id: row.developer?.public_id ?? row.developer_id ?? null,
    unit_number: row.unit_number ?? null,
    tower: row.tower ?? null,
    block: row.block ?? null,
    lot: row.lot ?? null,
    floor: row.floor ?? null,
    status: row.status ?? null,
    transaction_type: row.transaction_type ?? "sale",
    price: row.price ?? null,
    currency: row.currency ?? "BRL",
    property_type:
      normalizePropertyType(row.property_type) ?? normalizePropertyType(typology?.property_type) ?? null,
    bedrooms: row.bedrooms ?? typology?.bedrooms ?? null,
    suites: row.suites ?? typology?.suites ?? null,
    bathrooms: row.bathrooms ?? typology?.bathrooms ?? null,
    parking_spaces: row.parking_spaces ?? typology?.parking_spaces ?? null,
    private_area: row.private_area ?? typology?.private_area ?? null,
    total_area: row.total_area ?? typology?.total_area ?? null,
    built_area: row.built_area ?? null,
    land_area: row.land_area ?? null,
    furnished: row.furnished ?? false,
    decorated: row.decorated ?? false,
    exclusive: row.exclusive ?? false,
    sea_view: row.sea_view ?? false,
    front_sea: row.front_sea ?? false,
    orientation: row.orientation ?? null,
    solar_position: row.solar_position ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    address: {
      street: row.street ?? building?.street ?? null,
      number: row.street_number ?? building?.number ?? null,
      neighborhood: row.neighborhood ?? building?.neighborhood ?? null,
      city: row.city ?? building?.city ?? null,
      state: row.state ?? building?.state ?? null,
      postal_code: row.postal_code ?? building?.zipcode ?? null,
      latitude: row.latitude ?? building?.latitude ?? null,
      longitude: row.longitude ?? building?.longitude ?? null,
    },
    features: Array.isArray(row.unit_features) ? row.unit_features.map((f: any) => f.feature) : [],
    media: Array.isArray(row.unit_media) ? row.unit_media.map(serializeMedia) : [],
    building: building ? serializeBuilding(building) : undefined,
    typology: typology ? serializeTypology(typology) : undefined,
    agency: agency ? { id: agency.id, name: agency.nome_fantasia ?? null } : null,
    agent: agent ? { id: agent.id, name: agent.nome ?? null, creci: agent.creci ?? null } : null,
    delivery_date: row.delivery_date ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeLead(row: any) {
  if (!row) return null;
  return {
    id: row.public_id ?? row.id,
    unit_id: row.unit_id ?? null,
    name: row.name,
    phone: row.phone ?? null,
    email: row.email ?? null,
    message: row.message ?? null,
    source: row.source ?? "api",
    status: row.status ?? "new",
    created_at: row.created_at,
  };
}
