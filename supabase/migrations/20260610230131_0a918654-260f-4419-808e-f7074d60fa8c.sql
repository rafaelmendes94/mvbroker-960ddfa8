
CREATE OR REPLACE FUNCTION public.get_ranking_imoveis(p_periodo text DEFAULT '30d', p_metrica text DEFAULT 'visualizacoes', p_limit int DEFAULT 20)
RETURNS TABLE(
  imovel_id uuid,
  codigo_interno text,
  titulo text,
  cidade text,
  bairro text,
  preco numeric,
  cover_url text,
  visualizacoes int,
  downloads int,
  exportacoes int,
  favoritos int,
  score int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  v_since := CASE p_periodo
    WHEN '7d'  THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE '-infinity'::timestamptz
  END;

  RETURN QUERY
  WITH base AS (
    SELECT i.id, i.codigo_interno, i.titulo, i.cidade, i.bairro, i.preco
    FROM public.imoveis i
    WHERE COALESCE(i.arquivado, false) = false
  ),
  v AS (
    SELECT imovel_id, COUNT(*)::int AS c FROM public.imovel_logs
    WHERE acao ILIKE 'visualiz%' AND created_at >= v_since GROUP BY imovel_id
  ),
  d AS (
    SELECT imovel_id, COUNT(*)::int AS c FROM public.imovel_logs
    WHERE acao ILIKE 'download%' AND created_at >= v_since GROUP BY imovel_id
  ),
  e AS (
    SELECT ei.imovel_id, COUNT(*)::int AS c
    FROM public.exportacao_itens ei
    GROUP BY ei.imovel_id
  ),
  f AS (
    SELECT imovel_id, COUNT(*)::int AS c FROM public.imoveis_favoritos
    WHERE created_at >= v_since GROUP BY imovel_id
  ),
  cov AS (
    SELECT DISTINCT ON (ii.imovel_id) ii.imovel_id, ii.url
    FROM public.imovel_imagens ii
    ORDER BY ii.imovel_id, ii.ordem NULLS LAST, ii.created_at
  )
  SELECT b.id, b.codigo_interno, b.titulo, b.cidade, b.bairro, b.preco,
    cov.url,
    COALESCE(v.c,0), COALESCE(d.c,0), COALESCE(e.c,0), COALESCE(f.c,0),
    (COALESCE(v.c,0)*1 + COALESCE(d.c,0)*3 + COALESCE(e.c,0)*5 + COALESCE(f.c,0)*4)::int AS score
  FROM base b
  LEFT JOIN v ON v.imovel_id = b.id
  LEFT JOIN d ON d.imovel_id = b.id
  LEFT JOIN e ON e.imovel_id = b.id
  LEFT JOIN f ON f.imovel_id = b.id
  LEFT JOIN cov ON cov.imovel_id = b.id
  ORDER BY
    CASE p_metrica
      WHEN 'downloads'    THEN COALESCE(d.c,0)
      WHEN 'exportacoes'  THEN COALESCE(e.c,0)
      WHEN 'favoritos'    THEN COALESCE(f.c,0)
      WHEN 'score'        THEN (COALESCE(v.c,0)*1 + COALESCE(d.c,0)*3 + COALESCE(e.c,0)*5 + COALESCE(f.c,0)*4)
      ELSE COALESCE(v.c,0)
    END DESC NULLS LAST
  LIMIT p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.get_ranking_corretores(p_periodo text DEFAULT '30d', p_metrica text DEFAULT 'score', p_limit int DEFAULT 20)
RETURNS TABLE(
  corretor_user_id uuid,
  nome text,
  foto_url text,
  imobiliaria_nome text,
  logins int,
  visualizacoes int,
  downloads int,
  exportacoes int,
  favoritos int,
  score int,
  classificacao text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_since timestamptz;
BEGIN
  v_since := CASE p_periodo
    WHEN '7d'  THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE '-infinity'::timestamptz
  END;

  RETURN QUERY
  WITH usuarios AS (
    SELECT DISTINCT p.id, p.full_name, p.avatar_url
    FROM public.profiles p
  ),
  logins AS (
    SELECT usuario_id, COUNT(*)::int AS c FROM public.audit_logs
    WHERE acao ILIKE '%login%' AND created_at >= v_since GROUP BY usuario_id
  ),
  views AS (
    SELECT user_id AS uid, COUNT(*)::int AS c FROM public.imovel_logs
    WHERE acao ILIKE 'visualiz%' AND created_at >= v_since GROUP BY user_id
  ),
  downs AS (
    SELECT user_id AS uid, COUNT(*)::int AS c FROM public.imovel_logs
    WHERE acao ILIKE 'download%' AND created_at >= v_since GROUP BY user_id
  ),
  exps AS (
    SELECT usuario_id AS uid, COUNT(*)::int AS c FROM public.audit_logs
    WHERE modulo ILIKE '%export%' AND created_at >= v_since GROUP BY usuario_id
  ),
  favs AS (
    SELECT usuario_id AS uid, COUNT(*)::int AS c FROM public.imoveis_favoritos
    WHERE created_at >= v_since GROUP BY usuario_id
  ),
  agg AS (
    SELECT u.id, u.full_name, u.avatar_url,
      COALESCE(l.c,0) AS logins,
      COALESCE(v.c,0) AS visualizacoes,
      COALESCE(d.c,0) AS downloads,
      COALESCE(e.c,0) AS exportacoes,
      COALESCE(f.c,0) AS favoritos,
      (COALESCE(l.c,0)*1 + COALESCE(v.c,0)*1 + COALESCE(d.c,0)*3 + COALESCE(e.c,0)*5 + COALESCE(f.c,0)*2)::int AS score
    FROM usuarios u
    LEFT JOIN logins l ON l.usuario_id = u.id
    LEFT JOIN views  v ON v.uid = u.id
    LEFT JOIN downs  d ON d.uid = u.id
    LEFT JOIN exps   e ON e.uid = u.id
    LEFT JOIN favs   f ON f.uid = u.id
  )
  SELECT a.id, a.full_name, a.avatar_url,
    (SELECT i.nome FROM public.corretores c
       JOIN public.imobiliarias i ON i.id = c.imobiliaria_id
       WHERE c.user_id = a.id LIMIT 1),
    a.logins, a.visualizacoes, a.downloads, a.exportacoes, a.favoritos, a.score,
    CASE
      WHEN a.score >= 200 THEN 'Ouro'
      WHEN a.score >= 80  THEN 'Prata'
      WHEN a.score >= 20  THEN 'Bronze'
      ELSE 'Iniciante'
    END
  FROM agg a
  WHERE (a.logins + a.visualizacoes + a.downloads + a.exportacoes + a.favoritos) > 0
  ORDER BY
    CASE p_metrica
      WHEN 'logins'        THEN a.logins
      WHEN 'visualizacoes' THEN a.visualizacoes
      WHEN 'downloads'     THEN a.downloads
      WHEN 'exportacoes'   THEN a.exportacoes
      WHEN 'favoritos'     THEN a.favoritos
      ELSE a.score
    END DESC
  LIMIT p_limit;
END $$;
