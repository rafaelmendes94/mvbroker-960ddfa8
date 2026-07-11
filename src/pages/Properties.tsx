import { PLACEHOLDER_IMAGE } from "@/lib/placeholderImage";
import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client-any";
import { Link } from "@/lib/router-shim";
import { AppLayout } from "@/components/AppLayout";
import { PropertyMap } from "@/components/PropertyMap";
import { PropertyDetailModal } from "@/components/PropertyDetailModal";
import { RoutePlanner } from "@/components/RoutePlanner";

import { PartnersAdSlider } from "@/components/PartnersAdSlider";
import { SoldConfirmDialog, SoldConfirmPayload } from "@/components/SoldConfirmDialog";
import { properties as initialProperties, salesRecords, formatCurrency, Property } from "@/data/mockData";
import {
  Building2, Search, Plus, MapPin, BedDouble, Bath, Car, Ruler,
  Download, Send, LayoutGrid, List, Map, ChevronLeft, ChevronRight, HardDrive,
  CheckCircle2, Clock, Home, Key, Trophy, FileCode, ChevronDown,
  Star, Fence, TreePine, Waves, Paintbrush, Filter, X, SlidersHorizontal,
  Phone, Heart, FileCheck, Eye, Repeat, CreditCard, DollarSign, Ban,
  Share2, CalendarCheck, CalendarClock, AlertTriangle, Pencil, Image,
  FolderDown, User, ShieldCheck, Percent, Gift, BarChart3, FileSignature,
  TrendingUp, Wallet, RefreshCw, ArrowUp, ArrowDown, Banknote, Copy, Maximize2, Scan, Route, Globe, Trash2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/router-shim";
import { cn, formatUnitParts } from "@/lib/utils";
import { toast } from "sonner";
import { generatePropertyPdf } from "@/utils/generatePropertyPdf";
import { useAuth } from "@/hooks/useAuth";
import { ImportacoesModal } from "@/components/ImportacoesModal";

// Broker info
const brokerInfo: Record<string, { photo: string; whatsapp: string }> = {
  "Carlos Silva": {
    photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face",
    whatsapp: "5511999990001",
  },
  "Ana Rodrigues": {
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    whatsapp: "5511999990002",
  },
  "Marcos Oliveira": {
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    whatsapp: "5511999990003",
  },
};

type XmlPortal = "ZAP Imóveis" | "VivaReal" | "OLX" | "Imovelweb" | "Chaves na Mão" | "Personalizado";

const xmlPortals: { name: XmlPortal; description: string }[] = [
  { name: "ZAP Imóveis", description: "Formato padrão ZAP" },
  { name: "VivaReal", description: "Formato VivaReal/Grupo ZAP" },
  { name: "OLX", description: "Formato OLX Pro" },
  { name: "Imovelweb", description: "Formato Imovelweb" },
  { name: "Chaves na Mão", description: "Formato Chaves na Mão" },
  { name: "Personalizado", description: "XML genérico completo" },
];

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const mapPropertyType = (type: string): string => {
  const map: Record<string, string> = {
    Apartamento: "Residential / Apartment",
    Casa: "Residential / Home",
    Comercial: "Commercial / Building",
    Terreno: "Residential / Land Lot",
    Lote: "Residential / Land Lot",
    "Condomínio": "Residential / Condo",
  };
  return map[type] || "Residential / Apartment";
};

const mapSubTipoOlx = (type: string): string => {
  const map: Record<string, string> = {
    Apartamento: "Apartamento Padrão",
    Casa: "Casa Padrão",
    Comercial: "Imóvel Comercial",
    Terreno: "Terrenos e Lotes",
    Lote: "Terrenos e Lotes",
    "Condomínio": "Casa de Condomínio",
  };
  return map[type] || "Apartamento Padrão";
};

const mapTipoCnm = (type: string): string => {
  const map: Record<string, string> = {
    Apartamento: "Apartamento",
    Casa: "Casa",
    Comercial: "Comercial",
    Terreno: "Terreno",
    Lote: "Terreno",
    "Condomínio": "Casa de Condomínio",
  };
  return map[type] || "Apartamento";
};

const mapFinalidadeCnm = (type: string): string => {
  if (type === "Comercial") return "CO";
  return "RE";
};

const photosXmlOlx = (images: string[]) =>
  images.length
    ? `      <Fotos>\n${images.map((url, i) => `        <Foto>${i === 0 ? "\n          <Principal>1</Principal>" : ""}\n          <URLArquivo>${escapeXml(url)}</URLArquivo>\n        </Foto>`).join("\n")}\n      </Fotos>`
    : "";

const photosXmlVrSync = (images: string[]) =>
  images.length
    ? `      <Media>\n${images.map((url, i) => `        <Item medium="image"${i === 0 ? ' primary="true"' : ""}>${escapeXml(url)}</Item>`).join("\n")}\n      </Media>`
    : "";

const photosCnm = (images: string[]) =>
  images.length
    ? `      <fotos_imovel>\n${images.map((url) => `        <foto>\n          <url>${escapeXml(url)}</url>\n          <data_atualizacao></data_atualizacao>\n        </foto>`).join("\n")}\n      </fotos_imovel>`
    : "      <fotos_imovel></fotos_imovel>";

/* ─── ZAP Imóveis (formato ZAP legado) ─── */
function generateZapXml(properties: Property[]): string {
  const items = properties.map((p) => `    <Imovel>
      <CodigoImovel>${escapeXml(p.id.slice(0, 50))}</CodigoImovel>
      <TipoImovel>${escapeXml(p.type)}</TipoImovel>
      <SubTipoImovel>${escapeXml(p.type)}</SubTipoImovel>
      <CategoriaImovel>Padrão</CategoriaImovel>
      <TituloImovel><![CDATA[${p.title}]]></TituloImovel>
      <Observacao><![CDATA[${p.description || p.title}]]></Observacao>
      <TipoOferta>STANDARD</TipoOferta>
      <PrecoVenda>${Math.round(p.price)}</PrecoVenda>
      <Endereco>${escapeXml(p.address)}</Endereco>
      <Numero>${escapeXml(p.unitNumber || "")}</Numero>
      <Complemento></Complemento>
      <Bairro>${escapeXml(p.neighborhood || "")}</Bairro>
      <Cidade>${escapeXml(p.city)}</Cidade>
      <UF>RS</UF>
      <CEP></CEP>
      <AreaUtil>${Math.round(p.area)}</AreaUtil>
      <AreaTotal>${Math.round(p.area)}</AreaTotal>
      <QtdDormitorios>${p.bedrooms}</QtdDormitorios>
      <QtdSuites>0</QtdSuites>
      <QtdBanheiros>${p.bathrooms}</QtdBanheiros>
      <QtdVagas>${p.parking}</QtdVagas>
      <Latitude>${p.lat}</Latitude>
      <Longitude>${p.lng}</Longitude>
${photosXmlOlx(p.images)}
    </Imovel>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Carga xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Imoveis>
${items}
  </Imoveis>
</Carga>`;
}

/* ─── VivaReal / ZAP (formato VRSync oficial) ─── */
function generateVrSyncXml(properties: Property[]): string {
  const now = new Date().toISOString().slice(0, 19);
  const items = properties.map((p) => `    <Listing>
      <ListingID>${escapeXml(p.id.slice(0, 50))}</ListingID>
      <Title><![CDATA[${p.title}]]></Title>
      <TransactionType>For Sale</TransactionType>
      <PublicationType>STANDARD</PublicationType>
      <Location displayAddress="All">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="RS">Rio Grande do Sul</State>
        <City><![CDATA[${p.city}]]></City>
        <Neighborhood><![CDATA[${p.neighborhood || ""}]]></Neighborhood>
        <Address><![CDATA[${p.address}]]></Address>
        <StreetNumber>${escapeXml(p.unitNumber || "")}</StreetNumber>
        <Complement></Complement>
        <PostalCode></PostalCode>
        <Latitude>${p.lat}</Latitude>
        <Longitude>${p.lng}</Longitude>
      </Location>
      <Details>
        <PropertyType>${mapPropertyType(p.type)}</PropertyType>
        <Description><![CDATA[${p.description || p.title}]]></Description>
        <ListPrice currency="BRL">${Math.round(p.price)}</ListPrice>
        <LivingArea unit="square metres">${Math.round(p.area)}</LivingArea>
        <LotArea unit="square metres">${Math.round(p.area)}</LotArea>
        <Bedrooms>${p.bedrooms}</Bedrooms>
        <Bathrooms>${p.bathrooms}</Bathrooms>
        <Suites>0</Suites>
        <Garage type="Parking Spaces">${p.parking}</Garage>
      </Details>
${photosXmlVrSync(p.images)}
      <ContactInfo>
        <Name><![CDATA[${p.broker}]]></Name>
        <Email></Email>
      </ContactInfo>
    </Listing>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>MV Broker Connect</Provider>
    <Email></Email>
    <ContactName>MV Broker Connect</ContactName>
    <PublishDate>${now}</PublishDate>
    <Telephone></Telephone>
  </Header>
  <Listings>
${items}
  </Listings>
</ListingDataFeed>`;
}

/* ─── OLX (formato OLX Pro) ─── */
function generateOlxXml(properties: Property[]): string {
  const items = properties.map((p) => `    <Imovel>
      <CodigoImovel>${escapeXml(p.id.slice(0, 20))}</CodigoImovel>
      <TituloAnuncio><![CDATA[${p.title.slice(0, 90)}]]></TituloAnuncio>
      <SubTipoImovel>${mapSubTipoOlx(p.type)}</SubTipoImovel>
      <Cidade>${escapeXml(p.city)}</Cidade>
      <Bairro>${escapeXml(p.neighborhood || "")}</Bairro>
      <CEP></CEP>
      <PrecoVenda>${Math.round(p.price)}</PrecoVenda>
      <PrecoCondominio>0</PrecoCondominio>
      <ValorIPTU>0</ValorIPTU>
      <QtdDormitorios>${Math.min(p.bedrooms, 5)}</QtdDormitorios>
      <QtdBanheiros>${Math.min(p.bathrooms, 5)}</QtdBanheiros>
      <QtdVagas>${Math.min(p.parking, 5)}</QtdVagas>
      <AreaUtil>${Math.round(p.area)}</AreaUtil>
      <Observacao><![CDATA[${p.description || p.title}]]></Observacao>
${photosXmlOlx(p.images)}
    </Imovel>`).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Imoveis>
${items}
  </Imoveis>
</Carga>`;
}

/* ─── Imovelweb (formato VRSync/Grupo OLX) ─── */
function generateImovelwebXml(properties: Property[]): string {
  return generateVrSyncXml(properties);
}

/* ─── Chaves na Mão ─── */
function generateChavesNaMaoXml(properties: Property[]): string {
  const items = properties.map((p) => `    <imovel>
      <referencia>${escapeXml(p.id)}</referencia>
      <codigo_cliente>${escapeXml(p.id)}</codigo_cliente>
      <link_cliente></link_cliente>
      <titulo><![CDATA[${p.title}]]></titulo>
      <transacao>V</transacao>
      <transacao2></transacao2>
      <finalidade>${mapFinalidadeCnm(p.type)}</finalidade>
      <finalidade2></finalidade2>
      <destaque>${p.status === "Disponível" ? "1" : "0"}</destaque>
      <tipo>${mapTipoCnm(p.type)}</tipo>
      <tipo2></tipo2>
      <valor>${p.price.toFixed(2)}</valor>
      <valor_locacao></valor_locacao>
      <valor_iptu></valor_iptu>
      <valor_condominio></valor_condominio>
      <area_total>${p.area.toFixed(2)}</area_total>
      <area_util>${(p.privateArea || p.area).toFixed(2)}</area_util>
      <conservacao></conservacao>
      <quartos>${p.bedrooms}</quartos>
      <suites>0</suites>
      <garagem>${p.parking}</garagem>
      <banheiro>${p.bathrooms}</banheiro>
      <closet></closet>
      <salas></salas>
      <despensa></despensa>
      <bar></bar>
      <cozinha></cozinha>
      <quarto_empregada></quarto_empregada>
      <escritorio></escritorio>
      <area_servico></area_servico>
      <lareira></lareira>
      <varanda></varanda>
      <lavanderia></lavanderia>
      <aceita_pet></aceita_pet>
      <estado>RS</estado>
      <cidade>${escapeXml(p.city)}</cidade>
      <bairro>${escapeXml(p.neighborhood || "")}</bairro>
      <cep></cep>
      <endereco>${escapeXml(p.address)}</endereco>
      <numero>${escapeXml(p.unitNumber || "")}</numero>
      <complemento></complemento>
      <esconder_endereco_imovel>0</esconder_endereco_imovel>
      <descritivo><![CDATA[${p.description || p.title}]]></descritivo>
${photosCnm(p.images)}
      <data_atualizacao>${p.updatedAt || ""}</data_atualizacao>
      <latitude>${p.lat}</latitude>
      <longitude>${p.lng}</longitude>
      <video>${p.linkVideo || ""}</video>
      <tour_360>${p.link360 || ""}</tour_360>
      <area_comum></area_comum>
      <area_privativa></area_privativa>
      <aceita_troca>${p.acceptsExchange ? "1" : "0"}</aceita_troca>
      <periodo_locacao></periodo_locacao>
    </imovel>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <imoveis>
${items}
  </imoveis>
</Document>`;
}

/* ─── Personalizado (XML genérico completo) ─── */
function generateGenericXml(properties: Property[]): string {
  const items = properties.map((p) => `    <Imovel>
      <Codigo>${escapeXml(p.id)}</Codigo>
      <Titulo><![CDATA[${p.title}]]></Titulo>
      <TipoImovel>${escapeXml(p.type)}</TipoImovel>
      <Status>${escapeXml(p.status)}</Status>
      <Endereco>${escapeXml(p.address)}</Endereco>
      <Bairro>${escapeXml(p.neighborhood || "")}</Bairro>
      <Cidade>${escapeXml(p.city)}</Cidade>
      <Estado>RS</Estado>
      <PrecoVenda>${p.price}</PrecoVenda>
      <PrecoParcelado>${p.priceInstallment || 0}</PrecoParcelado>
      <AreaTotal>${p.area}</AreaTotal>
      <AreaPrivativa>${p.privateArea || p.area}</AreaPrivativa>
      <Quartos>${p.bedrooms}</Quartos>
      <Banheiros>${p.bathrooms}</Banheiros>
      <Vagas>${p.parking}</Vagas>
      <Decorado>${p.decorated ? "Sim" : "Nao"}</Decorado>
      <VistaMar>${p.seaView ? "Sim" : "Nao"}</VistaMar>
      <AceitaPermuta>${p.acceptsExchange ? "Sim" : "Nao"}</AceitaPermuta>
      <Empreendimento>${escapeXml(p.empreendimento || "")}</Empreendimento>
      <Corretor>${escapeXml(p.broker)}</Corretor>
      <Descricao><![CDATA[${p.description || ""}]]></Descricao>
      <Latitude>${p.lat}</Latitude>
      <Longitude>${p.lng}</Longitude>
      <LinkVideo>${p.linkVideo || ""}</LinkVideo>
      <Link360>${p.link360 || ""}</Link360>
      <Imagens>${p.images.map((url) => `\n        <Imagem>${escapeXml(url)}</Imagem>`).join("")}
      </Imagens>
    </Imovel>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Imoveis>
  <Header>
    <Gerado>${new Date().toISOString()}</Gerado>
    <TotalImoveis>${properties.length}</TotalImoveis>
  </Header>
  <ListaImoveis>
${items}
  </ListaImoveis>
</Imoveis>`;
}

function generateXml(properties: Property[], portal: XmlPortal): string {
  switch (portal) {
    case "ZAP Imóveis": return generateZapXml(properties);
    case "VivaReal": return generateVrSyncXml(properties);
    case "OLX": return generateOlxXml(properties);
    case "Imovelweb": return generateImovelwebXml(properties);
    case "Chaves na Mão": return generateChavesNaMaoXml(properties);
    case "Personalizado": return generateGenericXml(properties);
    default: return generateGenericXml(properties);
  }
}

function downloadXml(xml: string, portal: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `imoveis_${portal.toLowerCase().replace(/\s+/g, "_")}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

const allStatuses: Property["status"][] = ["Disponível", "Vendido", "Reservado", "Alugado", "Suspenso"];
const statusLabels: Record<Property["status"], string> = {
  Disponível: "Ativo", Vendido: "Vendido", Reservado: "Reservado", Alugado: "Alugado", Suspenso: "Suspenso",
};
const statusConfig: Record<Property["status"], { color: string; bg: string; border: string; icon: typeof Home }> = {
  Disponível: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: Home },
  Vendido: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: CheckCircle2 },
  Reservado: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Clock },
  Alugado: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Key },
  Suspenso: { color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/30", icon: Ban },
};

type Category = "todos" | "apartamentos" | "casas" | "terrenos" | "lotes" | "condominios" | "decorados" | "vista-mar" | "permuta" | "vendidos";

const defaultCategories: { key: Category; label: string; icon: typeof Home }[] = [
  { key: "todos", label: "Todos", icon: Search },
  { key: "apartamentos", label: "Apartamentos", icon: Building2 },
  { key: "casas", label: "Casas", icon: Home },
  { key: "terrenos", label: "Terrenos", icon: TreePine },
  { key: "lotes", label: "Lotes", icon: Fence },
  
  { key: "condominios", label: "Condomínios", icon: Building2 },
  { key: "decorados", label: "Decorados", icon: Paintbrush },
  { key: "vista-mar", label: "Vista Mar", icon: Waves },
];

const getSavedCategoryOrder = (): typeof defaultCategories => {
  try {
    const saved = JSON.parse(localStorage.getItem("mv-category-order") || "[]") as Category[];
    if (saved.length === defaultCategories.length) {
      return saved.map(key => defaultCategories.find(c => c.key === key)!).filter(Boolean);
    }
  } catch {}
  return defaultCategories;
};

// Auto-generate codes for properties that don't have one
const propertiesWithCodes = initialProperties.map((p, i) => ({
  ...p,
  code: p.code || `MV${String(i + 1).padStart(2, "0")}`,
}));

export default function Properties() {
  const navigate = useNavigate();
  const { user, subscription, isSuperAdmin, isAdminStaff } = useAuth();
  const [currentImoveis, setCurrentImoveis] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const maxImoveis = subscription?.plan?.max_properties ?? 0;
  const limitReached = !isSuperAdmin && !isAdminStaff && maxImoveis > 0 && currentImoveis >= maxImoveis;

  useEffect(() => {
    if (!user) return;
    supabase.rpc("count_imoveis_in_subscription", { _user_id: user.id })
      .then(({ data }: any) => setCurrentImoveis(Number(data) || 0));
  }, [user, subscription?.id]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [propertyList, setPropertyList] = useState<Property[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("todos");
  const [view, setView] = useState<"grid" | "list" | "map">("list");
  const [showXmlMenu, setShowXmlMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filterCity, setFilterCity] = useState("");
  const [filterBedrooms, setFilterBedrooms] = useState("");
  const [filterSuites, setFilterSuites] = useState("");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterMine, setFilterMine] = useState(false);
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [filterStreet, setFilterStreet] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [filterParking, setFilterParking] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "name-asc" | "name-desc" | "updated" | "created">("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const ITEMS_PER_PAGE = 30;

  // Restore selected property from URL param
  const propertyIdFromUrl = searchParams.get("property");
  const [selectedProperty, setSelectedPropertyState] = useState<Property | null>(null);

  const setSelectedProperty = (p: Property | null) => {
    setSelectedPropertyState(p);
    if (p) {
      setSearchParams((prev: any) => { prev.set("property", p.id); return prev; }, { replace: true });
    } else {
      setSearchParams((prev: any) => { prev.delete("property"); return prev; }, { replace: true });
    }
  };

  const [viewingTerm, setViewingTerm] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [routeIds, setRouteIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("mv-route-ids") || "[]"); } catch { return []; }
  });
  const [filterFreshness, setFilterFreshness] = useState<"all" | "30" | "60" | "90">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showSoldThisMonth, setShowSoldThisMonth] = useState(false);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState(getSavedCategoryOrder);
  const dragCatRef = useRef<number | null>(null);

  const handleCatDragStart = (idx: number) => { dragCatRef.current = idx; };
  const handleCatDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragCatRef.current === null || dragCatRef.current === idx) return;
    setCategories((prev: any) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragCatRef.current!, 1);
      updated.splice(idx, 0, moved);
      dragCatRef.current = idx;
      localStorage.setItem("mv-category-order", JSON.stringify(updated.map(c => c.key)));
      return updated;
    });
  };
  const handleCatDragEnd = () => { dragCatRef.current = null; };

  const xmlMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const STATUS_DB_TO_UI: Record<string, Property["status"]> = {
      disponivel: "Disponível",
      vendido: "Vendido",
      reservado: "Reservado",
      alugado: "Alugado",
      suspenso: "Suspenso",
    };

    const fetchProperties = async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select("*, edificios(nome), condominios(nome), empreendimentos(nome)")
        .eq("arquivado", false)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar imóveis");
        setPropertyList(propertiesWithCodes);
        return;
      }

      // Imagens (tabela separada imovel_imagens) — bucket privado, gerar signed URLs
      const ids = (data || []).map((r: any) => r.id);
      const imagesById: Record<string, string[]> = {};
      if (ids.length) {
        const { data: imgs } = await supabase
          .from("imovel_imagens")
          .select("imovel_id, storage_path, url, ordem, capa")
          .in("imovel_id", ids)
          .order("capa", { ascending: false })
          .order("ordem", { ascending: true });
        const rows = imgs || [];
        const paths = rows.map((im: any) => im.storage_path || im.url).filter(Boolean);
        const signedMap: Record<string, string> = {};
        if (paths.length) {
          const { data: signed } = await supabase.storage
            .from("imoveis")
            .createSignedUrls(paths, 3600);
          (signed || []).forEach((s: any) => {
            if (s?.path && s?.signedUrl) signedMap[s.path] = s.signedUrl;
          });
        }
        rows.forEach((im: any) => {
          const p = im.storage_path || im.url;
          const u = signedMap[p] || (p?.startsWith("http") ? p : "");
          if (!u) return;
          if (!imagesById[im.imovel_id]) imagesById[im.imovel_id] = [];
          imagesById[im.imovel_id].push(u);
        });
      }

      // Profiles do cadastrante (created_by)
      const ownerIds = Array.from(new Set((data || []).map((r: any) => r.created_by).filter(Boolean)));
      const profilesById: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (ownerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", ownerIds);
        (profs || []).forEach((p: any) => {
          profilesById[p.id] = { full_name: p.full_name || "", avatar_url: p.avatar_url };
        });
      }

      const mapped: Property[] = (data || []).map((row: any, index: number) => {
        const owner = profilesById[(row as any).created_by];
        const imgs = imagesById[row.id] || [];
        return {
        id: row.id,
        userId: row.created_by,
        code: row.codigo_interno || `MV${String(index + 1).padStart(2, "0")}`,
        title: row.titulo || "Imóvel",
        address: [row.logradouro, row.numero].filter(Boolean).join(", "),
        neighborhood: row.bairro || "",
        city: row.cidade || "",
        type: (row.tipo_imovel as Property["type"]) || "Casa",
        status: STATUS_DB_TO_UI[row.status_imovel] || "Disponível",
        price: Number(row.preco || 0),
        area: Number(row.area_total || 0),
        privateArea: Number(row.area_privativa || 0),
        bedrooms: row.dormitorios || 0,
        suites: row.suites || 0,
        bathrooms: row.banheiros || 0,
        parking: row.vagas || 0,
        broker: owner?.full_name?.trim() || "Corretor",
        brokerPhoto: owner?.avatar_url || undefined,
        brokerWhatsapp: "",
        owner: row.responsavel_nome || "",
        ownerPhone: row.responsavel_telefone || "",
        image: imgs[0] || PLACEHOLDER_IMAGE,
        images: imgs,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lat: Number(row.latitude) || 0,
        lng: Number(row.longitude) || 0,
        decorated: row.decorado || false,
        seaView: row.vista_mar || false,
        acceptsExchange: row.aceita_permuta || false,
        paymentConditions: row.condicoes_pagamento || [],
        empreendimento: (row as any).edificios?.nome || (row as any).condominios?.nome || (row as any).empreendimentos?.nome || "",
        edificioId: (row as any).edificio_id || "",
        condominioId: (row as any).condominio_id || "",
        empreendimentoId: (row as any).empreendimento_id || "",
        unitNumber: row.unidade || "",
        boxNumber: row.box || "",
        quadra: row.quadra || "",
        lote: row.lote || "",
        exclusivityTerm: row.exclusividade ? "Sim" : "",
        exclusivityTermUrl: (row as any).termo_exclusividade_path || "",
        description: row.descricao || "",
        posicaoPredio: row.posicao_predio || "",
        posicaoSolar: row.posicao_solar || "",
        infraestrutura: row.infraestrutura || [],
        elevadores: row.elevadores || 0,
        vista: row.vista || "",
        condicao: (row.condicao as Property["condicao"]) || undefined,
        ownerType: (row.tipo_proprietario as Property["ownerType"]) || undefined,
        priceInstallment: Number(row.preco_parcelado || 0),
        commission: Number(row.comissao_percentual || 0),
        bonus: Number(row.bonus || 0) || 0,
        bonusExpiry: row.validade_bonus || "",
        padrao: (row.padrao as Property["padrao"]) || undefined,
        outrasCaracteristicas: row.outras_caracteristicas || [],
        linkVideo: row.link_video || "",
        linkMaterial: row.link_material || "",
        link360: row.tour_360 || "",
        driveFotosUrl: row.link_drive_fotos || "",
        fotosPdfUrl: row.pdf_comercial_path || "",
        views: 0,
        plataformaVenda: "",
        dataVenda: "",
        };
      });

      setPropertyList(mapped);
    };

    fetchProperties();
  }, []);


  // Load favorites from DB
  useEffect(() => {
    const loadFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("imoveis_favoritos").select("imovel_id").eq("usuario_id", user.id);
      if (data) setFavoriteIds(data.map((f: any) => f.imovel_id));
    };
    loadFavorites();
  }, []);

  useEffect(() => {
    if (!propertyIdFromUrl || propertyList.length === 0) return;
    const found = propertyList.find((p) => p.id === propertyIdFromUrl) || null;
    setSelectedPropertyState(found);
  }, [propertyIdFromUrl, propertyList]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (xmlMenuRef.current && !xmlMenuRef.current.contains(e.target as Node)) setShowXmlMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleFavorite = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Faça login para favoritar imóveis");
      return;
    }

    const isFav = favoriteIds.includes(id);
    // Optimistic update
    setFavoriteIds((prev: any) => isFav ? prev.filter((x: any) => x !== id) : [...prev, id]);

    const { error } = isFav
      ? await supabase.from("imoveis_favoritos").delete().eq("usuario_id", user.id).eq("imovel_id", id)
      : await supabase.from("imoveis_favoritos").insert({ usuario_id: user.id, imovel_id: id });

    if (error) {
      // Rollback
      setFavoriteIds((prev: any) => isFav ? [...prev, id] : prev.filter((x: any) => x !== id));
      toast.error(isFav ? "Erro ao remover favorito" : "Erro ao favoritar");
      return;
    }
    toast.success(isFav ? "Removido dos favoritos" : "Adicionado aos favoritos");
  };


  const toggleRoute = (id: string) => {
    setRouteIds((prev: any) => {
      const next = prev.includes(id) ? prev.filter((x: any) => x !== id) : [...prev, id];
      localStorage.setItem("mv-route-ids", JSON.stringify(next));
      return next;
    });
  };

  const handleExportXml = (portal: XmlPortal) => {
    const available = propertyList.filter((p) => p.status === "Disponível");
    const xml = generateXml(available.length > 0 ? available : propertyList, portal);
    downloadXml(xml, portal);
    setShowXmlMenu(false);
  };

  const [pendingSold, setPendingSold] = useState<Property | null>(null);

  const STATUS_UI_TO_DB: Record<Property["status"], string> = {
    "Disponível": "disponivel",
    "Vendido": "vendido",
    "Reservado": "reservado",
    "Alugado": "alugado",
    "Suspenso": "suspenso",
  };

  const persistStatus = async (
    propertyId: string,
    newStatus: Property["status"],
    extra: Record<string, any> = {}
  ) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
    if (isUuid) {
      const { error } = await supabase
        .from("imoveis")
        .update({
          status_imovel: STATUS_UI_TO_DB[newStatus],
          updated_at: new Date().toISOString(),
          ...extra,
        } as any)
        .eq("id", propertyId);
      if (error) {
        toast.error("Erro ao atualizar status");
        return false;
      }
    }
    return true;
  };

  const handleStatusChange = async (propertyId: string, newStatus: Property["status"]) => {
    const target = propertyList.find((p) => p.id === propertyId);
    if (!target) return;

    // Sold flow: open confirmation dialog first
    if (newStatus === "Vendido" && target.status !== "Vendido") {
      setPendingSold(target);
      return;
    }

    // Sai de "Vendido" → limpa data/plataforma para não computar mais como venda
    const extra =
      target.status === "Vendido" && newStatus !== "Vendido"
        ? { data_venda: null, plataforma_venda: null }
        : {};

    const ok = await persistStatus(propertyId, newStatus, extra);
    if (!ok) return;
    setPropertyList((prev: any) =>
      prev.map((p: any) =>
        p.id === propertyId
          ? { ...p, status: newStatus, ...(target.status === "Vendido" && newStatus !== "Vendido" ? { plataformaVenda: "", dataVenda: "" } : {}) }
          : p
      )
    );
  };

  const handleConfirmSold = async ({ platform, saleDate }: SoldConfirmPayload) => {
    if (!pendingSold) return;
    const propertyId = pendingSold.id;
    const isoSale = saleDate ? new Date(saleDate).toISOString() : new Date().toISOString();
    const ok = await persistStatus(propertyId, "Vendido", {
      data_venda: isoSale,
      plataforma_venda: platform || null,
    });
    if (!ok) return;

    setPropertyList((prev: any) =>
      prev.map((p: any) =>
        p.id === propertyId
          ? { ...p, status: "Vendido", plataformaVenda: platform, dataVenda: saleDate, updatedAt: new Date().toISOString() }
          : p
      )
    );
    toast.success(`Venda registrada via ${platform}! Já está no Relatório de Vendas.`);
    setPendingSold(null);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (propertyId: string) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
    if (isUuid) {
      const { error } = await supabase.from("imoveis").delete().eq("id", propertyId);
      if (error) { toast.error("Erro ao excluir imóvel"); return; }
    }
    setPropertyList((prev: any) => prev.filter((p: any) => p.id !== propertyId));
    setDeleteConfirmId(null);
    toast.success("Imóvel excluído com sucesso!");
  };

  const handlePriceChange = (propertyId: string, field: "price" | "priceInstallment", value: number) => {
    setPropertyList((prev: any) => prev.map((p: any) => (p.id === propertyId ? { ...p, [field]: value } : p)));
    toast.success("Valor atualizado!");
  };

  const handleDealLabelChange = (propertyId: string, label: Property["dealLabel"]) => {
    setPropertyList((prev: any) => prev.map((p: any) => (p.id === propertyId ? { ...p, dealLabel: label } : p)));
    toast.success(label ? `Classificado como "${label}"` : "Classificação removida");
  };

  const handleNavigateToValuation = (property: Property) => {
    const params = new URLSearchParams({
      tipo: property.type,
      cidade: property.city,
      bairro: property.neighborhood || "",
      area: String(property.area),
      quartos: String(property.bedrooms),
      banheiros: String(property.bathrooms),
      vagas: String(property.parking),
      endereco: property.address,
      titulo: property.title,
      vista_mar: property.seaView ? "1" : "0",
      decorado: property.decorated ? "1" : "0",
      empreendimento: property.empreendimento || "",
      descricao: property.description || "",
      id: property.id,
      preco: String(property.price || 0),
    });
    navigate(`/avaliacoes?${params.toString()}`);
  };

  const handleNavigateToContract = (property: Property) => {
    const unitParts = formatUnitParts(property);
    const params = new URLSearchParams({
      imovel: property.title,
      endereco: `${property.address}, ${property.city}`,
      valor: String(property.price),
      proprietario: property.owner || "",
      empreendimento: property.empreendimento || "",
      unidade: unitParts.join(" / ") || "",
      dormitorios: property.bedrooms > 0 ? `${property.bedrooms} dormitório(s)` : "",
      vagas: property.parking > 0 ? `${property.parking} vaga(s)` : "",
      cidade: property.city || "",
    });
    navigate(`/contratos?${params.toString()}`);
  };

  const hasActiveFilters = filterCity || filterBedrooms || filterSuites || filterPriceMin || filterPriceMax || filterCondition || filterEmpreendimento || filterType || filterOwner || filterNeighborhood || filterStreet || filterCode || filterParking;

  const clearFilters = () => {
    setFilterCity(""); setFilterBedrooms(""); setFilterSuites(""); setFilterPriceMin(""); setFilterPriceMax(""); setFilterCondition("");
    setFilterEmpreendimento(""); setFilterType(""); setFilterOwner(""); setFilterNeighborhood(""); setFilterStreet(""); setFilterCode(""); setFilterParking(""); setSearch("");
    setShowInactive(false); setSortBy("default");
  };

  const handleQuickUpdate = (id: string) => {
    setPropertyList((prev: any) =>
      prev.map((p: any) => (p.id === id ? { ...p, updatedAt: new Date().toISOString() } : p))
    );
    toast.success("Data de atualização renovada!");
  };

  const handleDuplicate = (id: string) => {
    const original = propertyList.find(p => p.id === id);
    if (!original) return;
    const newId = `dup-${Date.now()}`;
    const newCode = `MV${String(propertyList.length + 1).padStart(2, "0")}`;
    const duplicate: Property = {
      ...original,
      id: newId,
      code: newCode,
      title: `${original.title} (Cópia)`,
      status: "Disponível",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPropertyList((prev: any) => [duplicate, ...prev]);
    toast.success("Imóvel duplicado com sucesso!");
  };

  const cities = useMemo(() => [...new Set(propertyList.map(p => p.city))].sort(), [propertyList]);
  const empreendimentos = useMemo(() => [...new Set(propertyList.map(p => p.empreendimento).filter(Boolean))].sort() as string[], [propertyList]);
  const owners = useMemo(() => [...new Set(propertyList.map(p => p.owner).filter(Boolean))].sort() as string[], [propertyList]);
  const types = useMemo(() => [...new Set([...propertyList.map(p => p.type), "Apartamento", "Casa", "Comercial", "Terreno", "Lote", "Condomínio"])].sort(), [propertyList]);
  const neighborhoods = useMemo(() => [...new Set(propertyList.map(p => p.neighborhood).filter(Boolean))].sort() as string[], [propertyList]);
  const streets = useMemo(() => [...new Set(propertyList.map(p => p.address))].sort(), [propertyList]);

  // Freshness helpers
  const now = new Date();
  const getDaysSinceUpdate = (p: Property) => {
    const updated = p.updatedAt ? new Date(p.updatedAt) : new Date(p.createdAt);
    return Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
  };

  const freshnessStats = useMemo(() => {
    let within30 = 0, within60 = 0, over90 = 0;
    propertyList.forEach(p => {
      const days = getDaysSinceUpdate(p);
      if (days <= 30) within30++;
      else if (days <= 60) within60++;
      else if (days > 90) over90++;
    });
    return { within30, within60, over90 };
  }, [propertyList]);

  const filtered = useMemo(() => {
    return propertyList.filter((p) => {
      // Freshness filter
      if (filterFreshness !== "all") {
        const days = getDaysSinceUpdate(p);
        if (filterFreshness === "30" && days > 30) return false;
        if (filterFreshness === "60" && (days <= 30 || days > 60)) return false;
        if (filterFreshness === "90" && days <= 90) return false;
      }

      // Default: only show Disponível and Reservado unless showInactive or vendidos category
      if (activeCategory !== "vendidos" && !showInactive) {
        if (p.status !== "Disponível" && p.status !== "Reservado") return false;
      }

      // Category
      if (activeCategory === "apartamentos" && p.type !== "Apartamento") return false;
      if (activeCategory === "casas" && p.type !== "Casa") return false;
      if (activeCategory === "terrenos" && p.type !== "Terreno") return false;
      if (activeCategory === "lotes" && p.type !== "Lote") return false;
      
      if (activeCategory === "condominios" && p.type !== "Condomínio") return false;
      if (activeCategory === "decorados" && !p.decorated) return false;
      if (activeCategory === "vista-mar" && !p.seaView) return false;
      if (activeCategory === "permuta" && !p.acceptsExchange) return false;
      if (activeCategory === "vendidos" && p.status !== "Vendido") return false;

      // Search (includes code)
      if (search) {
        const s = search.toLowerCase();
        if (!p.title.toLowerCase().includes(s) && !p.address.toLowerCase().includes(s) && !p.city.toLowerCase().includes(s) && !p.broker.toLowerCase().includes(s) && !(p.code || "").toLowerCase().includes(s)) return false;
      }

      // Advanced filters
      if (filterCity && p.city !== filterCity) return false;
      if (filterBedrooms && p.bedrooms < parseInt(filterBedrooms)) return false;
      if (filterSuites && (p.suites ?? 0) < parseInt(filterSuites)) return false;
      if (filterPriceMin && p.price < parseInt(filterPriceMin)) return false;
      if (filterPriceMax && p.price > parseInt(filterPriceMax)) return false;
      if (filterCondition && !(p.paymentConditions?.some(c => c.toLowerCase().includes(filterCondition.toLowerCase())))) return false;
      if (filterEmpreendimento && p.empreendimento !== filterEmpreendimento) return false;
      if (filterType && p.type !== filterType) return false;
      if (filterOwner && p.owner !== filterOwner) return false;
      if (filterNeighborhood && p.neighborhood !== filterNeighborhood) return false;
      if (filterStreet && p.address !== filterStreet) return false;
      if (filterCode && !(p.code || "").toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterParking && p.parking < parseInt(filterParking)) return false;
      if (filterMine && user && p.userId !== user.id) return false;

      return true;
    });
  }, [propertyList, activeCategory, search, filterCity, filterBedrooms, filterSuites, filterPriceMin, filterPriceMax, filterCondition, filterFreshness, filterEmpreendimento, filterType, filterOwner, filterNeighborhood, filterStreet, filterCode, filterParking, filterMine, user, showInactive]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, search, filterCity, filterBedrooms, filterSuites, filterPriceMin, filterPriceMax, filterCondition, filterFreshness, filterEmpreendimento, filterType, filterOwner, filterNeighborhood, filterStreet, filterCode, filterParking, showInactive, sortBy]);

  const sorted = useMemo(() => {
    if (sortBy === "default") return filtered;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-desc": return b.price - a.price;
        case "price-asc": return a.price - b.price;
        case "name-asc": return (a.empreendimento || a.title).localeCompare(b.empreendimento || b.title);
        case "name-desc": return (b.empreendimento || b.title).localeCompare(a.empreendimento || a.title);
        case "updated": return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        case "created": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });
  }, [filtered, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  const favoritedProperties = propertyList.filter((p) => favoriteIds.includes(p.id));
  const routeProperties = propertyList.filter((p) => routeIds.includes(p.id));

  // Stats
  const totalVGV = propertyList.filter(p => p.status === "Disponível").reduce((s, p) => s + p.price, 0);
  const totalSold = propertyList.filter(p => p.status === "Vendido").reduce((s, p) => s + p.price, 0);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <PartnersAdSlider />
        {/* Header */}
        <div className="flex flex-col gap-3">
          {/* Action buttons row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-base sm:text-xl font-bold text-foreground flex items-center gap-2 min-w-0 truncate">
              <Building2 className="w-5 h-5 text-accent shrink-0" /> Imóveis
            </h1>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => navigate("/relatorios")}
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 rounded-lg bg-primary text-primary-foreground text-[11px] sm:text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Relatórios</span><span className="sm:hidden">Rel.</span>
              </button>
              <div className="relative" ref={xmlMenuRef}>
                <button
                  onClick={() => setShowXmlMenu(!showXmlMenu)}
                  className="flex items-center gap-1 px-2 py-1.5 sm:px-3 rounded-lg bg-card border border-input text-foreground text-[11px] sm:text-xs font-medium hover:bg-muted transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar</span> XML <ChevronDown className="w-3 h-3" />
                </button>
                {showXmlMenu && (
                  <div className="absolute right-0 top-full mt-1 w-56 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-xl z-50 py-1 animate-scale-in">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selecione o portal</p>
                    {xmlPortals.map((portal) => (
                      <button key={portal.name} onClick={() => handleExportXml(portal.name)} className="w-full text-left px-3 py-2 hover:bg-muted transition-colors">
                        <span className="text-sm font-medium text-foreground block">{portal.name}</span>
                        <span className="text-[11px] text-muted-foreground">{portal.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
                title="Importações"
              >
                <FolderDown className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importações</span><span className="sm:hidden">Import.</span>
              </button>
              <div className="flex flex-col items-end gap-0.5 ml-auto sm:ml-0">
                <button
                  onClick={() => {
                    if (limitReached) {
                      toast.error(`Limite de ${maxImoveis} imóveis atingido. Faça upgrade do plano.`);
                      return;
                    }
                    navigate("/imoveis/novo");
                  }}
                  disabled={limitReached}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition-opacity",
                    limitReached ? "bg-muted text-muted-foreground cursor-not-allowed" : "gradient-gold text-primary hover:opacity-90"
                  )}
                  title={limitReached ? "Limite atingido — faça upgrade" : "Novo imóvel"}
                >
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Novo</span> Imóvel
                </button>
                {maxImoveis > 0 && (
                  <span className={cn("text-[10px] font-medium", limitReached ? "text-destructive" : "text-muted-foreground")}>
                    {currentImoveis} de {maxImoveis} imóveis
                  </span>
                )}
              </div>
            </div>
          </div>


          {/* VGV Cards - larger and centered */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-600 leading-none truncate">VGV Ativo <span className="text-muted-foreground font-medium">({propertyList.filter(p => p.status === "Disponível" || p.status === "Reservado").length})</span></p>
                <p className="text-sm sm:text-base font-black text-foreground leading-tight truncate">
                  {formatCurrency(propertyList.filter(p => p.status === "Disponível" || p.status === "Reservado").reduce((sum, p) => sum + p.price, 0))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <DollarSign className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase text-blue-600 leading-none truncate">Comissão Est. <span className="text-muted-foreground font-medium">({propertyList.filter(p => p.status === "Disponível" || p.status === "Reservado").length})</span></p>
                <p className="text-sm sm:text-base font-black text-foreground leading-tight truncate">
                  {formatCurrency(propertyList.filter(p => p.status === "Disponível" || p.status === "Reservado").reduce((sum, p) => sum + (p.price * (p.commission || 0) / 100), 0))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <Trophy className="w-5 h-5 text-red-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase text-red-600 leading-none truncate">VGV Vendidos <span className="text-muted-foreground font-medium">({propertyList.filter(p => p.status === "Vendido").length})</span></p>
                <p className="text-sm sm:text-base font-black text-foreground leading-tight truncate">
                  {formatCurrency(propertyList.filter(p => p.status === "Vendido").reduce((sum, p) => sum + p.price, 0))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Wallet className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-600 leading-none truncate">Comissões Pagas <span className="text-muted-foreground font-medium">({propertyList.filter(p => p.status === "Vendido").length})</span></p>
                <p className="text-sm sm:text-base font-black text-foreground leading-tight truncate">
                  {formatCurrency(propertyList.filter(p => p.status === "Vendido").reduce((sum, p) => sum + (p.price * (p.commission || 0) / 100), 0))}
                </p>
              </div>
            </div>
            {(() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
              const soldThisMonth = propertyList.filter(p => {
                if (p.status !== "Vendido") return false;
                const d = new Date(p.updatedAt || p.createdAt);
                return d >= firstDay && d <= lastDay;
              });
              return (
                <button
                  onClick={() => setShowSoldThisMonth(true)}
                  className="col-span-2 sm:col-span-1 flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-pointer text-left"
                >
                  <CalendarCheck className="w-5 h-5 text-purple-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase text-purple-600 leading-none truncate">Vendidos do Mês <span className="text-muted-foreground font-medium">({soldThisMonth.length})</span></p>
                    <p className="text-sm sm:text-base font-black text-foreground leading-tight truncate">
                      {formatCurrency(soldThisMonth.reduce((sum, p) => sum + p.price, 0))}
                    </p>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>


        {/* Freshness Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {/* Imóveis total card */}
          <button onClick={() => { clearFilters(); setActiveCategory("todos"); setFilterFreshness("all"); }} className="bg-card border border-primary/30 rounded-xl p-2 sm:p-4 text-left hover:bg-primary/5 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-primary">Imóveis</p>
                <p className="text-xl sm:text-3xl font-black text-foreground mt-0.5 sm:mt-1">{propertyList.filter(p => p.status === "Disponível" || p.status === "Reservado").length}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">ativos no portfólio</p>
              </div>
              <Building2 className="hidden sm:block w-6 h-6 sm:w-8 sm:h-8 text-primary/40 group-hover:text-primary/60 transition-colors" />
            </div>
          </button>
          <button
            onClick={() => setFilterFreshness(filterFreshness === "30" ? "all" : "30")}
            className={cn(
              "bg-card border rounded-xl p-2 sm:p-4 text-left transition-all hover:shadow-md group",
              filterFreshness === "30" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-500">Atualizados (30d)</p>
                <p className="text-xl sm:text-3xl font-black text-foreground mt-0.5 sm:mt-1">{freshnessStats.within30}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">imóveis em dia</p>
              </div>
              <div className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 items-center justify-center">
                <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              </div>
            </div>
          </button>
          <button
            onClick={() => setFilterFreshness(filterFreshness === "60" ? "all" : "60")}
            className={cn(
              "bg-card border rounded-xl p-2 sm:p-4 text-left transition-all hover:shadow-md group",
              filterFreshness === "60" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-500">Atenção (31-60d)</p>
                <p className="text-xl sm:text-3xl font-black text-foreground mt-0.5 sm:mt-1">{freshnessStats.within60}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">precisam de revisão</p>
              </div>
              <div className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 items-center justify-center">
                <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              </div>
            </div>
          </button>
          <button
            onClick={() => setFilterFreshness(filterFreshness === "90" ? "all" : "90")}
            className={cn(
              "bg-card border rounded-xl p-2 sm:p-4 text-left transition-all hover:shadow-md group",
              filterFreshness === "90" ? "border-destructive ring-2 ring-destructive/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-destructive">Desatualizados (+90d)</p>
                <p className="text-xl sm:text-3xl font-black text-foreground mt-0.5 sm:mt-1">{freshnessStats.over90}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">ação urgente</p>
              </div>
              <div className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-destructive/10 items-center justify-center">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              </div>
            </div>
          </button>
        </div>

        {/* Active freshness filter indicator */}
        {filterFreshness !== "all" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
            <span className="text-muted-foreground">Filtrando por:</span>
            <span className={cn("font-semibold",
              filterFreshness === "30" && "text-emerald-500",
              filterFreshness === "60" && "text-amber-500",
              filterFreshness === "90" && "text-destructive",
            )}>
              {filterFreshness === "30" ? "Atualizados nos últimos 30 dias" : filterFreshness === "60" ? "Atualizados entre 31-60 dias" : "Desatualizados há mais de 90 dias"}
            </span>
            <button onClick={() => setFilterFreshness("all")} className="ml-auto p-1 rounded hover:bg-muted">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Category Tabs + Search + Filters */}
        <div className="space-y-3">

          {/* Search + filter toggle + view */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome, endereço, cidade, corretor ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            {/* Desktop filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-input hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filtros
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-accent" />}
            </button>
            {/* Mobile filter button */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className={cn(
                "flex sm:hidden items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                hasActiveFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-input hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filtros
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-accent" />}
            </button>
            <div className="flex border border-input rounded-lg overflow-hidden">
              {([
                { key: "grid" as const, Icon: LayoutGrid },
                { key: "list" as const, Icon: List },
                { key: "map" as const, Icon: Map },
              ]).map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={cn(
                    "p-2.5 transition-colors",
                    view === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="hidden sm:block bg-card border border-border rounded-xl p-2 sm:p-3">
              <div className="flex flex-wrap gap-1.5">
                <div className="flex-1 min-w-[100px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Empreendimento</label>
                  <select value={filterEmpreendimento} onChange={(e) => setFilterEmpreendimento(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Todos</option>
                    {empreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[70px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Tipo</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Todos</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[90px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Proprietário</label>
                  <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Todos</option>
                    {owners.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[75px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Cidade</label>
                  <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Todas</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[75px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Bairro</label>
                  <select value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Todos</option>
                    {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[70px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Rua</label>
                  <select value={filterStreet} onChange={(e) => setFilterStreet(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Todas</option>
                    {streets.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[60px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Quartos</label>
                  <select value={filterBedrooms} onChange={(e) => setFilterBedrooms(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-</option>
                    <option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[60px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Suítes</label>
                  <select value={filterSuites} onChange={(e) => setFilterSuites(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-</option>
                    <option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[55px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Vagas</label>
                  <select value={filterParking} onChange={(e) => setFilterParking(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-</option>
                    <option value="1">1+</option><option value="2">2+</option><option value="3">3+</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[75px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Preço mín.</label>
                  <select value={filterPriceMin} onChange={(e) => setFilterPriceMin(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-</option>
                    <option value="200000">200k</option><option value="500000">500k</option><option value="800000">800k</option><option value="1000000">1M</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[75px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Preço máx.</label>
                  <select value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-full px-2 py-1.5 rounded border border-input text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-</option>
                    <option value="500000">500k</option><option value="800000">800k</option><option value="1000000">1M</option><option value="1500000">1,5M</option><option value="2000000">2M</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[75px]">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 block whitespace-nowrap">Inativos</label>
                  <button
                    onClick={() => setShowInactive(!showInactive)}
                    className={`w-full px-2 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                      showInactive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {showInactive ? "✓ Sim" : "Não"}
                  </button>
                </div>
                <div className="flex-1 min-w-[60px] flex items-end">
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 rounded bg-muted text-muted-foreground text-[11px] font-medium hover:bg-destructive/10 hover:text-destructive transition-colors w-full justify-center whitespace-nowrap">
                      <X className="w-3 h-3" /> Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category + Sort Bar with carousel arrows */}
        <div className="relative">
          <button
            onClick={() => catScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors -ml-1"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div
            ref={catScrollRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide bg-card border border-border rounded-lg px-8 py-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {user && (
              <>
                <button
                  onClick={() => setFilterMine(v => !v)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all",
                    filterMine
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-muted"
                  )}
                  title="Mostrar apenas meus imóveis"
                >
                  <User className="w-3 h-3" />
                  Meus Imóveis
                </button>
                <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />
              </>
            )}
            {categories.map((cat, idx) => (
              <button
                key={cat.key}
                draggable
                onDragStart={() => handleCatDragStart(idx)}
                onDragOver={(e) => handleCatDragOver(e, idx)}
                onDragEnd={handleCatDragEnd}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all cursor-grab active:cursor-grabbing",
                  activeCategory === cat.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                )}
              >
                <cat.icon className="w-3 h-3" />
                {cat.label}
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-1 flex-shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 whitespace-nowrap">Ordenar:</span>
            {([
              { key: "default", label: "Padrão" },
              { key: "price-desc", label: "Maior Valor" },
              { key: "price-asc", label: "Menor Valor" },
              { key: "name-asc", label: "A → Z Edifício" },
              { key: "name-desc", label: "Z → A Edifício" },
              { key: "updated", label: "Últ. Atualizados" },
              { key: "created", label: "Últ. Incluídos" },
            ] as { key: typeof sortBy; label: string }[]).map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap",
                  sortBy === s.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => catScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors -mr-1"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Results count + Favorites button */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm font-semibold text-muted-foreground">
            {sorted.length} imóvel(is)
            {sorted.length > ITEMS_PER_PAGE && ` • Página ${currentPage} de ${totalPages}`}
          </span>
          <button
            onClick={() => setShowFavoritesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
          >
            <Heart className={cn("w-3.5 h-3.5", favoriteIds.length > 0 && "fill-current")} /> Favoritos ({favoriteIds.length})
          </button>
        </div>

        {/* Content */}
        {view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {paginated.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onStatusChange={handleStatusChange}
                onSelect={setSelectedProperty}
                onViewTerm={setViewingTerm}
                isFavorited={favoriteIds.includes(property.id)}
                onToggleFavorite={toggleFavorite}
                isInRoute={routeIds.includes(property.id)}
                onToggleRoute={toggleRoute}
                onFilterByTitle={(title) => { setSearch(title.split(" ").slice(0, 2).join(" ")); setActiveCategory("todos"); }}
                onFilterByCondition={(cond) => { setFilterCondition(cond); setShowFilters(true); setActiveCategory("todos"); }}
                onFilterByOwner={(owner) => { setFilterOwner(owner); setShowFilters(true); setActiveCategory("todos"); }}
                canManage={isSuperAdmin || isAdminStaff || property.userId === user?.id}
                onDelete={(id) => setDeleteConfirmId(id)}
              />
            ))}
          </div>
        ) : view === "list" ? (
          <div className="space-y-3">
            {paginated.map((property) => (
              <PropertyRow
                key={property.id}
                property={property}
                onStatusChange={handleStatusChange}
                onSelect={setSelectedProperty}
                isFavorited={favoriteIds.includes(property.id)}
                onToggleFavorite={toggleFavorite}
                isInRoute={routeIds.includes(property.id)}
                onToggleRoute={toggleRoute}
                onFilterByTitle={(title) => { setSearch(title.split(" ").slice(0, 2).join(" ")); setActiveCategory("todos"); }}
                onFilterByCondition={(cond) => { setFilterCondition(cond); setShowFilters(true); setActiveCategory("todos"); }}
                onFilterByOwner={(owner) => { setFilterOwner(owner); setShowFilters(true); setActiveCategory("todos"); }}
                onPriceChange={handlePriceChange}
                allProperties={propertyList}
                onDealLabelChange={handleDealLabelChange}
                onNavigateToValuation={handleNavigateToValuation}
                onNavigateToContract={handleNavigateToContract}
                onQuickUpdate={handleQuickUpdate}
                onDuplicate={handleDuplicate}
                canManage={isSuperAdmin || isAdminStaff || property.userId === user?.id}
                onDelete={(id) => setDeleteConfirmId(id)}
              />
            ))}
          </div>
        ) : (
          <PropertyMap properties={sorted} onSelectProperty={(p) => setSelectedProperty(p)} />
        )}

        {/* Pagination */}
        {sorted.length > ITEMS_PER_PAGE && view !== "map" && (
          <div className="flex items-center justify-center gap-2 pt-4 pb-2">
            <button
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-input bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={cn(
                      "w-9 h-9 rounded-lg text-sm font-semibold transition-colors",
                      currentPage === page
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted border border-input"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-input bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum imóvel encontrado</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">Limpar filtros</button>
            )}
          </div>
        )}
      </div>

      {/* Favorites Modal */}
      {showFavoritesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4" onClick={() => setShowFavoritesModal(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Heart className="w-5 h-5 text-accent fill-current" /> Minha Lista ({favoriteIds.length})
              </h3>
              <div className="flex items-center gap-2">
                {favoritedProperties.length > 0 && (
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/todos-imoveis?ids=${favoritedProperties.map(p => p.id).join(",")}`;
                      const text = `Confira esta lista de imóveis selecionados:\n\n${favoritedProperties.map(p => `• ${p.title} - ${formatCurrency(p.price)}`).join("\n")}\n\n${url}`;
                      if (navigator.share) {
                        try { await navigator.share({ title: "Minha Lista de Imóveis", text, url }); return; } catch {}
                      }
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Link copiado!", { description: "Cole no WhatsApp ou onde quiser compartilhar." });
                      } catch {
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <Share2 className="w-4 h-4" /> Compartilhar
                  </button>
                )}
                <button onClick={() => setShowFavoritesModal(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              {favoritedProperties.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum imóvel favoritado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {favoritedProperties.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { setShowFavoritesModal(false); setSelectedProperty(p); }}
                      className="bg-background rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                    >
                      <div className="relative h-36 overflow-hidden">
                        <img src={p.images?.[0] || p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-accent hover:bg-white transition-colors"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="text-base font-bold text-foreground">{formatCurrency(p.price)}</p>
                        <h4 className="font-bold text-sm text-foreground truncate">{p.title}</h4>

                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" /> {p.address}, {p.city}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {p.bedrooms > 0 && <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" /> {p.bedrooms}</span>}
                          {p.area > 0 && <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" /> {p.area}m²</span>}
                          {p.parking > 0 && <span className="flex items-center gap-0.5"><Car className="w-3 h-3" /> {p.parking}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-end sm:hidden" onClick={() => setShowMobileFilters(false)}>
          <div className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={(e: any) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Filtros
              </h3>
              <button onClick={() => setShowMobileFilters(false)} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Empreendimento</label>
                <select value={filterEmpreendimento} onChange={(e) => setFilterEmpreendimento(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                  <option value="">Todos</option>
                  {empreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                  <option value="">Todos</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Proprietário</label>
                <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                  <option value="">Todos</option>
                  {owners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Cidade</label>
                  <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">Todas</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Bairro</label>
                  <select value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">Todos</option>
                    {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Rua</label>
                <select value={filterStreet} onChange={(e) => setFilterStreet(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                  <option value="">Todas</option>
                  {streets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Quartos</label>
                  <select value={filterBedrooms} onChange={(e) => setFilterBedrooms(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">-</option>
                    <option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Suítes</label>
                  <select value={filterSuites} onChange={(e) => setFilterSuites(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">-</option>
                    <option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Vagas</label>
                  <select value={filterParking} onChange={(e) => setFilterParking(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">-</option>
                    <option value="1">1+</option><option value="2">2+</option><option value="3">3+</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Preço mín.</label>
                  <select value={filterPriceMin} onChange={(e) => setFilterPriceMin(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">-</option>
                    <option value="200000">200k</option><option value="500000">500k</option><option value="800000">800k</option><option value="1000000">1M</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Preço máx.</label>
                  <select value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm bg-background text-foreground">
                    <option value="">-</option>
                    <option value="500000">500k</option><option value="800000">800k</option><option value="1000000">1M</option><option value="1500000">1,5M</option><option value="2000000">2M</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Mostrar inativos</label>
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    showInactive ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"
                  )}
                >
                  {showInactive ? "✓ Sim" : "Não"}
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                {hasActiveFilters && (
                  <button onClick={() => { clearFilters(); setShowMobileFilters(false); }} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg bg-muted text-muted-foreground text-sm font-semibold">
                    <X className="w-4 h-4" /> Limpar
                  </button>
                )}
                <button onClick={() => setShowMobileFilters(false)} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  <Filter className="w-4 h-4" /> Aplicar ({sorted.length} imóveis)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating tools */}
      <RoutePlanner properties={routeProperties} />
      

      {/* Sold confirmation dialog */}
      <SoldConfirmDialog
        open={!!pendingSold}
        propertyTitle={pendingSold?.title || ""}
        defaultDate={pendingSold?.dataVenda}
        onConfirm={handleConfirmSold}
        onCancel={() => setPendingSold(null)}
      />

      <ImportacoesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />


      {/* Property Detail Modal */}
      <PropertyDetailModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        allProperties={propertyList}
        brokerInfo={brokerInfo}
        onSelectSimilar={(p) => setSelectedProperty(p)}
        onUpdateProperty={(updated) => {
          setPropertyList((prev: any) => prev.map((p: any) => (p.id === updated.id ? updated : p)));
          setSelectedProperty(updated);
          // Persist to DB (only for real DB rows — uuid)
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updated.id);
          if (!isUuid) return;
          const patch: Record<string, any> = {
            titulo: updated.title,
            preco: updated.price ?? null,
            preco_parcelado: updated.priceInstallment ?? null,
            area_total: updated.area ?? null,
            area_privativa: updated.privateArea ?? null,
            dormitorios: updated.bedrooms ?? null,
            banheiros: updated.bathrooms ?? null,
            vagas: updated.parking ?? null,
            descricao: updated.description ?? null,
            posicao_predio: updated.posicaoPredio ?? null,
            posicao_solar: updated.posicaoSolar ?? null,
            vista: updated.vista ?? null,
            condicao: updated.condicao ?? null,
            infraestrutura: updated.infraestrutura ?? [],
            unidade: updated.unitNumber ?? null,
            box: updated.boxNumber ?? null,
            quadra: updated.quadra ?? null,
            lote: updated.lote ?? null,
            local_chaves: updated.keysLocation ?? null,
            responsavel_nome: updated.owner ?? null,
            responsavel_telefone: updated.ownerPhone ?? null,
            tipo_proprietario: updated.ownerType ?? null,
            comissao_percentual: updated.commission ?? null,
            bonus: updated.bonus != null ? String(updated.bonus) : null,
            validade_bonus: updated.bonusExpiry || null,
          };
          supabase.from("imoveis").update(patch as never).eq("id", updated.id).then(({ error }: any) => {
            if (error) toast.error("Falha ao salvar no banco: " + error.message);
          });
        }}
        onFilterByTitle={(title) => { setSelectedProperty(null); setSearch(title.split(" ").slice(0, 2).join(" ")); setActiveCategory("todos"); }}
        onFilterByCondition={(cond) => { setSelectedProperty(null); setFilterCondition(cond); setShowFilters(true); setActiveCategory("todos"); }}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Excluir imóvel</h3>
                <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o imóvel <strong className="text-foreground">{propertyList.find(p => p.id === deleteConfirmId)?.title}</strong>?
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 rounded-lg text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}


      {viewingTerm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingTerm(null)}>
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-foreground">Termo de Exclusividade</h3>
              </div>
              <div className="flex items-center gap-2">
                <a href={viewingTerm} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground bg-muted hover:bg-secondary transition-colors">
                  <Eye className="w-3.5 h-3.5" /> Abrir original
                </a>
                <button onClick={() => setViewingTerm(null)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-60px)] p-4 bg-muted/30 flex items-center justify-center">
              {viewingTerm.toLowerCase().endsWith(".pdf") ? (
                <iframe src={viewingTerm} className="w-full h-[75vh] rounded-lg border border-border" title="Termo de Exclusividade" />
              ) : (
                <img src={viewingTerm} alt="Termo de Exclusividade" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Vendidos do Mês */}
      {showSoldThisMonth && (() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const soldThisMonth = propertyList.filter(p => {
          if (p.status !== "Vendido") return false;
          const d = new Date(p.updatedAt || p.createdAt);
          return d >= firstDay && d <= lastDay;
        });
        const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowSoldThisMonth(false)}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-purple-600" /> Vendidos do Mês
                  </h3>
                  <p className="text-xs text-muted-foreground capitalize">{monthName} — {soldThisMonth.length} imóvel(is)</p>
                </div>
                <button onClick={() => setShowSoldThisMonth(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {soldThisMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Nenhum imóvel vendido este mês</p>
                ) : (
                  <div className="space-y-2">
                    {soldThisMonth.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { setShowSoldThisMonth(false); setSelectedProperty(p); }}
                      >
                        <img src={p.image} alt={p.title} className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.address}, {p.city}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs font-bold text-foreground">{formatCurrency(p.price)}</span>
                            {p.commission ? (
                              <span className="text-[10px] text-purple-600 font-medium">
                                Comissão: {formatCurrency(p.price * p.commission / 100)} ({p.commission}%)
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(p.updatedAt || p.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-border pt-3 px-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">Total VGV Vendido</span>
                      <span className="text-sm font-black text-foreground">{formatCurrency(soldThisMonth.reduce((s, p) => s + p.price, 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </AppLayout>
  );
}

// ---- Image Carousel ----
function ImageCarousel({ images: rawImages, alt }: { images?: string[]; alt: string }) {
  const images = rawImages && rawImages.length > 0 ? rawImages : [PLACEHOLDER_IMAGE];
  const [current, setCurrent] = useState(0);

  return (
    <div className="relative h-48 overflow-hidden group/carousel">
      {images.map((src, i) => (
        <img key={i} src={src} alt={`${alt} ${i + 1}`} className={cn("absolute inset-0 w-full h-full object-cover transition-all duration-500", i === current ? "opacity-100 scale-100" : "opacity-0 scale-105")} />
      ))}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c === 0 ? images.length - 1 : c - 1)); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-foreground/80">
            <ChevronLeft className="w-4 h-4 text-background" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c === images.length - 1 ? 0 : c + 1)); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-foreground/80">
            <ChevronRight className="w-4 h-4 text-background" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === current ? "bg-background w-4" : "bg-background/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Status Bar ----
function StatusBar({ currentStatus, onChangeStatus }: { currentStatus: Property["status"]; onChangeStatus: (status: Property["status"]) => void }) {
  return (
    <div className="flex gap-1.5">
      {allStatuses.filter(s => s !== "Reservado").map((status) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const isActive = status === currentStatus;
        return (
          <button key={status} onClick={(e) => { e.stopPropagation(); onChangeStatus(status); }} className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-all duration-200", isActive ? `${config.bg} ${config.color} ${config.border} shadow-sm` : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted")}>
            <Icon className="w-3 h-3" /> {statusLabels[status]}
          </button>
        );
      })}
    </div>
  );
}

// ---- Update Badge ----
function UpdateBadge({ updatedAt, createdAt, compact }: { updatedAt?: string; createdAt: string; compact?: boolean }) {
  const date = updatedAt || createdAt;
  const updated = new Date(date);
  const now = new Date();
  const days = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = updated.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const color = days <= 30
    ? "text-emerald-500 bg-emerald-500/10"
    : days <= 60
    ? "text-amber-500 bg-amber-500/10"
    : "text-destructive bg-destructive/10";

  const label = days <= 30 ? "Atualizado" : days <= 60 ? "Revisar" : "Desatualizado";
  const Icon = days <= 30 ? CalendarCheck : days <= 60 ? CalendarClock : AlertTriangle;

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold", color)}>
        <Icon className="w-3 h-3" />
        {formatted} • {days}d
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold", color)}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span>{label} • {formatted}</span>
      </div>
      <span className="text-[10px] opacity-70">{days} dias</span>
    </div>
  );
}

// ---- Sold Celebration ----
function SoldCelebration() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i, left: `${5 + Math.random() * 90}%`, delay: `${Math.random() * 0.6}s`,
    color: ["hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--info))", "hsl(38 100% 65%)", "hsl(0 84% 60%)"][Math.floor(Math.random() * 5)],
    size: Math.random() * 8 + 4, rotate: Math.random() * 360,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20 rounded-xl">
      <div className="absolute inset-0 bg-foreground/40 animate-[fade-in_0.3s_ease-out]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center animate-sold-stamp">
        <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center mb-2 shadow-lg">
          <Trophy className="w-8 h-8 text-primary" />
        </div>
        <div className="bg-card/95 backdrop-blur-sm rounded-lg px-5 py-2 shadow-xl border border-accent/30">
          <p className="text-lg font-black text-accent tracking-wider">VENDIDO!</p>
        </div>
      </div>
      {particles.map((p) => (
        <div key={p.id} className="absolute animate-confetti-fall" style={{ left: p.left, top: "-10px", animationDelay: p.delay, width: p.size, height: p.size, borderRadius: Math.random() > 0.5 ? "50%" : "2px", backgroundColor: p.color, transform: `rotate(${p.rotate}deg)` }} />
      ))}
    </div>
  );
}

// ---- PropertyCard (enhanced) ----
function PropertyCard({
  property, onStatusChange, onSelect, onViewTerm, isFavorited, onToggleFavorite, isInRoute, onToggleRoute, onFilterByTitle, onFilterByCondition, onDelete, canManage = true,
}: {
  property: Property;
  onStatusChange: (id: string, status: Property["status"]) => void;
  onSelect?: (p: Property) => void;
  onViewTerm?: (url: string) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  isInRoute?: boolean;
  onToggleRoute?: (id: string) => void;
  onFilterByTitle?: (title: string) => void;
  onFilterByCondition?: (cond: string) => void;
  onFilterByOwner?: (owner: string) => void;
  onDelete?: (id: string) => void;
  canManage?: boolean;
}) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [animatePulse, setAnimatePulse] = useState(false);
  const fallback = brokerInfo[property.broker] || { photo: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop&crop=face", whatsapp: "5511999999999" };
  const broker = {
    photo: property.brokerPhoto || fallback.photo,
    whatsapp: property.brokerWhatsapp || fallback.whatsapp,
  };
  const whatsappMessage = encodeURIComponent(`Olá! Tenho interesse no imóvel: ${property.title} - ${formatCurrency(property.price)}`);
  const unitParts = formatUnitParts(property);

  const handleStatusChange = (newStatus: Property["status"]) => {
    if (newStatus === "Vendido" && property.status !== "Vendido") {
      setShowCelebration(true); setAnimatePulse(true);
      setTimeout(() => setShowCelebration(false), 2500);
      setTimeout(() => setAnimatePulse(false), 800);
    }
    onStatusChange(property.id, newStatus);
  };

  return (
    <div className={cn("elevated-card rounded-xl overflow-hidden relative transition-all duration-300 group/card", animatePulse && "animate-sold-pulse")}>
      {showCelebration && <SoldCelebration />}

      <div className="relative cursor-pointer" onClick={() => onSelect?.(property)}>
        <ImageCarousel images={property.images} alt={property.title} />

        {/* Owner type badge */}
        {property.ownerType && (() => {
          const ownerColors: Record<string, string> = {
            Construtora: "bg-blue-600 text-white border-blue-700",
            Investidor: "bg-amber-500 text-white border-amber-600",
            Particular: "bg-emerald-500 text-white border-emerald-600",
            "Adm Comercial": "bg-purple-500 text-white border-purple-600",
          };
          const ownerIcons: Record<string, typeof User> = {
            Construtora: Building2,
            Investidor: DollarSign,
            Particular: User,
            "Adm Comercial": ShieldCheck,
          };
          const OwnerIcon = ownerIcons[property.ownerType] || User;
          return (
            <span className={cn("absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-lg border flex items-center gap-1.5", ownerColors[property.ownerType] || "bg-muted text-foreground border-border")}>
              <OwnerIcon className="w-3.5 h-3.5" />
              {property.ownerType}
            </span>
          );
        })()}

        {/* Exclusivity badge */}
        {property.exclusivityTermUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewTerm?.(property.exclusivityTermUrl!); }}
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-sm hover:bg-amber-600 transition-colors z-20 shadow-md"
            title="Ver termo"
          >
            <FileCheck className="w-3 h-3" /> Ex.Assinada
          </button>
        )}

        {/* Route selector */}
        <button onClick={(e) => { e.stopPropagation(); onToggleRoute?.(property.id); }}
          className={cn("absolute z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110",
            property.exclusivityTermUrl ? "top-12 right-3" : "top-3 right-3",
            isInRoute ? "bg-blue-600 text-white" : "bg-foreground/30 text-white hover:bg-blue-600"
          )}
          title={isInRoute ? "Remover da rota" : "Adicionar à rota"}
        >
          <Route className={cn("w-4 h-4", isInRoute && "fill-current")} />
        </button>

        {/* Favorite */}
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(property.id); }}
          className={cn("absolute z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110",
            property.exclusivityTermUrl ? "top-[5.5rem] right-3" : "top-12 right-3",
            isFavorited ? "bg-red-500 text-white" : "bg-foreground/30 text-white hover:bg-red-500"
          )}
          title={isFavorited ? "Remover dos favoritos" : "Favoritar"}
        >
          <Heart className={cn("w-4 h-4", isFavorited && "fill-current")} />
        </button>


        {/* Badges (sea/decorated) */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-end">
          <div className="flex gap-1">
            {property.seaView && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/90 text-white backdrop-blur-sm flex items-center gap-0.5"><Waves className="w-2.5 h-2.5" /> Mar</span>}
            {property.decorated && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/90 text-white backdrop-blur-sm flex items-center gap-0.5"><Paintbrush className="w-2.5 h-2.5" /> Dec.</span>}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(property.price)}</p>
          <h3 className="font-semibold text-card-foreground text-sm cursor-pointer hover:text-primary transition-colors uppercase mt-1"
            onClick={() => onSelect?.(property)}
            title="Ver detalhes do imóvel"
          >{property.title}</h3>

          {(property.empreendimento || unitParts.length > 0) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {property.empreendimento && (
                <Link
                  to="/empreendimentos/$id"
                  params={{ id: property.edificioId || property.condominioId || property.empreendimentoId || "" }}
                  className="text-[12px] font-bold text-foreground uppercase tracking-wide bg-accent/10 px-1.5 py-0.5 rounded hover:bg-accent/20 transition-colors"
                  onClick={(e: any) => e.stopPropagation()}
                  title="Abrir página do empreendimento"
                >
                  {cleanEmpreendimentoName(property.empreendimento)}
                </Link>
              )}
              {unitParts.map((part) => (
                <span key={part} className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{part}</span>
              ))}
            </div>
          )}
          <button
            className="flex items-center gap-1 mt-1 hover:text-primary transition-colors group"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${property.city}`)}`, "_blank");
            }}
            title="Abrir localização no Google Maps"
          >
            <MapPin className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
            <p className="text-xs text-muted-foreground group-hover:text-primary">{property.address}, {property.city}</p>
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-y border-border">
          {property.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {property.bedrooms}</span>}
          {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {property.bathrooms}</span>}
          {property.parking > 0 && <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {property.parking}</span>}
          <span className="flex items-center gap-1"><Scan className="w-3.5 h-3.5" /> {property.area}m² t.</span>
          {property.privateArea && <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> {property.privateArea}m² p.</span>}
        </div>

        {/* Payment conditions */}
        {property.paymentConditions && property.paymentConditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {property.paymentConditions.map((cond) => (
              <button
                key={cond}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onFilterByCondition?.(cond); }}
                title={`Ver imóveis com condição "${cond}"`}
              >
                {cond}
              </button>
            ))}
          </div>
        )}

        {/* Last update indicator */}
        <UpdateBadge updatedAt={property.updatedAt} createdAt={property.createdAt} />

        {/* Broker + WhatsApp removidos — somente admin cadastra */}


        {/* Edit + Delete + Status */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {canManage && (
            <>
              <Link
                to="/imoveis/$id/editar"
                params={{ id: property.id }}

                onClick={(e: any) => e.stopPropagation()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-[11px] font-bold hover:bg-amber-500/20 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Editar
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(property.id); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[11px] font-bold hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Excluir
              </button>
            </>
          )}
          <div className="flex-1">
            <StatusBar currentStatus={property.status} onChangeStatus={handleStatusChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Row Carousel (compact) ----
function RowCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  return (
    <div className="relative w-full h-full min-h-[140px] overflow-hidden group/row-carousel">
      {images.map((src, i) => (
        <img key={i} src={src} alt={`Foto ${i + 1}`} className={cn("absolute inset-0 w-full h-full object-cover transition-all duration-400", i === current ? "opacity-100" : "opacity-0")} />
      ))}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c === 0 ? images.length - 1 : c - 1)); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-foreground/50 backdrop-blur-sm flex items-center justify-center opacity-100 md:opacity-0 md:group-hover/row-carousel:opacity-100 transition-opacity active:scale-95 touch-manipulation"
            aria-label="Foto anterior">
            <ChevronLeft className="w-3.5 h-3.5 text-background" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c === images.length - 1 ? 0 : c + 1)); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-foreground/50 backdrop-blur-sm flex items-center justify-center opacity-100 md:opacity-0 md:group-hover/row-carousel:opacity-100 transition-opacity active:scale-95 touch-manipulation"
            aria-label="Próxima foto">
            <ChevronRight className="w-3.5 h-3.5 text-background" />
          </button>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            {images.map((_, i) => (
              <span key={i} className={cn("w-1 h-1 rounded-full transition-all", i === current ? "bg-background w-3" : "bg-background/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Inline Price Editor ----
function InlinePrice({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(String(value));
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const parsed = parseFloat(draft.replace(/[^\d]/g, ""));
    if (!isNaN(parsed) && parsed > 0 && parsed !== value) onChange(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className={cn("bg-transparent border-b border-primary outline-none text-right w-[120px]", className)}
        onClick={(e: any) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn("cursor-pointer hover:opacity-70 transition-opacity", className)}
      onClick={startEdit}
      title="Clique para editar o valor"
    >
      {formatCurrency(value)}
    </span>
  );
}

// ---- Deal Score Analysis ----
interface DealScore {
  score: number; // 0-100
  label: "Oferta" | "Bom Negócio" | "Normal" | "Acima da Média";
  estimatedDays: number;
  pricePerM2: number;
  avgPricePerM2: number;
}

function analyzeDealScore(property: Property, allProperties: Property[]): DealScore {
  // Find similar properties: same type, same city or nearby, similar bedrooms (±1), similar area (±40%)
  const similar = allProperties.filter(p =>
    p.id !== property.id &&
    p.type === property.type &&
    (p.city === property.city || (p.neighborhood && p.neighborhood === property.neighborhood)) &&
    Math.abs(p.bedrooms - property.bedrooms) <= 1 &&
    (property.area > 0 && p.area > 0 ? Math.abs(p.area - property.area) / property.area <= 0.4 : true) &&
    p.status !== "Vendido" && p.status !== "Suspenso"
  );

  const pricePerM2 = property.area > 0 ? property.price / property.area : 0;

  if (similar.length === 0) {
    return { score: 50, label: "Normal", estimatedDays: 90, pricePerM2, avgPricePerM2: pricePerM2 };
  }

  const avgPricePerM2 = similar.reduce((sum, p) => sum + (p.area > 0 ? p.price / p.area : 0), 0) / similar.length;
  const avgPrice = similar.reduce((sum, p) => sum + p.price, 0) / similar.length;

  // Score: how much cheaper vs average (higher = better deal)
  const priceDiffPercent = avgPrice > 0 ? ((avgPrice - property.price) / avgPrice) * 100 : 0;
  const m2DiffPercent = avgPricePerM2 > 0 ? ((avgPricePerM2 - pricePerM2) / avgPricePerM2) * 100 : 0;

  // Combined score weighted: 60% price comparison, 40% m2 comparison
  let rawScore = (priceDiffPercent * 0.6 + m2DiffPercent * 0.4);

  // Bonus for extras
  if (property.seaView) rawScore += 5;
  if (property.decorated) rawScore += 3;
  if (property.acceptsExchange) rawScore += 2;
  if (property.bonus && property.bonus > 0) rawScore += 3;

  // More comparables = more confidence, slightly adjust
  if (similar.length >= 5) rawScore += 2;
  if (similar.length >= 10) rawScore += 2;

  // Normalize to 0-100
  const score = Math.max(0, Math.min(100, 50 + rawScore * 2));

  // Label
  let label: DealScore["label"];
  if (score >= 80) label = "Oferta";
  else if (score >= 60) label = "Bom Negócio";
  else if (score >= 40) label = "Normal";
  else label = "Acima da Média";

  // Estimated days to sell (higher score = faster, more comparables = more demand = faster)
  const demandFactor = Math.min(1, similar.length / 10); // 0-1 based on how many similar exist
  const baseDays = 180 - score * 1.5;
  const estimatedDays = Math.max(7, Math.round(baseDays * (1 - demandFactor * 0.2)));

  return { score, label, estimatedDays, pricePerM2, avgPricePerM2 };
}

// ---- Deal Thermometer Component ----
function DealThermometer({ dealScore, manualLabel }: { dealScore: DealScore; manualLabel?: Property["dealLabel"] }) {
  const effectiveLabel = manualLabel || dealScore.label;
  const { score, estimatedDays } = dealScore;

  const getThermometerColor = () => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-emerald-400";
    if (score >= 40) return "bg-amber-400";
    return "bg-red-400";
  };

  const getLabelStyle = (lbl: string) => {
    if (lbl === "Oferta") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (lbl === "Bom Negócio") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (lbl === "Normal") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  const getTimeIcon = () => {
    if (estimatedDays <= 30) return "🔥";
    if (estimatedDays <= 60) return "⚡";
    if (estimatedDays <= 90) return "📊";
    return "🕐";
  };
  return (
    <div className="mt-1.5 space-y-1">
      {/* Deal label badge */}
      <div className="flex items-center gap-1.5">
        <span className={cn("text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border", getLabelStyle(effectiveLabel))}>
          {effectiveLabel === "Oferta" || effectiveLabel === "Bom Negócio" ? "🏷️ " : ""}{effectiveLabel}
        </span>
        {manualLabel && <span className="text-[7px] text-muted-foreground italic">manual</span>}
        <span className="text-[8px] text-muted-foreground font-semibold">
          R$ {Math.round(dealScore.pricePerM2).toLocaleString("pt-BR")}/m²
        </span>
      </div>

      {/* Thermometer bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", getThermometerColor())}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-[8px] font-black text-muted-foreground">{Math.round(score)}%</span>
      </div>

      {/* Estimated sale time */}
      <div className="flex items-center gap-1">
        <span className="text-[8px] text-muted-foreground">
          {getTimeIcon()} Prev. venda: <span className="font-bold text-foreground">{estimatedDays <= 30 ? `~${estimatedDays} dias` : estimatedDays <= 60 ? "~1-2 meses" : estimatedDays <= 90 ? "~2-3 meses" : `~${Math.round(estimatedDays / 30)} meses`}</span>
        </span>
      </div>
    </div>
  );
}

const cleanEmpreendimentoName = (name: string) => name.replace(/^(Ed\.\s*|Cond\.\s*|Edifício\s*|Condomínio\s*)/i, "").trim();

// ---- PropertyRow (redesigned) ----
function PropertyRow({
  property, onStatusChange, onSelect, isFavorited, onToggleFavorite, isInRoute, onToggleRoute, onFilterByTitle, onFilterByCondition, onFilterByOwner, onPriceChange, allProperties, onDealLabelChange, onNavigateToValuation, onNavigateToContract, onQuickUpdate, onDuplicate, onDelete, canManage = true,
}: {
  property: Property;
  onStatusChange: (id: string, status: Property["status"]) => void;
  onSelect?: (p: Property) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  isInRoute?: boolean;
  onToggleRoute?: (id: string) => void;
  onFilterByTitle?: (title: string) => void;
  onFilterByCondition?: (cond: string) => void;
  onFilterByOwner?: (owner: string) => void;
  onPriceChange?: (id: string, field: "price" | "priceInstallment", value: number) => void;
  allProperties?: Property[];
  onDealLabelChange?: (id: string, label: Property["dealLabel"]) => void;
  onNavigateToValuation?: (p: Property) => void;
  onNavigateToContract?: (p: Property) => void;
  onQuickUpdate?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  canManage?: boolean;
}) {
  const dealScore = useMemo(() => analyzeDealScore(property, allProperties || []), [property, allProperties]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [animatePulse, setAnimatePulse] = useState(false);

  const handleStatusChange = (newStatus: Property["status"]) => {
    if (newStatus === "Vendido" && property.status !== "Vendido") {
      setShowCelebration(true); setAnimatePulse(true);
      setTimeout(() => setShowCelebration(false), 2500);
      setTimeout(() => setAnimatePulse(false), 800);
    }
    onStatusChange(property.id, newStatus);
  };

  const createdFormatted = new Date(property.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const updatedDate = property.updatedAt || property.createdAt;
  const updatedFormatted = new Date(updatedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(updatedDate).getTime()) / (1000 * 60 * 60 * 24));
  const updateColor = daysSinceUpdate <= 30 ? "text-emerald-500" : daysSinceUpdate <= 60 ? "text-amber-500" : "text-destructive";

  const ownerTypeConfig: Record<string, { icon: typeof User; color: string; label: string }> = {
    Construtora: { icon: Building2, color: "text-blue-400 bg-blue-500/10", label: "Construtora" },
    Investidor: { icon: DollarSign, color: "text-amber-400 bg-amber-500/10", label: "Investidor" },
    Particular: { icon: User, color: "text-emerald-400 bg-emerald-500/10", label: "Particular" },
    "Adm Comercial": { icon: ShieldCheck, color: "text-purple-400 bg-purple-500/10", label: "Adm Comercial" },
  };

  const ownerTypeInfo = property.ownerType ? ownerTypeConfig[property.ownerType] : null;
  const unitParts = formatUnitParts(property);

  return (
    <div className={cn("elevated-card rounded-xl relative overflow-hidden transition-all duration-300", animatePulse && "animate-sold-pulse")}>
      {showCelebration && <SoldCelebration />}

      <div className="flex flex-col md:flex-row md:items-stretch">

        {/* ── COL 1: Foto com carrossel ── */}
        <div className="relative w-full md:w-[220px] h-[200px] md:h-auto flex-shrink-0">
          <RowCarousel images={property.images.length > 0 ? property.images : [property.image]} />
          {ownerTypeInfo && (
            <span className={cn("absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide shadow-sm", ownerTypeInfo.color)}>
              {ownerTypeInfo.label}
            </span>
          )}
          {/* Route selector on photo */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleRoute?.(property.id); }}
            className={cn("absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110",
              isInRoute ? "bg-blue-600 text-white" : "bg-foreground/30 text-white hover:bg-blue-600"
            )}
            title={isInRoute ? "Remover da rota" : "Adicionar à rota"}
          >
            <Route className={cn("w-4 h-4", isInRoute && "fill-current")} />
          </button>
          {/* Favorite heart on photo */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(property.id); }}
            className={cn("absolute top-11 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110",
              isFavorited ? "bg-red-500 text-white" : "bg-foreground/30 text-white hover:bg-red-500"
            )}
            title={isFavorited ? "Remover dos favoritos" : "Favoritar"}
          >
            <Heart className={cn("w-4 h-4", isFavorited && "fill-current")} />
          </button>
        </div>

        {/* ── COL 2: Identidade + Dados Técnicos ── */}
        <div className="flex-1 min-w-0 md:basis-[380px] md:max-w-[440px] md:border-r border-border px-4 py-3 flex flex-col justify-center gap-2 overflow-hidden">
          {/* Row 1: Title + Code */}
          <div className="flex items-start gap-2 min-w-0">
            <h3
              className="flex-1 min-w-0 font-bold text-card-foreground text-base hover:text-primary cursor-pointer transition-colors leading-snug uppercase line-clamp-2 break-words"
              onClick={() => onSelect?.(property)}
              title={property.title}
            >{property.title}</h3>
            {property.code && (
              <span className="text-[11px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{property.code}</span>
            )}
          </div>

          {/* Row 1b: Site/Destaque toggles */}
          <div className="flex items-center gap-1 flex-wrap">
            <SiteToggleButton propertyId={property.id} field="ativo_site" icon={Globe} activeColor="text-emerald-500 bg-emerald-500/10" title="Ativo no Site" showLabel={false} />
            <DestaqueSelector propertyId={property.id} compact />
          </div>

          {/* Row 2: Empreendimento + Units */}
          {(property.empreendimento || unitParts.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {property.empreendimento && (
                <Link
                  to="/empreendimentos/$id"
                  params={{ id: property.edificioId || property.condominioId || property.empreendimentoId || "" }}
                  className="font-black text-foreground uppercase text-[13px] tracking-wide px-3 py-0.5 rounded-md border border-border bg-background hover:bg-muted transition-colors shadow-sm"
                  onClick={(e: any) => e.stopPropagation()}
                  title="Abrir página do empreendimento"
                >{cleanEmpreendimentoName(property.empreendimento)}</Link>
              )}
              {unitParts.map((part) => (
                <span key={part} className="font-black text-foreground uppercase text-[12px] tracking-wide px-2.5 py-0.5 rounded-md border border-border bg-background shadow-sm">{part}</span>
              ))}
            </div>
          )}

          {/* Row 3: Type + Specs (inline) */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {property.bedrooms > 0 && <span className="flex items-center gap-0.5 whitespace-nowrap"><BedDouble className="w-3 h-3" />{property.bedrooms}</span>}
            {property.bathrooms > 0 && <span className="flex items-center gap-0.5 whitespace-nowrap"><Bath className="w-3 h-3" />{property.bathrooms}</span>}
            {property.parking > 0 && <span className="flex items-center gap-0.5 whitespace-nowrap"><Car className="w-3 h-3" />{property.parking}</span>}
            <span className="flex items-center gap-0.5 font-semibold whitespace-nowrap"><Scan className="w-3 h-3" />{property.area}m² t.</span>
            {property.privateArea && <span className="flex items-center gap-0.5 font-semibold whitespace-nowrap"><Maximize2 className="w-3 h-3" />{property.privateArea}m² p.</span>}
          </div>

          {/* Row 3a: Características do apartamento */}
          {/* Tags - hidden by default, shown on hover */}
          <div className="hidden group-hover/card:block transition-all">
            {(property.vista || property.condicao || property.posicaoPredio || property.posicaoSolar || property.seaView || property.decorated) && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap mb-1.5">
                {property.vista && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 font-semibold whitespace-nowrap">
                    <Eye className="w-3 h-3" /> {property.vista}
                  </span>
                )}
                {property.seaView && !property.vista?.toLowerCase().includes("mar") && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold whitespace-nowrap">🌊 Vista Mar</span>
                )}
                {property.condicao && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold whitespace-nowrap">
                    🏠 {property.condicao}
                  </span>
                )}
                {property.decorated && !property.condicao?.toLowerCase().includes("decorado") && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold whitespace-nowrap">🎨 Decorado</span>
                )}
                {property.posicaoPredio && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted font-semibold whitespace-nowrap">
                    <Building2 className="w-3 h-3" /> {property.posicaoPredio}
                  </span>
                )}
                {property.posicaoSolar && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold whitespace-nowrap">
                    ☀️ {property.posicaoSolar}
                  </span>
                )}
              </div>
            )}

            {(property.infraestrutura && property.infraestrutura.length > 0) && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                {property.infraestrutura.map((item, i) => (
                  <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted font-semibold whitespace-nowrap">
                    🏗️ {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Row 4: Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {property.exclusivityTermUrl && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold whitespace-nowrap">📄 Exclusivo</span>}
          </div>

          {/* Row 5: Location */}
          <button
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors text-left"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${property.neighborhood || ""}, ${property.city}`)}`, "_blank");
            }}
          >
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{property.city}{property.neighborhood ? ` • ${property.neighborhood}` : ""} • {property.address}</span>
          </button>

          {/* Ver dados completos */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <button
              onClick={() => onSelect?.(property)}
              className="py-1.5 px-3 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> Ver dados completos
            </button>
          </div>
        </div>

        {/* ── COL 3: Financeiro ── */}
        <div className="w-full md:flex-1 md:min-w-[230px] md:max-w-[260px] flex-shrink-0 md:border-r border-border px-4 py-3 flex flex-col justify-center gap-1 overflow-hidden" onClick={(e: any) => e.stopPropagation()}>
          {/* Main price */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <Banknote className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary uppercase tracking-wider">Valor do Imóvel</span>
          </div>
          <div className="flex items-center gap-1">
            <InlinePrice value={property.price} onChange={(v) => onPriceChange?.(property.id, "price", v)} className="text-[22px] font-black text-emerald-500 drop-shadow-sm" />
            {(() => {
              const original = initialProperties.find(p => p.id === property.id);
              if (!original || original.price === property.price) return null;
              return property.price > original.price
                ? <ArrowUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <ArrowDown className="w-4 h-4 text-red-500 flex-shrink-0" />;
            })()}
          </div>

          {/* Promotional price */}
          {property.priceInstallment && (
            <div className="mt-0.5">
              <InlinePrice value={property.priceInstallment} onChange={(v) => onPriceChange?.(property.id, "priceInstallment", v)} className="text-[14px] font-bold text-red-500" />
              <span className="text-[8px] text-muted-foreground uppercase font-semibold tracking-wider ml-1">Valor Promocional</span>
            </div>
          )}

          {/* Payment conditions */}
          {property.paymentConditions && property.paymentConditions.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {property.paymentConditions.map((cond) => (
                <button key={cond}
                  className="px-1.5 py-0.5 rounded text-[9px] font-black text-foreground bg-muted uppercase tracking-wide hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => onFilterByCondition?.(cond)}
                >{cond}</button>
              ))}
            </div>
          )}

          {/* Commission */}
          {property.commission != null && (
            <div className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded bg-primary/10 border border-primary/20">
              <Percent className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-primary uppercase tracking-wide">Comissão {property.commission}%</span>
                <span className="text-[14px] font-black text-primary">{formatCurrency(Math.round(property.price * (property.commission / 100)))}</span>
              </div>
            </div>
          )}

          {/* Bonus */}
          {property.bonus != null && (
            <div className="flex items-center gap-1 mt-0.5">
              <Gift className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />
              <span className="text-[8px] font-bold text-red-500 uppercase">Bônus</span>
              <span className="text-[10px] font-black text-red-500">{formatCurrency(property.bonus)}</span>
              {property.bonusExpiry && (
                <span className="text-[8px] font-medium text-red-400">• Val. {new Date(property.bonusExpiry).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          )}

        </div>

        {/* ── COL 3.5: Analytics ── */}
        <div className="w-full md:flex-1 md:min-w-[200px] md:max-w-[220px] flex-shrink-0 md:border-r border-border px-4 py-3 flex flex-col justify-center gap-2" onClick={(e: any) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary uppercase tracking-wider">Analytics</span>
          </div>

          {/* Deal Thermometer */}
          <DealThermometer dealScore={dealScore} manualLabel={property.dealLabel} />

          {/* View counter */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/50">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[12px] font-bold text-foreground">{property.views ?? 0}</span>
            <span className="text-[10px] text-muted-foreground">views</span>
          </div>

        </div>

        {/* ── COL 4: Proprietário + Chaves + Datas + Status ── */}
        <div className="w-full md:flex-1 md:min-w-[220px] md:max-w-[260px] flex-shrink-0 md:border-r border-border px-4 py-3 flex flex-col justify-center gap-1.5" onClick={(e: any) => e.stopPropagation()}>

          {/* Proprietário */}
          <div className="border-b border-border pb-1.5 mb-0.5">
            <div className="flex items-center gap-1 mb-0.5">
              <User className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="text-[9px] font-black text-primary uppercase tracking-wider">Proprietário</span>
            </div>
            {property.owner ? (
              <button
                onClick={(e) => { e.stopPropagation(); onFilterByOwner?.(property.owner!); }}
                className="text-[12px] font-bold text-foreground leading-tight hover:text-primary transition-colors text-left truncate w-full"
                title="Filtrar por este proprietário"
              >{property.owner}</button>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Sem proprietário</span>
            )}
            {property.ownerPhone && (
              <a
                href={`https://wa.me/55${property.ownerPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-400 font-semibold mt-0.5"
              >
                <Phone className="w-2.5 h-2.5" /> {property.ownerPhone}
              </a>
            )}
          </div>

          {/* Chaves */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground border-b border-border pb-1.5 mb-0.5">
            <Key className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
            <span className="font-bold text-foreground leading-tight truncate">{property.keysLocation || "Chaves: não informado"}</span>
          </div>
          {/* Dates */}
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-0.5"><CalendarCheck className="w-3 h-3" /> Inclusão</span>
              <span className="font-medium text-foreground">{createdFormatted}</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-0.5"><CalendarClock className="w-3 h-3" /> Atualização</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onQuickUpdate?.(property.id); }}
                  title="Atualizar data agora"
                  className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <span className={cn("font-semibold", updateColor)}>{updatedFormatted}</span>
              </div>
            </div>
          </div>
          {/* Quick status selector */}
          <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
            {allStatuses.map((s) => {
              const cfg = statusConfig[s];
              const active = s === property.status;
              return (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={cn("px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wide transition-all",
                    active ? `${cfg.bg} ${cfg.color} ${cfg.border} border` : "text-muted-foreground hover:bg-muted"
                  )}
                >{statusLabels[s]}</button>
              );
            })}
          </div>
        </div>

        {/* ── COL 5: Ações (ícones) ── */}
        <div className="w-full md:w-[52px] flex-shrink-0 flex flex-row md:flex-col items-center justify-start gap-1.5 py-2 px-3 md:px-0" onClick={(e: any) => e.stopPropagation()}>
          {canManage && (
            <button
              onClick={() => window.location.href = `/imoveis/${property.id}/editar`}
              className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors" title="Editar"
            ><Pencil className="w-3.5 h-3.5 text-primary" /></button>
          )}
          <button
            onClick={async () => {
              if (!property.images || property.images.length === 0) { toast.error("Nenhuma foto disponível."); return; }
              toast.info("Preparando ZIP com as fotos...");
              try {
                const JSZip = (await import("jszip")).default;
                const zip = new JSZip();
                const folder = zip.folder(property.title.replace(/\s+/g, "_")) || zip;
                await Promise.all(property.images.map(async (img, i) => {
                  try {
                    const resp = await fetch(img);
                    const blob = await resp.blob();
                    const ext = blob.type.includes("png") ? "png" : "jpg";
                    folder.file(`foto_${i + 1}.${ext}`, blob);
                  } catch { /* skip failed */ }
                }));
                const content = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(content);
                const a = document.createElement("a");
                a.href = url; a.download = `${property.title.replace(/\s+/g, "_")}_fotos.zip`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`ZIP com ${property.images.length} foto(s) baixado!`);
              } catch { toast.error("Erro ao gerar ZIP."); }
            }}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors" title="Baixar todas as fotos (ZIP)"
          ><Image className="w-3.5 h-3.5 text-foreground" /></button>
          <button
            onClick={() => {
              if (property.linkMaterial) {
                window.open(property.linkMaterial, "_blank");
              } else {
                toast.info("Nenhum link de Drive cadastrado para este imóvel.");
              }
            }}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors" title="Baixar Drive completo"
          ><HardDrive className="w-3.5 h-3.5 text-foreground" /></button>
          <button
            onClick={() => {
              const text = `🏠 *${property.title}*\n📍 ${property.address}${property.neighborhood ? `, ${property.neighborhood}` : ""} — ${property.city}\n💰 ${formatCurrency(property.price)}${property.area ? `\n📐 ${property.area} m²` : ""}${property.bedrooms ? ` | 🛏 ${property.bedrooms} quartos` : ""}${property.bathrooms ? ` | 🚿 ${property.bathrooms} banheiros` : ""}${property.parking ? ` | 🚗 ${property.parking} vagas` : ""}${property.description ? `\n\n${property.description.substring(0, 200)}${property.description.length > 200 ? "..." : ""}` : ""}\n\n${window.location.href}`;
              const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(waUrl, "_blank");
            }}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors" title="Compartilhar no WhatsApp"
          ><Share2 className="w-3.5 h-3.5 text-foreground" /></button>
          <button
            onClick={() => onDuplicate?.(property.id)}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors" title="Duplicar imóvel"
          ><Copy className="w-3.5 h-3.5 text-foreground" /></button>
          {canManage && (
            <button
              onClick={() => onDelete?.(property.id)}
              className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors" title="Excluir imóvel"
            ><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Site Toggle Button (ativo_site / destaque_home) ----
function SiteToggleButton({ propertyId, field, icon: Icon, activeColor, title, showLabel }: {
  propertyId: string;
  field: "ativo_site" | "destaque_home";
  icon: typeof Globe;
  activeColor: string;
  title: string;
  showLabel?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existsInDb, setExistsInDb] = useState(false);

  useEffect(() => {
    // Check if UUID format first
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
    if (!isUuid) {
      setLoading(false);
      setExistsInDb(false);
      return;
    }
    supabase.from("imoveis").select(field).eq("id", propertyId).maybeSingle().then(({ data }: any) => {
      if (data) {
        setExistsInDb(true);
        setActive(!!(data as any)[field]);
      }
      setLoading(false);
    });
  }, [propertyId, field]);

  const toggle = async () => {
    if (!existsInDb) {
      toast.error("Imóvel não cadastrado no banco de dados");
      return;
    }
    const newVal = !active;
    setActive(newVal);
    const { error } = await supabase.from("imoveis").update({ [field]: newVal } as any).eq("id", propertyId);
    if (error) {
      setActive(!newVal);
      toast.error("Erro ao atualizar");
    } else {
      toast.success(newVal ? `${title} ativado` : `${title} desativado`);
    }
  };

  if (loading) return <div className={cn(showLabel ? "w-8 h-8" : "w-6 h-6", "rounded bg-muted animate-pulse")} />;

  if (!existsInDb) {
    if (!showLabel) return null;
    return (
      <button
        className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center opacity-40 cursor-not-allowed"
        title={`${title}: Cadastre no banco primeiro`}
        disabled
      >
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "rounded flex items-center justify-center gap-1.5 transition-all",
        showLabel ? "h-8 px-3 rounded-lg" : "w-6 h-6",
        active ? activeColor : showLabel ? "bg-secondary text-muted-foreground hover:bg-muted" : "text-muted-foreground/40 hover:text-muted-foreground"
      )}
      title={`${title}: ${active ? "Ativo" : "Inativo"}`}
    >
      <Icon className={cn(showLabel ? "w-3.5 h-3.5" : "w-3.5 h-3.5", active && "fill-current")} />
      {showLabel && <span className="text-[10px] font-bold uppercase tracking-wide">{title}</span>}
    </button>
  );
}

// ---- Destaque Category Selector ----
const DESTAQUE_OPTIONS = [
  { value: "", label: "Sem destaque", icon: "—" },
  { value: "apartamentos", label: "Apartamentos", icon: "🏢" },
  { value: "condominios", label: "Condomínios", icon: "🏘️" },
  { value: "casas", label: "Casas", icon: "🏠" },
  { value: "lotes-cond", label: "Lotes Condomínio", icon: "🌲" },
  { value: "lotes-bairro", label: "Lotes Bairro", icon: "📍" },
  { value: "decorados", label: "Decorados", icon: "🎨" },
  { value: "vista-mar", label: "Vista Mar", icon: "🌊" },
];

function DestaqueSelector({ propertyId, compact }: { propertyId: string; compact?: boolean }) {
  const { isSuperAdmin } = useAuth();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [existsInDb, setExistsInDb] = useState(false);

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
    if (!isUuid) {
      setLoading(false);
      setExistsInDb(false);
      return;
    }
    supabase.from("imoveis").select("destaque_categoria").eq("id", propertyId).maybeSingle().then(({ data }: any) => {
      if (data) {
        setExistsInDb(true);
        setValue((data as any).destaque_categoria || "");
      }
      setLoading(false);
    });
  }, [propertyId]);

  if (!isSuperAdmin) return null;

  const handleChange = async (newVal: string) => {
    if (!existsInDb) {
      toast.error("Imóvel não cadastrado no banco de dados");
      return;
    }
    const prev = value;
    setValue(newVal);
    const { error } = await supabase.from("imoveis").update({
      destaque_categoria: newVal,
      destaque_home: !!newVal,
    } as any).eq("id", propertyId);
    if (error) {
      setValue(prev);
      toast.error("Erro ao atualizar destaque");
    } else {
      const label = DESTAQUE_OPTIONS.find((o) => o.value === newVal)?.label || "Sem destaque";
      toast.success(newVal ? `Destaque: ${label}` : "Destaque removido");
    }
  };

  if (compact) {
    if (loading) return <div className="h-6 w-14 rounded bg-muted animate-pulse" />;
    if (!existsInDb) return null;

    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "h-6 pl-5 pr-1 rounded text-[9px] font-bold border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-300 transition-all appearance-none bg-transparent",
            value
              ? "text-amber-600"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
          title={value ? `Destaque: ${DESTAQUE_OPTIONS.find((o) => o.value === value)?.label}` : "Sem destaque"}
        >
          {DESTAQUE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
          ))}
        </select>
        <Star className={cn("absolute left-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none", value ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40")} />
      </div>
    );
  }

  if (loading) return <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />;

  if (!existsInDb) {
    return (
      <select
        disabled
        className="h-8 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide border bg-muted/50 text-muted-foreground border-border opacity-40 cursor-not-allowed"
        title="Cadastre no banco primeiro"
      >
        <option>— Sem banco</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={cn(
        "h-8 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-300",
        value
          ? "bg-amber-500/20 text-amber-600 border-amber-400/50"
          : "bg-secondary text-muted-foreground border-border hover:bg-muted"
      )}
      title="Selecionar destaque no site"
    >
      {DESTAQUE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
      ))}
    </select>
  );
}
