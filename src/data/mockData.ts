export interface Property {
  id: string;
  code?: string;
  title: string;
  address: string;
  neighborhood?: string;
  city: string;
  type: "Apartamento" | "Casa" | "Comercial" | "Terreno" | "Lote" | "Condomínio";
  status: "Disponível" | "Vendido" | "Reservado" | "Alugado" | "Suspenso";
  price: number;
  area: number;
  privateArea?: number;
  bedrooms: number;
  suites?: number;
  bathrooms: number;
  parking: number;
  broker: string;
  owner?: string;
  ownerPhone?: string;
  image: string;
  images: string[];
  createdAt: string;
  lat: number;
  lng: number;
  decorated?: boolean;
  seaView?: boolean;
  acceptsExchange?: boolean;
  paymentConditions?: string[];
  paymentConditionsOther?: string;
  empreendimento?: string;
  edificioId?: string;
  condominioId?: string;
  empreendimentoId?: string;
  plataformaVenda?: string;
  dataVenda?: string;
  unitNumber?: string;
  boxNumber?: string;
  quadra?: string;
  lote?: string;
  exclusivityTerm?: string;
  exclusivityTermUrl?: string;
  keysLocation?: string;
  description?: string;
  updatedAt?: string;
  posicaoPredio?: string;
  posicaoSolar?: string;
  infraestrutura?: string[];
  elevadores?: number;
  vista?: string;
  condicao?: "Mobiliado" | "Semi-mobiliado" | "Vazio" | "Decorado";
  ownerType?: "Construtora" | "Investidor" | "Particular" | "Adm Comercial" | "Exclusividade";
  priceInstallment?: number;
  commission?: number;
  bonus?: number;
  bonusExpiry?: string;
  dealLabel?: "Oferta" | "Bom Negócio" | "Normal" | "Acima da Média" | null;
  views?: number;
  padrao?: "Econômico" | "Médio Padrão" | "Alto Padrão" | "Luxo";
  outrasCaracteristicas?: string[];
  linkVideo?: string;
  linkMaterial?: string;
  link360?: string;
  driveFotosUrl?: string;
  fotosPdfUrl?: string;
  userId?: string;
  brokerPhoto?: string;
  brokerWhatsapp?: string;
}

export interface Broker {
  id: string;
  name: string;
  email: string;
  phone: string;
  creci: string;
  sales: number;
  revenue: number;
  avatar: string;
  status: "Ativo" | "Inativo";
}

