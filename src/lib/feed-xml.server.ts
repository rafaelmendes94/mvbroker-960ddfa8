// XML feed generators. Server-only.

function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cdata(s: unknown): string {
  if (s === null || s === undefined || s === "") return "";
  const t = String(s).replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${t}]]>`;
}

type ImovelRow = Record<string, any>;
type ImagemRow = { url: string | null; storage_path: string; ordem: number; capa: boolean };

const TIPO_MAP_VRSYNC: Record<string, string> = {
  apartamento: "Residential / Apartment",
  cobertura: "Residential / Apartment",
  casa: "Residential / Home",
  casa_condominio: "Residential / Home",
  terreno: "Land / Lot",
  loteamento: "Land / Lot",
  comercial: "Commercial / Office",
  sala_comercial: "Commercial / Office",
  galpao: "Commercial / Warehouse",
  loja: "Commercial / Storefront",
  rural: "Farm / Ranch",
};

const TIPO_MAP_PT: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  casa_condominio: "Casa de Condomínio",
  cobertura: "Cobertura",
  terreno: "Terreno",
  comercial: "Comercial",
  sala_comercial: "Sala Comercial",
  galpao: "Galpão",
  loja: "Loja",
  rural: "Fazenda / Sítio",
};

function mapTipoVRSync(t?: string | null): string {
  if (!t) return "Residential / Apartment";
  return TIPO_MAP_VRSYNC[t] ?? "Residential / Apartment";
}

function mapTipoPT(t?: string | null): string {
  if (!t) return "Outros";
  return TIPO_MAP_PT[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

function transactionType(condicao?: string | null): "For Sale" | "For Rent" {
  if (condicao && /alug|locac|rent/i.test(condicao)) return "For Rent";
  return "For Sale";
}

function resolveUrl(f: ImagemRow, base?: string): string | null {
  if (f.url && f.url.startsWith("http")) return f.url;
  const path = f.storage_path || f.url;
  if (!path) return null;
  if (base) return `${base.replace(/\/$/, "")}/${path}`;
  return null;
}

type BuildOpts = {
  carteira: { nome: string; slug: string; updated_at: string };
  imoveis: Array<ImovelRow & { imagens: ImagemRow[] }>;
  publisherEmail?: string;
  portal?: { slug: string; nome: string; formato_xml: string } | null;
  storageBaseUrl?: string;
};

export function buildVRSyncXML(opts: BuildOpts): string {
  const { carteira, imoveis, publisherEmail = "contato@mvbroker.com", portal, storageBaseUrl } = opts;
  const now = new Date().toISOString();

  const listings = imoveis
    .map((im) => {
      const codigo = im.codigo_interno || im.id;
      const tt = transactionType(im.condicao);
      const tipo = mapTipoVRSync(im.tipo_imovel ?? im.tipo);
      const fotos = (im.imagens ?? [])
        .slice()
        .sort((a, b) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem)
        .map((f) => ({ ...f, resolvedUrl: resolveUrl(f, storageBaseUrl) }))
        .filter((f) => !!f.resolvedUrl)
        .slice(0, 30);

      const mediaXML = fotos.length
        ? `<Media>${fotos
            .map(
              (f, idx) =>
                `<Item medium="image" caption="${esc(`Foto ${idx + 1}`)}" primary="${idx === 0 ? "true" : "false"}">${esc(
                  f.resolvedUrl,
                )}</Item>`,
            )
            .join("")}</Media>`
        : "";

      const detalhes: string[] = [];
      if (im.dormitorios != null) detalhes.push(`<Bedrooms>${im.dormitorios}</Bedrooms>`);
      if (im.banheiros != null) detalhes.push(`<Bathrooms>${im.banheiros}</Bathrooms>`);
      if (im.vagas != null) detalhes.push(`<Garage>${im.vagas}</Garage>`);
      if (im.suites != null) detalhes.push(`<Suites>${im.suites}</Suites>`);
      if (im.area_privativa != null) detalhes.push(`<LivingArea unit="square metres">${im.area_privativa}</LivingArea>`);
      if (im.area_total != null) detalhes.push(`<LotArea unit="square metres">${im.area_total}</LotArea>`);

      const features = Array.isArray(im.infraestrutura) && im.infraestrutura.length
        ? `<Features>${im.infraestrutura.map((f: string) => `<Feature>${esc(f)}</Feature>`).join("")}</Features>`
        : "";

      const preco = im.preco != null ? `<Price currency="BRL">${im.preco}</Price>` : "";
      const condo = im.valor_condominio != null ? `<PropertyAdministrationFee currency="BRL">${im.valor_condominio}</PropertyAdministrationFee>` : "";
      const iptu = im.valor_iptu != null ? `<YearlyTax currency="BRL">${im.valor_iptu}</YearlyTax>` : "";

      // CEP — fallback para padrão Capão da Canoa quando ausente, para não travar
      // a importação de portais que exigem o campo.
      const cepValor = (im.cep && String(im.cep).trim()) || "95555-000";

      // Proprietário (não-oficial VRSync, mas aceito por alguns portais)
      const propNome = im.responsavel_nome || null;
      const propTel = im.responsavel_telefone || im.responsavel_whatsapp || null;
      const propEmail = im.responsavel_email || null;
      const ownerXML = (propNome || propTel)
        ? `<Owner>
    ${propNome ? `<Name>${cdata(propNome)}</Name>` : ""}
    ${propTel ? `<Phone>${esc(propTel)}</Phone>` : ""}
    ${propEmail ? `<Email>${esc(propEmail)}</Email>` : ""}
  </Owner>`
        : "";

      // Nome do condomínio / edifício
      const nomeCondo = im.condominio_nome || im.edificio_nome || null;
      const condoNomeXML = nomeCondo ? `<CondominiumName>${cdata(nomeCondo)}</CondominiumName>` : "";

      return `<Listing>
  <ListingID>${esc(codigo)}</ListingID>
  <Title>${cdata(im.titulo || `${tipo} em ${im.bairro || im.cidade || ""}`)}</Title>
  <TransactionType>${tt}</TransactionType>
  <PublicationType>Standard</PublicationType>
  <ListType>Featured</ListType>
  <Status>Active</Status>
  <Details>
    <PropertyType>${esc(tipo)}</PropertyType>
    <Description>${cdata(im.descricao)}</Description>
    ${detalhes.join("\n    ")}
    ${preco}
    ${condo}
    ${iptu}
    ${features}
  </Details>
  <Location displayAddress="Neighborhood">
    <Country abbreviation="BR">Brasil</Country>
    <State abbreviation="${esc(im.estado || "")}">${esc(im.estado || "")}</State>
    <City>${esc(im.cidade || "")}</City>
    <Neighborhood>${esc(im.bairro || "")}</Neighborhood>
    <Address>${esc(im.logradouro || "")}</Address>
    <StreetNumber>${esc(im.numero || "")}</StreetNumber>
    <PostalCode>${esc(cepValor)}</PostalCode>
    ${condoNomeXML}
    ${im.latitude != null ? `<Latitude>${im.latitude}</Latitude>` : ""}
    ${im.longitude != null ? `<Longitude>${im.longitude}</Longitude>` : ""}
  </Location>
  ${ownerXML}
  ${mediaXML}
