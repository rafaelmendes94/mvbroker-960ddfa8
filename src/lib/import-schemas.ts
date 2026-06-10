// Schemas para importação CSV/Excel
export type FieldType = "text" | "number" | "integer" | "boolean" | "date" | "array";

export type ImportField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  group?: string;
  // resolver por FK lookup: tabela e coluna(s) usadas para casar
  fkLookup?: { table: string; matchColumns: string[]; targetColumn?: string };
  hint?: string;
};

const ENDERECO: ImportField[] = [
  { key: "cep", label: "CEP", type: "text", group: "Endereço" },
  { key: "logradouro", label: "Logradouro", type: "text", group: "Endereço" },
  { key: "numero", label: "Número", type: "text", group: "Endereço" },
  { key: "complemento", label: "Complemento", type: "text", group: "Endereço" },
  { key: "bairro", label: "Bairro", type: "text", group: "Endereço" },
  { key: "cidade", label: "Cidade", type: "text", group: "Endereço" },
  { key: "estado", label: "Estado (UF)", type: "text", group: "Endereço" },
  { key: "latitude", label: "Latitude", type: "number", group: "Endereço" },
  { key: "longitude", label: "Longitude", type: "number", group: "Endereço" },
];

export const EMPREENDIMENTOS_FIELDS: ImportField[] = [
  { key: "nome", label: "Nome", type: "text", required: true, group: "Identificação" },
  { key: "codigo_interno", label: "Código Interno", type: "text", group: "Identificação" },
  { key: "descricao", label: "Descrição", type: "text", group: "Identificação" },
  { key: "ativo", label: "Ativo", type: "boolean", group: "Identificação" },
  ...ENDERECO,
  { key: "infraestrutura", label: "Infraestrutura (lista separada por ;)", type: "array", group: "Características" },
  { key: "construtora", label: "Construtora", type: "text", group: "Características" },
  { key: "incorporadora", label: "Incorporadora", type: "text", group: "Características" },
  { key: "status_obra", label: "Status da Obra", type: "text", group: "Características" },
  { key: "data_lancamento", label: "Data de Lançamento", type: "date", group: "Datas" },
  { key: "data_prevista_entrega", label: "Data Prevista de Entrega", type: "date", group: "Datas" },
  { key: "data_entrega_efetiva", label: "Data Entrega Efetiva", type: "date", group: "Datas" },
];

export const CONDOMINIOS_FIELDS: ImportField[] = [
  { key: "nome", label: "Nome", type: "text", required: true, group: "Identificação" },
  { key: "codigo_interno", label: "Código Interno", type: "text", group: "Identificação" },
  { key: "descricao", label: "Descrição", type: "text", group: "Identificação" },
  { key: "ativo", label: "Ativo", type: "boolean", group: "Identificação" },
  ...ENDERECO,
  { key: "infraestrutura", label: "Infraestrutura (lista separada por ;)", type: "array", group: "Características" },
  { key: "tipo_condominio", label: "Tipo de Condomínio", type: "text", group: "Características" },
  { key: "numero_lotes", label: "Número de Lotes", type: "integer", group: "Características" },
  { key: "portaria", label: "Portaria", type: "text", group: "Características" },
  { key: "seguranca", label: "Segurança", type: "text", group: "Características" },
  { key: "area_total", label: "Área Total (m²)", type: "number", group: "Características" },
];

export const EDIFICIOS_FIELDS: ImportField[] = [
  { key: "nome", label: "Nome", type: "text", required: true, group: "Identificação" },
  { key: "codigo_interno", label: "Código Interno", type: "text", group: "Identificação" },
  { key: "descricao", label: "Descrição", type: "text", group: "Identificação" },
  { key: "ativo", label: "Ativo", type: "boolean", group: "Identificação" },
  ...ENDERECO,
  { key: "infraestrutura", label: "Infraestrutura (lista separada por ;)", type: "array", group: "Características" },
  { key: "qtd_andares", label: "Qtd. Andares", type: "integer", group: "Características" },
  { key: "qtd_elevadores", label: "Qtd. Elevadores", type: "integer", group: "Características" },
  { key: "qtd_apartamentos", label: "Qtd. Apartamentos", type: "integer", group: "Características" },
  { key: "ano_construcao", label: "Ano de Construção", type: "integer", group: "Características" },
  { key: "construtora", label: "Construtora", type: "text", group: "Características" },
];