export const properties: Property[] = [
  {
    id: "1",
    code: "MV01",
    title: "Apartamento Frente Mar",
    address: "Av. Paraguassú, 1200",
    neighborhood: "Navegantes",
    city: "Capão da Canoa",
    type: "Apartamento",
    status: "Disponível",
    price: 950000,
    area: 120,
    privateArea: 98,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    broker: "Carlos Silva",
    owner: "Roberto Mendes",
    ownerPhone: "5551998761234",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=400&h=300&fit=crop",
    ],
    createdAt: "2024-01-15",
    updatedAt: "2026-03-25",
    lat: -29.7456,
    lng: -50.1028,
    decorated: true,
    seaView: true,
    acceptsExchange: true,
    paymentConditions: ["48x", "Permuta"],
    empreendimento: "Ed. Atlântico Sul",
    unitNumber: "Ap 302",
    boxNumber: "Box 12",
    keysLocation: "Na imobiliária Alpha Imóveis",
    ownerType: "Particular",
    priceInstallment: 1050000,
    commission: 5,
    bonus: 2000,
    bonusExpiry: "2026-04-30",
    posicaoPredio: "Frente",
    posicaoSolar: "Nascente",
    infraestrutura: ["Piscina", "Churrasqueira", "Salão de Festas", "Academia"],
    vista: "Mar",
    condicao: "Decorado",
  },
  {
    id: "2",
    code: "MV02",
    title: "Cobertura Duplex Vista Mar",
    address: "Av. Beira Mar, 500",
    neighborhood: "Centro",
    city: "Capão da Canoa",
    type: "Apartamento",
    status: "Reservado",
    price: 1800000,
    area: 250,
    privateArea: 210,
    bedrooms: 4,
    bathrooms: 4,
    parking: 3,
    broker: "Ana Rodrigues",
    owner: "Grupo Marina Empreendimentos",
    ownerPhone: "5551991234567",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop",
    ],
    createdAt: "2024-02-10",
    updatedAt: "2026-02-15",
    lat: -29.7480,
    lng: -50.1065,
    decorated: true,
    seaView: true,
    acceptsExchange: false,
    paymentConditions: ["72x", "Financiamento bancário"],
    empreendimento: "Ed. Panorama Beach",
    unitNumber: "Cobertura 01",
    boxNumber: "Box 01, 02, 03",
    keysLocation: "Com o proprietário",
    ownerType: "Construtora",
    priceInstallment: 2100000,
    commission: 6,
    bonus: 5000,
    bonusExpiry: "2026-05-15",
    posicaoPredio: "Lateral Esquerda",
    posicaoSolar: "Poente",
    infraestrutura: ["Piscina", "Sauna", "Espaço Gourmet", "Brinquedoteca"],
    vista: "Mar / Lago",
    condicao: "Mobiliado",
  },
  {
    id: "3",
    code: "MV03",
    title: "Casa em Condomínio Xangri-lá",
    address: "Rua Garibaldi, 300",
    neighborhood: "Rainha do Mar",
    city: "Xangri-lá",
    type: "Casa",
    status: "Disponível",
    price: 1200000,
    area: 350,
    bedrooms: 4,
    bathrooms: 5,
    parking: 3,
    broker: "Carlos Silva",
    owner: "Construtora Royal",
    ownerPhone: "5551997654321",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=400&h=300&fit=crop",
    ],
    createdAt: "2024-03-05",
    updatedAt: "2026-01-10",
    lat: -29.8050,
    lng: -50.0520,
    decorated: true,
    seaView: false,
    acceptsExchange: true,
    paymentConditions: ["36x", "Permuta", "Carro"],
    empreendimento: "Cond. Reserva das Dunas",
    quadra: "Q-05",
    lote: "L-18",
    keysLocation: "Na portaria do condomínio",
    ownerType: "Construtora",
    priceInstallment: 1400000,
    commission: 5,
    bonus: 3000,
    bonusExpiry: "2026-06-01",
  },
  {
    id: "4",
    code: "MV04",
    title: "Sala Comercial Centro Capão",
    address: "Av. Fernandes Bastos, 800",
    neighborhood: "Centro",
    city: "Capão da Canoa",
    type: "Comercial",
    status: "Alugado",
    price: 450000,
    area: 80,
    bedrooms: 0,
    bathrooms: 2,
    parking: 1,
    broker: "Marcos Oliveira",
    owner: "Investimentos Capão Ltda",
    ownerPhone: "5551993456789",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop",
    ],
    createdAt: "2024-01-20",
    updatedAt: "2025-12-01",
    lat: -29.7520,
    lng: -50.1100,
    decorated: false,
    seaView: false,
    acceptsExchange: false,
    paymentConditions: ["12x"],
    empreendimento: "Centro Comercial Capão",
    unitNumber: "Sala 205",
    keysLocation: "Na administradora do prédio",
    ownerType: "Investidor",
    priceInstallment: 500000,
    commission: 4,
  },
  {
    id: "5",
    code: "MV05",
    title: "Terreno Condomínio Xangri-lá",
    address: "Rua Itapeva, 150",
    neighborhood: "Atlântida",
    city: "Xangri-lá",
    type: "Terreno",
    status: "Disponível",
    price: 380000,
    area: 500,
    bedrooms: 0,
    bathrooms: 0,
    parking: 0,
    broker: "Ana Rodrigues",
    owner: "Paulo Ferreira",
    ownerPhone: "5551996543210",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1500076656116-558758c991c1?w=400&h=300&fit=crop",
    ],
    createdAt: "2024-02-28",
    updatedAt: "2026-03-20",
    lat: -29.8100,
    lng: -50.0450,
    decorated: false,
    seaView: false,
    acceptsExchange: true,
    paymentConditions: ["24x", "Permuta"],
    empreendimento: "Cond. Bosque do Litoral",
    quadra: "Q-12",
    lote: "L-07",
    ownerType: "Particular",
    priceInstallment: 420000,
    commission: 5,
    bonus: 1500,
    bonusExpiry: "2026-04-15",
  },
  {
    id: "6",
    code: "MV06",
    title: "Apartamento Praia de Atlântida",
    address: "Av. Central, 200",
    neighborhood: "Atlântida Sul",
    city: "Xangri-lá",
    type: "Apartamento",
    status: "Vendido",
    price: 620000,
    area: 75,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    broker: "Marcos Oliveira",
    owner: "Roberto Mendes",
    ownerPhone: "5551998761234",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400&h=300&fit=crop",
    ],
    createdAt: "2024-03-12",
    updatedAt: "2025-11-05",
    lat: -29.7900,
    lng: -50.0650,
    decorated: false,
    seaView: true,
    acceptsExchange: false,
    paymentConditions: ["84x", "Financiamento bancário"],
    empreendimento: "Residencial Atlântida",
    unitNumber: "Ap 104",
    boxNumber: "Box 08",
    ownerType: "Particular",
  },
];

