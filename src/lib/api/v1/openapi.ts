// Documentação OpenAPI 3.1 da API MV Broker v1.
// Modelo de organização inspirado no padrão Órulo:
// Developer (construtora) → Building (empreendimento) → Typology (planta) → Unit (unidade).
import { PROPERTY_TYPES, SCOPES, SHARING_SCOPES, TRANSACTION_TYPES, UNIT_STATUSES } from "./scopes";
import { WEBHOOK_EVENTS } from "./webhooks.server";

const listParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
  { name: "sort", in: "query", description: "Campo de ordenação; prefixe com '-' para descendente.", schema: { type: "string", enum: ["created_at", "-created_at", "updated_at", "-updated_at", "price", "-price", "private_area", "-private_area", "name", "-name"] } },
  { name: "updated_after", in: "query", description: "Sincronização incremental (ISO 8601).", schema: { type: "string", format: "date-time" } },
  { name: "created_after", in: "query", schema: { type: "string", format: "date-time" } },
];

const idParam = (name: string, example: string) => ({
  name,
  in: "path",
  required: true,
  description: "Aceita o id público (ex.: " + example + ") ou o UUID interno.",
  schema: { type: "string" },
});

const listResponse = {
  "200": { description: "Lista paginada" },
  "401": { description: "Credencial ausente ou inválida" },
  "403": { description: "Escopo insuficiente" },
  "429": { description: "Rate limit excedido" },
};

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "MV Broker API",
      version: "1.0.0",
      description: [
        "API central do MV Broker.",
        "",
        "**Organização das propriedades** (padrão Órulo):",
        "`Developer` (construtora) → `Building` (empreendimento) → `Typology` (planta) → `Unit` (unidade à venda).",
        "",
        "**Autenticação**: `Authorization: Bearer <API Key>` (`mvb_live_...` ou `mvb_test_...`) para integrações,",
        "ou `Authorization: Bearer <JWT>` para o app logado.",
        "",
        "**Envelope**: sucesso `{ success: true, data, meta }`; erro `{ success: false, error: { code, message } }`.",
        "",
        "**Rate limit**: informado nos cabeçalhos `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`.",
        "Toda resposta traz `X-Request-Id` para rastreio.",
        "",
        "**Sincronização incremental**: use `updated_after` para buscar somente o que mudou.",
      ].join("\n"),
    },
    servers: [
      { url: `${baseUrl}/api/public/v1`, description: "Integrações externas" },
      { url: `${baseUrl}/api/v1`, description: "Uso interno (app web / mobile)" },
    ],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "developers", description: "Construtoras / incorporadoras" },
      { name: "buildings", description: "Empreendimentos" },
      { name: "typologies", description: "Tipologias / plantas" },
      { name: "units", description: "Unidades à venda" },
      { name: "media", description: "Fotos, plantas, vídeos e tours" },
      { name: "leads", description: "Captação de interessados" },
    ],
    paths: {
      "/health": { get: { summary: "Status da API", security: [], responses: { "200": { description: "OK" } } } },

      "/developers": {
        get: {
          tags: ["developers"],
          summary: "Lista construtoras",
          parameters: [...listParams, { name: "q", in: "query", schema: { type: "string" } }, { name: "city", in: "query", schema: { type: "string" } }],
          responses: listResponse,
        },
      },
      "/developers/{id}": {
        parameters: [idParam("id", "dev_a1b2c3")],
        get: { tags: ["developers"], summary: "Detalha construtora", responses: { "200": { description: "OK" }, "404": { description: "DEVELOPER_NOT_FOUND" } } },
      },
      "/developers/{id}/buildings": {
        parameters: [idParam("id", "dev_a1b2c3")],
        get: { tags: ["buildings"], summary: "Empreendimentos da construtora", parameters: listParams, responses: listResponse },
      },

      "/buildings": {
        get: {
          tags: ["buildings"],
          summary: "Lista empreendimentos",
          parameters: [
            ...listParams,
            { name: "city", in: "query", schema: { type: "string" } },
            { name: "state", in: "query", schema: { type: "string" } },
            { name: "neighborhood", in: "query", schema: { type: "string" } },
            { name: "type", in: "query", schema: { type: "string", enum: ["edificio", "condominio", "loteamento", "empreendimento", "avulso"] } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "q", in: "query", description: "Busca por nome", schema: { type: "string" } },
          ],
          responses: listResponse,
        },
      },
      "/buildings/{id}": {
        parameters: [idParam("id", "bld_a1b2c3")],
        get: { tags: ["buildings"], summary: "Detalha empreendimento", responses: { "200": { description: "OK" }, "404": { description: "BUILDING_NOT_FOUND" } } },
      },
      "/buildings/{id}/typologies": {
        parameters: [idParam("id", "bld_a1b2c3")],
        get: { tags: ["typologies"], summary: "Tipologias do empreendimento", parameters: listParams, responses: listResponse },
      },
      "/buildings/{id}/units": {
        parameters: [idParam("id", "bld_a1b2c3")],
        get: { tags: ["units"], summary: "Unidades do empreendimento", parameters: listParams, responses: listResponse },
      },

      "/typologies": {
        get: {
          tags: ["typologies"],
          summary: "Lista tipologias",
          parameters: [...listParams, { name: "building_id", in: "query", schema: { type: "string" } }, { name: "property_type", in: "query", schema: { type: "string", enum: PROPERTY_TYPES } }, { name: "bedrooms", in: "query", description: "Mínimo", schema: { type: "integer" } }],
          responses: listResponse,
        },
      },
      "/typologies/{id}": {
        parameters: [idParam("id", "typ_a1b2c3")],
        get: { tags: ["typologies"], summary: "Detalha tipologia", responses: { "200": { description: "OK" }, "404": { description: "TYPOLOGY_NOT_FOUND" } } },
      },
      "/typologies/{id}/units": {
        parameters: [idParam("id", "typ_a1b2c3")],
        get: { tags: ["units"], summary: "Unidades da tipologia", parameters: listParams, responses: listResponse },
      },

      "/units": {
        get: {
          tags: ["units"],
          summary: "Busca de unidades",
          description: "Também disponível em `/properties` (alias). Unidades arquivadas ficam ocultas por padrão.",
          parameters: [
            ...listParams,
            { name: "city", in: "query", schema: { type: "string" } },
            { name: "state", in: "query", schema: { type: "string" } },
            { name: "neighborhood", in: "query", schema: { type: "string" } },
            { name: "street", in: "query", schema: { type: "string" } },
            { name: "postal_code", in: "query", schema: { type: "string" } },
            { name: "reference", in: "query", description: "Código do imóvel", schema: { type: "string" } },
            { name: "property_type", in: "query", schema: { type: "string", enum: PROPERTY_TYPES } },
            { name: "transaction_type", in: "query", schema: { type: "string", enum: TRANSACTION_TYPES } },
            { name: "status", in: "query", schema: { type: "string", enum: UNIT_STATUSES } },
            { name: "bedrooms", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "suites", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "bathrooms", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "parking_spaces", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "min_price", in: "query", schema: { type: "number" } },
            { name: "max_price", in: "query", schema: { type: "number" } },
            { name: "min_private_area", in: "query", schema: { type: "number" } },
            { name: "max_private_area", in: "query", schema: { type: "number" } },
            { name: "furnished", in: "query", schema: { type: "boolean" } },
            { name: "decorated", in: "query", schema: { type: "boolean" } },
            { name: "exclusive", in: "query", schema: { type: "boolean" } },
            { name: "sea_view", in: "query", schema: { type: "boolean" } },
            { name: "front_sea", in: "query", schema: { type: "boolean" } },
            { name: "include_archived", in: "query", schema: { type: "boolean", default: false } },
          ],
          responses: listResponse,
        },
        post: {
          tags: ["units"],
          summary: "Cria unidade",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UnitInput" } } } },
          responses: { "201": { description: "Criada" }, "422": { description: "VALIDATION_ERROR" } },
        },
      },
      "/units/{id}": {
        parameters: [idParam("id", "unt_a1b2c3")],
        get: { tags: ["units"], summary: "Detalha unidade (com empreendimento, tipologia, mídias e características)", responses: { "200": { description: "OK" }, "404": { description: "UNIT_NOT_FOUND" } } },
        patch: {
          tags: ["units"],
          summary: "Atualiza unidade",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UnitInput" } } } },
          responses: { "200": { description: "Atualizada" } },
        },
        delete: { tags: ["units"], summary: "Arquiva unidade (soft delete — o registro nunca é apagado)", responses: { "200": { description: "Arquivada" } } },
      },
      "/units/{id}/media": {
        parameters: [idParam("id", "unt_a1b2c3")],
        get: { tags: ["media"], summary: "Mídias da unidade", responses: { "200": { description: "OK" } } },
      },

      "/leads": {
        get: { tags: ["leads"], summary: "Lista leads da imobiliária", parameters: [...listParams, { name: "status", in: "query", schema: { type: "string" } }], responses: listResponse },
        post: {
          tags: ["leads"],
          summary: "Registra um interessado",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LeadInput" } } } },
          responses: { "201": { description: "Criado" }, "409": { description: "CONFLICT — lead duplicado recentemente" }, "422": { description: "VALIDATION_ERROR" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: `API Key (mvb_live_... / mvb_test_...) ou JWT do usuário. Escopos disponíveis: ${SCOPES.join(", ")}.`,
        },
      },
      schemas: {
        Meta: {
          type: "object",
          properties: { page: { type: "integer" }, per_page: { type: "integer" }, total: { type: "integer" }, total_pages: { type: "integer" } },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [false] },
            error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} } },
          },
        },
        UnitInput: {
          type: "object",
          properties: {
            development_id: { type: "string", description: "id público ou UUID do empreendimento" },
            typology_id: { type: "string" },
            reference: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            unit_number: { type: "string" },
            tower: { type: "string" },
            block: { type: "string" },
            lot: { type: "string" },
            floor: { type: "integer" },
            property_type: { type: "string", enum: PROPERTY_TYPES },
            transaction_type: { type: "string", enum: TRANSACTION_TYPES },
            status: { type: "string", enum: UNIT_STATUSES },
            sharing_scope: { type: "string", enum: SHARING_SCOPES, description: "Quem enxerga a unidade fora da imobiliária dona." },
            price: { type: "number" },
            currency: { type: "string", default: "BRL" },
            private_area: { type: "number" },
            total_area: { type: "number" },
            bedrooms: { type: "integer" },
            suites: { type: "integer" },
            bathrooms: { type: "integer" },
            parking_spaces: { type: "integer" },
            furnished: { type: "boolean" },
            decorated: { type: "boolean" },
            exclusive: { type: "boolean" },
            sea_view: { type: "boolean" },
            city: { type: "string" },
            state: { type: "string" },
            neighborhood: { type: "string" },
            street: { type: "string" },
            street_number: { type: "string" },
            postal_code: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            external_id: { type: "string" },
            external_source: { type: "string" },
          },
        },
        LeadInput: {
          type: "object",
          required: ["name"],
          properties: {
            unit_id: { type: "string", description: "id público ou UUID da unidade" },
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", format: "email" },
            message: { type: "string" },
            source: { type: "string" },
          },
        },
      },
    },
    "x-webhook-events": WEBHOOK_EVENTS,
  };
}
