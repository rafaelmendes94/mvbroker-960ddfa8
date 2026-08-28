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

// Normaliza rótulos vindos do cadastro ("Casa de Condomínio", "Sala Comercial",
// "APARTAMENTO"...) para uma chave estável.
function slugTipo(t?: string | null): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const TIPO_MAP_VRSYNC: Record<string, string> = {
  apartamento: "Residential / Apartment",
  apto: "Residential / Apartment",
  cobertura: "Residential / Penthouse",
  duplex: "Residential / Apartment",
  triplex: "Residential / Apartment",
  studio: "Residential / Apartment",
  kitnet: "Residential / Apartment",
  flat: "Residential / Apartment",
  loft: "Residential / Apartment",
  casa: "Residential / Home",
  sobrado: "Residential / Home",
  casa_de_condominio: "Residential / Condo",
  casa_condominio: "Residential / Condo",
  casa_em_condominio: "Residential / Condo",
  terreno: "Residential / Land Lot",
  lote: "Residential / Land Lot",
  terreno_comercial: "Commercial / Land Lot",
  loteamento: "Residential / Land Lot",
  chacara: "Residential / Country House",
  sitio: "Farm / Ranch",
  fazenda: "Farm / Ranch",
  rural: "Farm / Ranch",
  comercial: "Commercial / Building",
  sala_comercial: "Commercial / Office",
  sala: "Commercial / Office",
  conjunto_comercial: "Commercial / Office",
  ponto_comercial: "Commercial / Business",
  galpao: "Commercial / Industrial",
  barracao: "Commercial / Industrial",
  loja: "Commercial / Business",
  predio: "Commercial / Building",
  hotel: "Commercial / Hotel",
  pousada: "Commercial / Hotel",
  garagem: "Commercial / Parking Lot",
  box: "Commercial / Parking Lot",
};

const TIPO_MAP_PT: Record<string, string> = {
  apartamento: "Apartamento",
  apto: "Apartamento",
  casa: "Casa",
  sobrado: "Sobrado",
  casa_de_condominio: "Casa de Condomínio",
  casa_condominio: "Casa de Condomínio",
  casa_em_condominio: "Casa de Condomínio",
  cobertura: "Cobertura",
  duplex: "Duplex",
  triplex: "Triplex",
  studio: "Studio",
  kitnet: "Kitnet",
  flat: "Flat",
  loft: "Loft",
  terreno: "Terreno",
  lote: "Terreno",
  loteamento: "Terreno",
  chacara: "Chácara",
  sitio: "Sítio",
  fazenda: "Fazenda",
  comercial: "Comercial",
  sala_comercial: "Sala Comercial",
  conjunto_comercial: "Sala Comercial",
  ponto_comercial: "Ponto Comercial",
  galpao: "Galpão",
  barracao: "Galpão",
  loja: "Loja",
  predio: "Prédio",
  hotel: "Hotel",
  pousada: "Pousada",
  garagem: "Garagem",
  box: "Box / Garagem",
  rural: "Rural",
};

function mapTipoVRSync(t?: string | null): string {
  const k = slugTipo(t);
  if (!k) return "Residential / Home";
  if (TIPO_MAP_VRSYNC[k]) return TIPO_MAP_VRSYNC[k];
  // heurísticas por palavra-chave
  if (/condominio/.test(k) && /casa/.test(k)) return "Residential / Condo";
  if (/apart|apto|cobert/.test(k)) return "Residential / Apartment";
  if (/casa|sobrado|residenc/.test(k)) return "Residential / Home";
  if (/terreno|lote|area/.test(k)) return "Residential / Land Lot";
  if (/sala|escritorio|conjunto/.test(k)) return "Commercial / Office";
  if (/galpao|barracao|industri/.test(k)) return "Commercial / Industrial";
  if (/loja|ponto|comercial/.test(k)) return "Commercial / Business";
  if (/sitio|chacara|fazenda|rural/.test(k)) return "Farm / Ranch";
  return "Residential / Home";
}