export const brokers: Broker[] = [
  {
    id: "1",
    name: "Carlos Silva",
    email: "carlos@imobcrm.com",
    phone: "(11) 99876-5432",
    creci: "123456-SP",
    sales: 24,
    revenue: 8500000,
    avatar: "CS",
    status: "Ativo",
  },
  {
    id: "2",
    name: "Ana Rodrigues",
    email: "ana@imobcrm.com",
    phone: "(11) 99765-4321",
    creci: "234567-SP",
    sales: 18,
    revenue: 6200000,
    avatar: "AR",
    status: "Ativo",
  },
  {
    id: "3",
    name: "Marcos Oliveira",
    email: "marcos@imobcrm.com",
    phone: "(11) 99654-3210",
    creci: "345678-SP",
    sales: 31,
    revenue: 12100000,
    avatar: "MO",
    status: "Ativo",
  },
  {
    id: "4",
    name: "Julia Santos",
    email: "julia@imobcrm.com",
    phone: "(11) 99543-2109",
    creci: "456789-SP",
    sales: 12,
    revenue: 3800000,
    avatar: "JS",
    status: "Inativo",
  },
];

export interface SaleRecord {
  id: string;
  propertyId: string;
  propertyTitle: string;
  city: string;
  neighborhood: string;
  owner: string;
  type: "Apartamento" | "Casa" | "Comercial" | "Terreno";
  segment: "Alto Padrão" | "Médio Padrão" | "Econômico" | "Luxo";
  broker: string;
  price: number;
  date: string;
  empreendimento?: string;
  bedrooms: number;
  seaView: boolean;
}