export const IMOVEIS_FIELDS: ImportField[] = [
  // Identificação
  { key: "titulo", label: "Título", type: "text", required: true, group: "Identificação" },
  { key: "codigo_interno", label: "Código Interno", type: "text", group: "Identificação" },
  { key: "tipo_imovel", label: "Tipo do Imóvel", type: "text", group: "Identificação" },
  { key: "status_imovel", label: "Status (disponivel/reservado/vendido)", type: "text", group: "Identificação" },
  { key: "unidade", label: "Unidade", type: "text", group: "Identificação" },
  { key: "box", label: "Box", type: "text", group: "Identificação" },
  { key: "quadra", label: "Quadra", type: "text", group: "Identificação" },
  { key: "lote", label: "Lote", type: "text", group: "Identificação" },
  { key: "padrao", label: "Padrão", type: "text", group: "Identificação" },
  { key: "condicao", label: "Condição", type: "text", group: "Identificação" },

  // Características
  { key: "dormitorios", label: "Dormitórios", type: "integer", group: "Características" },
  { key: "banheiros", label: "Banheiros", type: "integer", group: "Características" },
  { key: "lavabo", label: "Lavabo", type: "integer", group: "Características" },
  { key: "vagas", label: "Vagas", type: "integer", group: "Características" },
  { key: "elevadores", label: "Elevadores", type: "integer", group: "Características" },
  { key: "area_privativa", label: "Área Privativa (m²)", type: "number", group: "Características" },
  { key: "area_total", label: "Área Total (m²)", type: "number", group: "Características" },
  { key: "posicao_predio", label: "Posição no Prédio", type: "text", group: "Características" },
  { key: "posicao_solar", label: "Posição Solar", type: "text", group: "Características" },
  { key: "vista", label: "Vista", type: "text", group: "Características" },
  { key: "vista_mar", label: "Vista para o Mar (sim/não)", type: "boolean", group: "Características" },
  { key: "decorado", label: "Decorado (sim/não)", type: "boolean", group: "Características" },
  { key: "aceita_permuta", label: "Aceita Permuta (sim/não)", type: "boolean", group: "Características" },
  { key: "infraestrutura", label: "Infraestrutura (; separado)", type: "array", group: "Características" },
  { key: "outras_caracteristicas", label: "Outras Características (; separado)", type: "array", group: "Características" },

  // Vínculos
  { key: "empreendimento_nome", label: "Empreendimento (nome ou código)", type: "text", group: "Vínculos",
    fkLookup: { table: "empreendimentos", matchColumns: ["codigo_interno", "nome"], targetColumn: "empreendimento_id" } },
  { key: "condominio_nome", label: "Condomínio (nome ou código)", type: "text", group: "Vínculos",
    fkLookup: { table: "condominios", matchColumns: ["codigo_interno", "nome"], targetColumn: "condominio_id" } },
  { key: "edificio_nome", label: "Edifício (nome ou código)", type: "text", group: "Vínculos",
    fkLookup: { table: "edificios", matchColumns: ["codigo_interno", "nome"], targetColumn: "edificio_id" } },
  { key: "imobiliaria_nome", label: "Imobiliária (nome ou CNPJ)", type: "text", group: "Vínculos",
    fkLookup: { table: "imobiliarias", matchColumns: ["cnpj", "nome"], targetColumn: "imobiliaria_id" } },

  ...ENDERECO,

  // Valores
  { key: "preco", label: "Preço", type: "number", group: "Valores" },
  { key: "preco_parcelado", label: "Preço Parcelado", type: "number", group: "Valores" },
  { key: "comissao_percentual", label: "Comissão (%)", type: "number", group: "Valores" },
  { key: "valor_comissao", label: "Valor Comissão (R$)", type: "number", group: "Valores" },
  { key: "bonus", label: "Bônus", type: "text", group: "Valores" },
  { key: "validade_bonus", label: "Validade do Bônus", type: "date", group: "Valores" },
  { key: "condicoes_pagamento", label: "Condições de Pagamento (; separado)", type: "array", group: "Valores" },

  // Responsável / Captação
  { key: "responsavel_nome", label: "Responsável - Nome", type: "text", group: "Responsável" },
  { key: "responsavel_telefone", label: "Responsável - Telefone", type: "text", group: "Responsável" },
  { key: "responsavel_whatsapp", label: "Responsável - WhatsApp", type: "text", group: "Responsável" },
  { key: "responsavel_email", label: "Responsável - E-mail", type: "text", group: "Responsável" },
  { key: "tipo_proprietario", label: "Tipo Proprietário", type: "text", group: "Responsável" },
  { key: "data_captacao", label: "Data Captação", type: "date", group: "Responsável" },
  { key: "responsavel_captacao", label: "Responsável Captação", type: "text", group: "Responsável" },
  { key: "local_chaves", label: "Local das Chaves", type: "text", group: "Responsável" },
  { key: "observacoes_internas", label: "Observações Internas", type: "text", group: "Responsável" },

  // Exclusividade / Compartilhamento
  { key: "exclusividade", label: "Exclusividade (sim/não)", type: "boolean", group: "Exclusividade" },
  { key: "exclusivo", label: "Exclusivo (sim/não)", type: "boolean", group: "Exclusividade" },
  { key: "compartilhamento_permitido", label: "Compartilhamento Permitido (sim/não)", type: "boolean", group: "Exclusividade" },
  { key: "comissao_compartilhada", label: "Comissão Compartilhada (%)", type: "number", group: "Exclusividade" },
  { key: "data_vencimento_exclusividade", label: "Vencimento Exclusividade", type: "date", group: "Exclusividade" },

  // Publicação
  { key: "ativo_site", label: "Ativo no Site (sim/não)", type: "boolean", group: "Publicação" },
  { key: "publicar_xml", label: "Publicar XML (sim/não)", type: "boolean", group: "Publicação" },
  { key: "destaque_home", label: "Destaque na Home (sim/não)", type: "boolean", group: "Publicação" },
  { key: "destaque_categoria", label: "Categoria de Destaque", type: "text", group: "Publicação" },
  { key: "portais_permitidos", label: "Portais Permitidos (; separado)", type: "array", group: "Publicação" },
  { key: "prioridade_xml", label: "Prioridade XML", type: "integer", group: "Publicação" },

  // Mídias / Descrição
  { key: "descricao", label: "Descrição", type: "text", group: "Mídias" },
  { key: "link_video", label: "Link Vídeo", type: "text", group: "Mídias" },
  { key: "link_material", label: "Link Material", type: "text", group: "Mídias" },
  { key: "link_drive_fotos", label: "Link Drive Fotos", type: "text", group: "Mídias" },
  { key: "tour_360", label: "Tour 360", type: "text", group: "Mídias" },
];

// remove duplicate endereço keys for imoveis when merging
export const IMOVEIS_FIELDS_UNIQUE: ImportField[] = (() => {
  const seen = new Set<string>();
  return IMOVEIS_FIELDS.filter((f) => {
    if (seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
})();