function mapTipoPT(t?: string | null): string {
  const k = slugTipo(t);
  if (!k) return "Outros";
  if (TIPO_MAP_PT[k]) return TIPO_MAP_PT[k];
  const raw = String(t).trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function transactionType(condicao?: string | null): "For Sale" | "For Rent" {
  if (condicao && /alug|locac|rent/i.test(condicao)) return "For Rent";
  return "For Sale";
}

function resolveUrl(f: ImagemRow, base?: string): string | null {
  if (f.url && f.url.startsWith("http")) return f.url;
  const path = f.storage_path || f.url;
  if (!path) return null;
  if (base) {
    const url = `${base.replace(/\/$/, "")}/${path}`;
    // Integrações externas (portais) não lidam bem com webp/avif: pedimos JPEG ao proxy.
    if (/\.(webp|avif|heic|heif)(\?|$)/i.test(url)) {
      return url + (url.includes("?") ? "&" : "?") + "format=jpg";
    }
    return url;
  }
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

      // Identificação da unidade: apto / quadra / lote / box
      const unidade = im.unidade ? String(im.unidade).trim() : "";
      const quadra = im.quadra ? String(im.quadra).trim() : "";
      const loteN = im.lote ? String(im.lote).trim() : "";
      const boxN = im.box ? String(im.box).trim() : "";
      const complementoPartes = [
        unidade ? `Apto/Unidade ${unidade}` : "",
        quadra ? `Quadra ${quadra}` : "",
        loteN ? `Lote ${loteN}` : "",
        boxN ? `Box ${boxN}` : "",
      ].filter(Boolean);
      const complementoTexto = complementoPartes.join(" - ") || (im.complemento ? String(im.complemento) : "");
      const unidadeXML = [
        unidade ? `<UnitNumber>${esc(unidade)}</UnitNumber>` : "",
        quadra ? `<Block>${esc(quadra)}</Block>` : "",
        loteN ? `<LotNumber>${esc(loteN)}</LotNumber>` : "",
        boxN ? `<BoxNumber>${esc(boxN)}</BoxNumber>` : "",
        complementoTexto ? `<Complement>${cdata(complementoTexto)}</Complement>` : "",
      ].filter(Boolean).join("\n    ");

      return `<Listing>
  <ListingID>${esc(codigo)}</ListingID>
  <Title>${cdata(im.titulo || `${tipo} em ${im.bairro || im.cidade || ""}`)}</Title>
  <TransactionType>${tt}</TransactionType>
  <PublicationType>Standard</PublicationType>
  <ListType>Featured</ListType>
  <Status>Active</Status>
  <Details>
    <PropertyType>${esc(tipo)}</PropertyType>
    <PropertyTypeName>${cdata(mapTipoPT(im.tipo_imovel ?? im.tipo))}</PropertyTypeName>
    <Description>${cdata(im.descricao)}</Description>
    ${detalhes.join("\n    ")}
    ${unidadeXML}
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
    ${complementoTexto ? `<Complement>${cdata(complementoTexto)}</Complement>` : ""}
    ${unidade ? `<UnitNumber>${esc(unidade)}</UnitNumber>` : ""}
    ${quadra ? `<Block>${esc(quadra)}</Block>` : ""}
    ${loteN ? `<LotNumber>${esc(loteN)}</LotNumber>` : ""}
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
  <complement>${cdata([im.unidade ? `Apto/Unidade ${im.unidade}` : "", im.quadra ? `Quadra ${im.quadra}` : "", im.lote ? `Lote ${im.lote}` : "", im.box ? `Box ${im.box}` : ""].filter(Boolean).join(" - ") || im.complemento || "")}</complement>
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
    <unidade>${esc(im.unidade ?? "")}</unidade>
    <quadra>${esc(im.quadra ?? "")}</quadra>
    <lote>${esc(im.lote ?? "")}</lote>
    <box>${esc(im.box ?? "")}</box>
    <complemento>${cdata(im.complemento ?? "")}</complemento>
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
