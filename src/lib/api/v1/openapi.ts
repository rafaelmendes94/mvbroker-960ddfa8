// Documentação OpenAPI 3.1 da API MV Broker v1.

const envelope = (dataSchema: unknown) => ({
  type: "object",
  properties: {
    success: { type: "boolean" },
    data: dataSchema,
    meta: { $ref: "#/components/schemas/Meta" },
  },
});

const listParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
];

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "MV Broker API",
      version: "1.0.0",
      description:
        "API central do MV Broker. Estrutura: Empreendimento → Tipologia → Unidade → Oferta. " +
        "Autentique com `Authorization: Bearer <JWT>` (usuário logado) ou `Authorization: Bearer <API Key>` (integrações).",
    },
    servers: [
      { url: `${baseUrl}/api/v1`, description: "Uso interno (app web / mobile)" },
      { url: `${baseUrl}/api/public/v1`, description: "Integrações externas" },
    ],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "developments", description: "Empreendimentos" },
      { name: "typologies", description: "Tipologias / plantas" },
      { name: "units", description: "Unidades físicas" },
      { name: "offers", description: "Ofertas comerciais" },
      { name: "properties", description: "Visão agregada para busca" },
    ],
    paths: {
      "/health": {
        get: { summary: "Status da API", security: [], responses: { "200": { description: "OK" } } },
      },
      "/developments": {
        get: {
          tags: ["developments"],
          summary: "Lista empreendimentos",
          parameters: [
            ...listParams,
            { name: "city", in: "query", schema: { type: "string" } },
            { name: "state", in: "query", schema: { type: "string" } },
            { name: "type", in: "query", schema: { type: "string", enum: ["edificio", "condominio", "loteamento", "empreendimento"] } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "q", in: "query", description: "Busca por nome", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Lista paginada" } },
        },
        post: {
          tags: ["developments"],
          summary: "Cria empreendimento",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Development" } } } },
          responses: { "201": { description: "Criado" }, "422": { description: "Validação" } },
        },
      },
      "/developments/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["developments"], summary: "Detalha empreendimento", responses: { "200": { description: "OK" }, "404": { description: "Não encontrado" } } },
        patch: {
          tags: ["developments"],
          summary: "Atualiza empreendimento",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Development" } } } },
          responses: { "200": { description: "Atualizado" } },
        },
      },
      "/developments/{id}/typologies": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["typologies"], summary: "Tipologias do empreendimento", responses: { "200": { description: "OK" } } },
      },
      "/developments/{id}/units": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["units"], summary: "Unidades do empreendimento", responses: { "200": { description: "OK" } } },
      },
      "/typologies": {
        get: { tags: ["typologies"], summary: "Lista tipologias", parameters: [...listParams, { name: "development_id", in: "query", schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" } } },
        post: { tags: ["typologies"], summary: "Cria tipologia", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Typology" } } } }, responses: { "201": { description: "Criado" } } },
      },
      "/typologies/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["typologies"], summary: "Detalha tipologia", responses: { "200": { description: "OK" } } },
        patch: { tags: ["typologies"], summary: "Atualiza tipologia", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Typology" } } } }, responses: { "200": { description: "OK" } } },
      },
      "/typologies/{id}/units": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["units"], summary: "Unidades da tipologia", responses: { "200": { description: "OK" } } },
      },
      "/units": {
        get: { tags: ["units"], summary: "Lista unidades", parameters: [...listParams, { name: "status", in: "query", schema: { type: "string" } }, { name: "bedrooms", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "OK" } } },
        post: { tags: ["units"], summary: "Cria unidade", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Unit" } } } }, responses: { "201": { description: "Criado" } } },
      },
      "/units/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["units"], summary: "Detalha unidade (com empreendimento, tipologia e ofertas)", responses: { "200": { description: "OK" } } },
        patch: { tags: ["units"], summary: "Atualiza unidade", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Unit" } } } }, responses: { "200": { description: "OK" } } },
      },
      "/units/{id}/offers": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["offers"], summary: "Ofertas da unidade", responses: { "200": { description: "OK" } } },
        post: { tags: ["offers"], summary: "Cria oferta", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Offer" } } } }, responses: { "201": { description: "Criado" } } },
      },
      "/offers/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        patch: { tags: ["offers"], summary: "Atualiza oferta", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Offer" } } } }, responses: { "200": { description: "OK" } } },
      },
      "/properties": {
        get: {
          tags: ["properties"],
          summary: "Busca agregada de imóveis",
          parameters: [
            ...listParams,
            { name: "city", in: "query", schema: { type: "string" } },
            { name: "neighborhood", in: "query", schema: { type: "string" } },
            { name: "development_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "property_type", in: "query", schema: { type: "string" } },
            { name: "bedrooms", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "suites", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "parking", in: "query", description: "Mínimo", schema: { type: "integer" } },
            { name: "min_area", in: "query", schema: { type: "number" } },
            { name: "max_area", in: "query", schema: { type: "number" } },
            { name: "min_price", in: "query", schema: { type: "number" } },
            { name: "max_price", in: "query", schema: { type: "number" } },
            { name: "transaction_type", in: "query", schema: { type: "string", enum: ["sale", "rent"] } },
            { name: "exclusive", in: "query", schema: { type: "boolean" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "sort", in: "query", schema: { type: "string", enum: ["created_desc", "created_asc", "area_desc", "area_asc"] } },
          ],
          responses: { "200": { description: "Lista paginada com empreendimento, tipologia, unidade e oferta ativa" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "JWT do usuário ou API Key (mvb_live_...)" },
      },
      schemas: {
        Meta: {
          type: "object",
          properties: {
            page: { type: "integer" },
            per_page: { type: "integer" },
            total: { type: "integer" },
            total_pages: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [false] },
            error: {
              type: "object",
              properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
            },
          },
        },
        Development: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["edificio", "condominio", "loteamento", "empreendimento"] },
            description: { type: "string" },
            developer: { type: "string" },
            construction_company: { type: "string" },
            street: { type: "string" },
            number: { type: "string" },
            neighborhood: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zipcode: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            construction_status: { type: "string" },
            total_units: { type: "integer" },
            amenities: { type: "array", items: { type: "string" } },
            material_url: { type: "string" },
            status: { type: "string" },
          },
        },
        Typology: {
          type: "object",
          required: ["development_id", "name"],
          properties: {
            development_id: { type: "string", format: "uuid" },
            name: { type: "string" },
            property_type: { type: "string" },
            bedrooms: { type: "integer" },
            suites: { type: "integer" },
            bathrooms: { type: "integer" },
            parking_spaces: { type: "integer" },
            private_area: { type: "number" },
            total_area: { type: "number" },
            floorplan: { type: "string" },
          },
        },
        Unit: {
          type: "object",
          required: ["development_id"],
          properties: {
            development_id: { type: "string", format: "uuid" },
            typology_id: { type: "string", format: "uuid" },
            unit_number: { type: "string" },
            tower: { type: "string" },
            block: { type: "string" },
            lot: { type: "string" },
            floor: { type: "integer" },
            private_area: { type: "number" },
            total_area: { type: "number" },
            bedrooms: { type: "integer" },
            suites: { type: "integer" },
            bathrooms: { type: "integer" },
            parking_spaces: { type: "integer" },
            status: { type: "string", enum: ["available", "reserved", "sold", "rented", "unavailable"] },
          },
        },
        Offer: {
          type: "object",
          properties: {
            transaction_type: { type: "string", enum: ["sale", "rent"] },
            sale_price: { type: "number" },
            promotional_price: { type: "number" },
            rent_price: { type: "number" },
            condo_fee: { type: "number" },
            property_tax: { type: "number" },
            status: { type: "string", enum: ["available", "reserved", "sold", "rented", "inactive"] },
            exclusive: { type: "boolean" },
            commission_percentage: { type: "number" },
            accepts_financing: { type: "boolean" },
            accepts_property_exchange: { type: "boolean" },
            payment_conditions: { type: "array", items: { type: "string" } },
            public_notes: { type: "string" },
          },
        },
        ResponseEnvelope: envelope({}),
      },
    },
  };
}
