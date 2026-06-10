
CREATE OR REPLACE FUNCTION public.imobiliaria_limite_corretores(p_imob uuid)
RETURNS TABLE(usados int, limite int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.corretores
      WHERE imobiliaria_id = p_imob AND status = 'ativo'),
    (SELECT p.limite_usuarios FROM public.assinaturas a
      JOIN public.planos p ON p.id = a.plano_id
      WHERE a.imobiliaria_id = p_imob AND a.status = 'ativa'
      LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION public.tg_corretores_check_limite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_used int; v_max int;
BEGIN
  IF NEW.imobiliaria_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.status, 'ativo') <> 'ativo' THEN RETURN NEW; END IF;
  SELECT usados, limite INTO v_used, v_max
    FROM public.imobiliaria_limite_corretores(NEW.imobiliaria_id);
  IF v_max IS NOT NULL AND v_used >= v_max THEN
    RAISE EXCEPTION 'O plano desta imobiliária atingiu o limite de % corretores ativos.', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_corretores_check_limite ON public.corretores;
CREATE TRIGGER trg_corretores_check_limite
  BEFORE INSERT OR UPDATE OF imobiliaria_id, status ON public.corretores
  FOR EACH ROW EXECUTE FUNCTION public.tg_corretores_check_limite();
