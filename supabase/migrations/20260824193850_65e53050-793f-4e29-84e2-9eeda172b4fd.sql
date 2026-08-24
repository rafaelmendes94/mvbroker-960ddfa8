-- Sincroniza imóveis cadastrados (tabela imoveis) com as unidades expostas na API v1.
CREATE OR REPLACE FUNCTION public.sync_unit_from_imovel(p_imovel_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i public.imoveis;
  v_dev uuid;
  v_unit uuid;
BEGIN
  SELECT * INTO i FROM public.imoveis WHERE id = p_imovel_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT d.id INTO v_dev FROM public.developments d
   WHERE (i.edificio_id IS NOT NULL AND d.legacy_table = 'edificios' AND d.legacy_id = i.edificio_id)
      OR (i.condominio_id IS NOT NULL AND d.legacy_table = 'condominios' AND d.legacy_id = i.condominio_id)
      OR (i.loteamento_id IS NOT NULL AND d.legacy_table = 'loteamentos' AND d.legacy_id = i.loteamento_id)
      OR (i.empreendimento_id IS NOT NULL AND d.legacy_table = 'empreendimentos' AND d.legacy_id = i.empreendimento_id)
   LIMIT 1;

  SELECT id INTO v_unit FROM public.units WHERE legacy_imovel_id = i.id;

  IF v_unit IS NULL THEN
    INSERT INTO public.units (legacy_imovel_id) VALUES (i.id) RETURNING id INTO v_unit;
  END IF;

  UPDATE public.units u SET
    development_id   = COALESCE(v_dev, u.development_id),
    agency_id        = i.imobiliaria_id,
    reference        = COALESCE(i.codigo_interno, u.reference),
    title            = i.titulo,
    description      = i.descricao,
    unit_number      = NULLIF(i.unidade, ''),
    block            = NULLIF(i.quadra, ''),
    lot              = NULLIF(i.lote, ''),
    property_type    = lower(NULLIF(i.tipo_imovel, '')),
    price            = i.preco,
    bedrooms         = i.dormitorios,
    suites           = i.suites,
    bathrooms        = i.banheiros,
    parking_spaces   = i.vagas,
    private_area     = NULLIF(i.area_privativa, 0),
    total_area       = NULLIF(i.area_total, 0),
    box              = NULLIF(i.box, ''),
    decorated        = COALESCE(i.decorado, false),
    exclusive        = COALESCE(i.exclusividade, i.exclusivo, false),
    sea_view         = COALESCE(i.vista_mar, false),
    city             = i.cidade,
    state            = i.estado,
    neighborhood     = i.bairro,
    street           = i.logradouro,
    street_number    = NULLIF(i.numero, ''),
    postal_code      = NULLIF(i.cep, ''),
    latitude         = i.latitude,
    longitude        = i.longitude,
    agent_id         = i.corretor_id,
    posicao_solar_tmp = NULL,
    sharing_scope    = CASE WHEN COALESCE(i.imobiliaria_id::text, '') = '' THEN 'network' ELSE u.sharing_scope END,
    status           = CASE
                         WHEN COALESCE(i.arquivado, false) THEN 'archived'::unit_status
                         WHEN i.status_imovel IN ('vendido') THEN 'sold'::unit_status
                         WHEN i.status_imovel IN ('reservado') THEN 'reserved'::unit_status
                         ELSE 'available'::unit_status
                       END,
    updated_at       = now()
  WHERE u.id = v_unit;

  RETURN v_unit;
END;
$$;