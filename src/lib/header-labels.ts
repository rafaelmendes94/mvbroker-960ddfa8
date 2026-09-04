// Rótulos amigáveis para cabeçalhos de planilha (inglês/snake_case -> PT-BR).
const DICT: Record<string, string> = {
  codigo_interno: "Código interno",
  codigo: "Código",
  status: "Situação",
  property_name: "Nome do imóvel",
  property_type: "Tipo do imóvel",
  padrao: "Padrão",
  unit_reference: "Unidade",
  unidade: "Unidade",
  quadra: "Quadra",
  lote: "Lote",
  box: "Box",
  city: "Cidade",
  neighborhood: "Bairro",
  street: "Logradouro",
  numero_endereco: "Número",
  numero: "Número",
  complemento: "Complemento",
  cep: "CEP",
  estado: "Estado",
  price_brl: "Preço (R$)",
  preco: "Preço",
  preco_parcelado: "Preço parcelado",
  bedrooms: "Dormitórios",
  suites: "Suítes",
  bathrooms: "Banheiros",
  lavabo: "Lavabo",
  area_m2: "Área privativa (m²)",
  area_total: "Área total (m²)",
  parking_spaces: "Vagas",
  elevadores: "Elevadores",
  position_solar: "Posição solar",
  posicao_predio: "Posição no prédio",
  vista: "Vista",
  vista_mar: "Vista para o mar",
  decorated: "Decorado",
  exclusividade: "Exclusividade",
  destaque: "Destaque",
  aceita_permuta: "Aceita permuta",
  bonus: "Bônus",
  descricao: "Descrição",
  outras_caracteristicas: "Outras características",
  infraestrutura: "Infraestrutura",
  link_video: "Link do vídeo",
  tour_360: "Tour 360",
  link_material: "Link do material",
  link_drive_fotos: "Link do Drive de fotos",
  contact_name: "Nome do contato",
  contact_phone: "Telefone do contato",
  contact_email: "E-mail do contato",
  keys_access: "Local das chaves",
  internal_notes: "Observações internas",
  included_at: "Data de captação",
  bank_financing: "Financiamento bancário",
  entry_value: "Valor de entrada",
  payment_terms: "Condições de pagamento",
  exportacao_liberada: "Exportação liberada",
  publicar_xml: "Publicar no XML",
  condominio: "Condomínio",
  edificio: "Edifício",
  loteamento: "Loteamento",
  empreendimento: "Empreendimento",
  latitude: "Latitude",
  longitude: "Longitude",
};

export function humanizeHeader(header: string): string {
  const key = header.trim().toLowerCase().replace(/\s+/g, "_");
  if (DICT[key]) return DICT[key];
  const words = header.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function headerOptionLabel(header: string): string {
  const nice = humanizeHeader(header);
  return nice.toLowerCase() === header.trim().toLowerCase() ? nice : `${nice} (${header})`;
}
