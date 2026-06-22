// Column lists that exclude sensitive fields (which were REVOKEd at the DB level).
// Use these instead of `select('*')` for the corresponding tables.
// Sensitive fields are reachable only via SECURITY DEFINER RPCs:
//   - public.get_imovel_internal(uuid)
//   - public.get_corretor_contato(uuid)
//   - public.get_imobiliaria_contato(uuid)

export const IMOVEL_PUBLIC_COLUMNS = [
  "id", "codigo_interno", "titulo", "unidade", "box", "quadra", "lote",
  "tipo_imovel", "status_imovel",
  "dormitorios", "banheiros", "lavabo", "vagas", "elevadores",
  "area_privativa", "area_total",
  "edificio_id", "condominio_id", "empreendimento_id",
  "imobiliaria_id", "corretor_id",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado",
  "latitude", "longitude",
  "preco", "preco_parcelado",
  "bonus", "validade_bonus", "padrao", "condicoes_pagamento",
  "tipo_proprietario", "exclusividade",
  "condicao", "posicao_predio", "posicao_solar", "vista", "vista_mar",
  "decorado", "aceita_permuta",
  "infraestrutura", "outras_caracteristicas",
  "ativo_site", "publicar_xml", "destaque_home", "destaque_categoria",
  "descricao", "link_video", "link_material", "link_drive_fotos", "tour_360",
  "data_captacao", "responsavel_captacao",
  "responsavel_nome", "responsavel_telefone", "responsavel_whatsapp", "responsavel_email",
  "exclusivo", "compartilhamento_permitido", "comissao_compartilhada",
  "data_vencimento_exclusividade", "portais_permitidos", "prioridade_xml",
  "ultima_exportacao", "status_exportacao", "exportacao_liberada", "arquivado",
  "created_by", "created_at", "updated_at",
].join(", ");

export const CORRETOR_PUBLIC_COLUMNS = [
  "id", "user_id", "imobiliaria_id", "nome", "foto_url", "creci",
  "status", "created_at", "updated_at",
].join(", ");

export const IMOBILIARIA_PUBLIC_COLUMNS = [
  "id", "owner_id", "nome_fantasia", "razao_social", "site",
  "status", "created_at", "updated_at",
].join(", ");