</Listing>`;
    })
    .join("\n");

  const portalTag = portal ? `<!-- Portal: ${portal.nome} (${portal.slug}) -->` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
${portalTag}
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <Provider>MV Broker</Provider>
    <Email>${esc(publisherEmail)}</Email>
    <ContactName>${esc(carteira.nome)}</ContactName>
    <PublishDate>${now}</PublishDate>
  </Header>
  <Listings>
${listings}
  </Listings>
</ListingDataFeed>`;
}

// OLX usa estrutura própria simplificada
export function buildOLXXML(opts: BuildOpts): string {
  const { carteira, imoveis, storageBaseUrl } = opts;
  const items = imoveis
    .map((im) => {
      const fotos = (im.imagens ?? [])
        .slice()
        .sort((a, b) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem)
        .map((f) => ({ ...f, resolvedUrl: resolveUrl(f, storageBaseUrl) }))
        .filter((f) => !!f.resolvedUrl)
        .slice(0, 20);
      const pics = fotos.map((f) => `<picture_url>${esc(f.resolvedUrl)}</picture_url>`).join("");
      const tt = /alug|locac/i.test(im.condicao ?? "") ? "Locacao" : "Venda";
      return `<ad>
  <id>${esc(im.codigo_interno || im.id)}</id>
  <subject>${cdata(im.titulo)}</subject>
  <category_name>${esc(mapTipoPT(im.tipo_imovel ?? im.tipo))}</category_name>
  <subcategory>${esc(tt)}</subcategory>
  <body>${cdata(im.descricao)}</body>
  <price>${im.preco ?? 0}</price>
  <state>${esc(im.estado ?? "")}</state>
  <city>${esc(im.cidade ?? "")}</city>
  <neighborhood>${esc(im.bairro ?? "")}</neighborhood>
  <zipcode>${esc(im.cep ?? "")}</zipcode>
  <bedrooms>${im.dormitorios ?? ""}</bedrooms>
  <bathrooms>${im.banheiros ?? ""}</bathrooms>
  <garage_spaces>${im.vagas ?? ""}</garage_spaces>
  <size>${im.area_privativa ?? im.area_total ?? ""}</size>
  <condominium_fee>${im.valor_condominio ?? ""}</condominium_fee>
  <iptu>${im.valor_iptu ?? ""}</iptu>
  ${pics}
</ad>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ads carteira="${esc(carteira.slug)}">
${items}
</ads>`;
}

// ImovelWeb usa estrutura adaptada
export function buildImovelWebXML(opts: BuildOpts): string {
  const { carteira, imoveis, storageBaseUrl } = opts;
  const items = imoveis.map((im) => {
    const fotos = (im.imagens ?? [])
      .slice()
      .sort((a, b) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem)
      .map((f) => ({ ...f, resolvedUrl: resolveUrl(f, storageBaseUrl) }))
      .filter((f) => !!f.resolvedUrl)
      .slice(0, 20);
    const pics = fotos.map((f, i) => `<imagem ordem="${i + 1}">${esc(f.resolvedUrl)}</imagem>`).join("");
    return `<imovel>
  <codigo>${esc(im.codigo_interno || im.id)}</codigo>
  <titulo>${cdata(im.titulo)}</titulo>
  <descricao>${cdata(im.descricao)}</descricao>
  <tipo>${esc(mapTipoPT(im.tipo_imovel ?? im.tipo))}</tipo>
  <transacao>${/alug|locac/i.test(im.condicao ?? "") ? "Locacao" : "Venda"}</transacao>
  <preco>${im.preco ?? 0}</preco>
  <condominio>${im.valor_condominio ?? 0}</condominio>
  <iptu>${im.valor_iptu ?? 0}</iptu>
  <area_util>${im.area_privativa ?? ""}</area_util>
  <area_total>${im.area_total ?? ""}</area_total>
  <dormitorios>${im.dormitorios ?? 0}</dormitorios>
  <suites>${im.suites ?? 0}</suites>
  <banheiros>${im.banheiros ?? 0}</banheiros>
  <vagas>${im.vagas ?? 0}</vagas>
  <endereco>
    <logradouro>${esc(im.logradouro ?? "")}</logradouro>
    <numero>${esc(im.numero ?? "")}</numero>
    <bairro>${esc(im.bairro ?? "")}</bairro>
    <cidade>${esc(im.cidade ?? "")}</cidade>
    <estado>${esc(im.estado ?? "")}</estado>
    <cep>${esc(im.cep ?? "")}</cep>
  </endereco>
  <fotos>${pics}</fotos>
</imovel>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<carga carteira="${esc(carteira.slug)}" nome="${esc(carteira.nome)}">
${items}
</carga>`;
}

export function buildFeedXML(opts: BuildOpts): string {
  const fmt = opts.portal?.formato_xml ?? "vrsync";
  switch (fmt) {
    case "olx": return buildOLXXML(opts);
    case "imovelweb": return buildImovelWebXML(opts);
    case "vrsync":
    default: return buildVRSyncXML(opts);
  }
}
