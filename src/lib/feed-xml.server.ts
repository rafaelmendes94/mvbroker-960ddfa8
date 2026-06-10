// VRSync-compatible XML feed generator. Server-only.

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

const TIPO_MAP: Record<string, string> = {
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

function mapTipo(t?: string | null): string {
  if (!t) return "Outros";
  return TIPO_MAP[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

function transactionType(condicao?: string | null): "For Sale" | "For Rent" {
  if (condicao && /alug|locac|rent/i.test(condicao)) return "For Rent";
  return "For Sale";
}

export function buildVRSyncXML(opts: {
  carteira: { nome: string; slug: string; updated_at: string };
  imoveis: Array<ImovelRow & { imagens: ImagemRow[] }>;
  publisherEmail?: string;
}): string {
  const { carteira, imoveis, publisherEmail = "contato@mvbroker.com" } = opts;
  const now = new Date().toISOString();

  const listings = imoveis
    .map((im) => {
      const codigo = im.codigo_interno || im.id;
      const tt = transactionType(im.condicao);
      const tipo = mapTipo(im.tipo);
      const fotos = (im.imagens ?? [])
        .slice()
        .sort((a, b) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem)
        .filter((f) => !!f.url)
        .slice(0, 30);

      const mediaXML = fotos.length
        ? `<Media>${fotos
            .map(
              (f, idx) =>
                `<Item medium="image" caption="${esc(`Foto ${idx + 1}`)}" primary="${idx === 0 ? "true" : "false"}">${esc(
                  f.url,
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

      const preco = im.preco != null ? `<ListPrice currency="BRL">${im.preco}</ListPrice>` : "";
      const condo = im.valor_condominio != null ? `<PropertyAdministrationFee currency="BRL">${im.valor_condominio}</PropertyAdministrationFee>` : "";
      const iptu = im.valor_iptu != null ? `<YearlyTax currency="BRL">${im.valor_iptu}</YearlyTax>` : "";

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
    <PostalCode>${esc(im.cep || "")}</PostalCode>
    ${im.latitude != null ? `<Latitude>${im.latitude}</Latitude>` : ""}
    ${im.longitude != null ? `<Longitude>${im.longitude}</Longitude>` : ""}
  </Location>
  ${mediaXML}
</Listing>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
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