export const salesRecords: SaleRecord[] = [
  { id: "s1", propertyId: "6", propertyTitle: "Apartamento Praia de Atlântida", city: "Xangri-lá", neighborhood: "Atlântida", owner: "Roberto Mendes", type: "Apartamento", segment: "Médio Padrão", broker: "Marcos Oliveira", price: 620000, date: "2026-03-25", empreendimento: "Residencial Atlântida", bedrooms: 2, seaView: true },
  { id: "s2", propertyId: "v1", propertyTitle: "Cobertura Ed. Marina", city: "Capão da Canoa", neighborhood: "Centro", owner: "Grupo Marina Empreendimentos", type: "Apartamento", segment: "Luxo", broker: "Carlos Silva", price: 2400000, date: "2026-03-20", empreendimento: "Ed. Marina Bay", bedrooms: 4, seaView: true },
  { id: "s3", propertyId: "v2", propertyTitle: "Casa Condomínio Royal", city: "Xangri-lá", neighborhood: "Rainha do Mar", owner: "Construtora Royal", type: "Casa", segment: "Alto Padrão", broker: "Ana Rodrigues", price: 1850000, date: "2026-03-18", empreendimento: "Cond. Royal Park", bedrooms: 4, seaView: false },
  { id: "s4", propertyId: "v3", propertyTitle: "Apt 2 quartos Atlântida", city: "Xangri-lá", neighborhood: "Atlântida", owner: "Roberto Mendes", type: "Apartamento", segment: "Médio Padrão", broker: "Marcos Oliveira", price: 480000, date: "2026-03-15", empreendimento: "Ed. Atlântida I", bedrooms: 2, seaView: true },
  { id: "s5", propertyId: "v4", propertyTitle: "Sala Comercial Torre A", city: "Capão da Canoa", neighborhood: "Centro", owner: "Investimentos Capão Ltda", type: "Comercial", segment: "Médio Padrão", broker: "Carlos Silva", price: 320000, date: "2026-03-10", empreendimento: "Centro Comercial Capão", bedrooms: 0, seaView: false },
  { id: "s6", propertyId: "v5", propertyTitle: "Terreno Cond. Bosque", city: "Xangri-lá", neighborhood: "Bosque do Litoral", owner: "Paulo Ferreira", type: "Terreno", segment: "Alto Padrão", broker: "Ana Rodrigues", price: 450000, date: "2026-03-05", empreendimento: "Cond. Bosque do Litoral", bedrooms: 0, seaView: false },
  { id: "s7", propertyId: "v6", propertyTitle: "Apt Vista Mar Premium", city: "Capão da Canoa", neighborhood: "Navegantes", owner: "Grupo Marina Empreendimentos", type: "Apartamento", segment: "Luxo", broker: "Carlos Silva", price: 1950000, date: "2026-02-28", empreendimento: "Ed. Atlântico Sul", bedrooms: 3, seaView: true },
  { id: "s8", propertyId: "v7", propertyTitle: "Casa Térrea Atlantida Sul", city: "Atlântida", neighborhood: "Atlântida Sul", owner: "Maria Clara Souza", type: "Casa", segment: "Médio Padrão", broker: "Marcos Oliveira", price: 750000, date: "2026-02-20", empreendimento: "Cond. Atlântida Sul", bedrooms: 3, seaView: false },
  { id: "s9", propertyId: "v8", propertyTitle: "Cobertura Duplex Xangri-lá", city: "Xangri-lá", neighborhood: "Rainha do Mar", owner: "Construtora Royal", type: "Apartamento", segment: "Luxo", broker: "Ana Rodrigues", price: 3200000, date: "2026-02-15", empreendimento: "Ed. Grand Marina", bedrooms: 5, seaView: true },
  { id: "s10", propertyId: "v9", propertyTitle: "Terreno Esquina Premium", city: "Capão da Canoa", neighborhood: "Zona Nova", owner: "Paulo Ferreira", type: "Terreno", segment: "Alto Padrão", broker: "Carlos Silva", price: 580000, date: "2026-02-10", empreendimento: "Cond. Reserva Premium", bedrooms: 0, seaView: false },
  { id: "s11", propertyId: "v10", propertyTitle: "Apt Econômico 1Q", city: "Capão da Canoa", neighborhood: "Centro", owner: "Investimentos Capão Ltda", type: "Apartamento", segment: "Econômico", broker: "Marcos Oliveira", price: 280000, date: "2026-02-05", empreendimento: "Residencial Capão", bedrooms: 1, seaView: false },
  { id: "s12", propertyId: "v11", propertyTitle: "Casa Alto Padrão Beira Mar", city: "Atlântida", neighborhood: "Beira Mar", owner: "Maria Clara Souza", type: "Casa", segment: "Luxo", broker: "Ana Rodrigues", price: 4500000, date: "2026-01-28", empreendimento: "Cond. Beira Mar Exclusive", bedrooms: 5, seaView: true },
  { id: "s13", propertyId: "v12", propertyTitle: "Sala Comercial Centro", city: "Xangri-lá", neighborhood: "Centro", owner: "Investimentos Capão Ltda", type: "Comercial", segment: "Econômico", broker: "Marcos Oliveira", price: 220000, date: "2026-01-20", empreendimento: "Galeria Xangri-lá", bedrooms: 0, seaView: false },
  { id: "s14", propertyId: "v13", propertyTitle: "Apt 3Q Frente Mar", city: "Capão da Canoa", neighborhood: "Navegantes", owner: "Grupo Marina Empreendimentos", type: "Apartamento", segment: "Alto Padrão", broker: "Carlos Silva", price: 1100000, date: "2026-01-15", empreendimento: "Ed. Panorama Beach", bedrooms: 3, seaView: true },
  { id: "s15", propertyId: "v14", propertyTitle: "Terreno Cond. Fechado", city: "Atlântida", neighborhood: "Atlântida Sul", owner: "Paulo Ferreira", type: "Terreno", segment: "Médio Padrão", broker: "Ana Rodrigues", price: 350000, date: "2026-01-10", empreendimento: "Cond. Atlântida Gardens", bedrooms: 0, seaView: false },
  { id: "s16", propertyId: "v15", propertyTitle: "Casa Moderna 3 Suítes", city: "Xangri-lá", neighborhood: "Bosque do Litoral", owner: "Construtora Royal", type: "Casa", segment: "Alto Padrão", broker: "Carlos Silva", price: 1650000, date: "2026-01-05", empreendimento: "Cond. Reserva das Dunas", bedrooms: 3, seaView: false },
  { id: "s17", propertyId: "v16", propertyTitle: "Apt Studio Mobiliado", city: "Capão da Canoa", neighborhood: "Centro", owner: "Roberto Mendes", type: "Apartamento", segment: "Econômico", broker: "Marcos Oliveira", price: 195000, date: "2025-12-20", empreendimento: "Ed. Central Capão", bedrooms: 1, seaView: false },
  { id: "s18", propertyId: "v17", propertyTitle: "Cobertura Premium", city: "Capão da Canoa", neighborhood: "Navegantes", owner: "Grupo Marina Empreendimentos", type: "Apartamento", segment: "Luxo", broker: "Carlos Silva", price: 3800000, date: "2025-12-15", empreendimento: "Ed. Blue Ocean", bedrooms: 4, seaView: true },
];

export const salesData = [
  { month: "Jan", vendas: 4, receita: 2800000 },
  { month: "Fev", vendas: 6, receita: 4100000 },
  { month: "Mar", vendas: 3, receita: 1900000 },
  { month: "Abr", vendas: 8, receita: 5600000 },
  { month: "Mai", vendas: 5, receita: 3200000 },
  { month: "Jun", vendas: 7, receita: 4800000 },
];

export const propertyTypeData = [
  { name: "Apartamento", value: 45, fill: "hsl(var(--chart-1))" },
  { name: "Casa", value: 25, fill: "hsl(var(--chart-2))" },
  { name: "Comercial", value: 18, fill: "hsl(var(--chart-3))" },
  { name: "Terreno", value: 12, fill: "hsl(var(--chart-5))" },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}
