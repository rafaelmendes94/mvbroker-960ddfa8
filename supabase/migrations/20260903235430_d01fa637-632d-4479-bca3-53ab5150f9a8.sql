CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS imoveis_titulo_trgm_idx ON public.imoveis USING gin (titulo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS imoveis_logradouro_trgm_idx ON public.imoveis USING gin (logradouro gin_trgm_ops);
CREATE INDEX IF NOT EXISTS imoveis_bairro_trgm_idx ON public.imoveis USING gin (bairro gin_trgm_ops);
CREATE INDEX IF NOT EXISTS imoveis_cidade_trgm_idx ON public.imoveis USING gin (cidade gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.buscar_imoveis_similares(
  p_codigo text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_logradouro text DEFAULT NULL,
  p_numero text DEFAULT NULL,
  p_unidade text DEFAULT NULL,
  p_bairro text DEFAULT NULL,
  p_titulo text DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  codigo_interno text,
  titulo text,
  cidade text,
  bairro text,
  logradouro text,
  numero text,
  unidade text,
  quadra text,
  lote text,
  preco numeric,
  score real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    i.id, i.codigo_interno, i.titulo, i.cidade, i.bairro, i.logradouro,
    i.numero, i.unidade, i.quadra, i.lote, i.preco,
    (
      CASE WHEN p_codigo IS NOT NULL AND p_codigo <> '' AND lower(i.codigo_interno) = lower(p_codigo) THEN 1.0 ELSE 0 END +
      CASE WHEN p_numero IS NOT NULL AND p_numero <> '' AND lower(COALESCE(i.numero,'')) = lower(p_numero)
            AND lower(COALESCE(i.cidade,'')) = lower(COALESCE(p_cidade, i.cidade))
            AND (p_unidade IS NULL OR p_unidade = '' OR lower(COALESCE(i.unidade,'')) = lower(p_unidade)) THEN 0.6 ELSE 0 END +
      CASE WHEN p_unidade IS NOT NULL AND p_unidade <> '' AND lower(COALESCE(i.unidade,'')) = lower(p_unidade) THEN 0.15 ELSE 0 END +
      CASE WHEN p_cidade IS NOT NULL AND p_cidade <> '' AND lower(COALESCE(i.cidade,'')) = lower(p_cidade) THEN 0.05 ELSE 0 END +
      CASE WHEN p_logradouro IS NOT NULL AND p_logradouro <> '' THEN similarity(lower(COALESCE(i.logradouro,'')), lower(p_logradouro)) * 0.3 ELSE 0 END +
      CASE WHEN p_bairro IS NOT NULL AND p_bairro <> '' THEN similarity(lower(COALESCE(i.bairro,'')), lower(p_bairro)) * 0.1 ELSE 0 END +
      CASE WHEN p_titulo IS NOT NULL AND p_titulo <> '' THEN similarity(lower(COALESCE(i.titulo,'')), lower(p_titulo)) * 0.2 ELSE 0 END
    )::real AS score
  FROM public.imoveis i
  WHERE COALESCE(i.arquivado, false) = false
    AND (
      (p_codigo IS NOT NULL AND p_codigo <> '' AND lower(i.codigo_interno) = lower(p_codigo))
      OR (p_numero IS NOT NULL AND p_numero <> '' AND lower(COALESCE(i.numero,'')) = lower(p_numero))
      OR (p_unidade IS NOT NULL AND p_unidade <> '' AND lower(COALESCE(i.unidade,'')) = lower(p_unidade))
      OR (p_logradouro IS NOT NULL AND p_logradouro <> '' AND similarity(lower(COALESCE(i.logradouro,'')), lower(p_logradouro)) > 0.25)
      OR (p_titulo IS NOT NULL AND p_titulo <> '' AND similarity(lower(COALESCE(i.titulo,'')), lower(p_titulo)) > 0.35)
    )
  ORDER BY score DESC
  LIMIT GREATEST(p_limit, 1)
$$;

GRANT EXECUTE ON FUNCTION public.buscar_imoveis_similares(text, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_imoveis_similares(text, text, text, text, text, text, text, integer) TO service_role;

CREATE TABLE public.import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'imoveis_ia',
  arquivo_nome text,
  status text NOT NULL DEFAULT 'processando',
  total_linhas integer NOT NULL DEFAULT 0,
  criados integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam import_jobs"
  ON public.import_jobs
  FOR ALL
  TO authenticated
  USING (public.is_admin_staff(auth.uid()))
  WITH CHECK (public.is_admin_staff(auth.uid()));

CREATE TRIGGER import_jobs_updated_at BEFORE UPDATE ON public.import_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();