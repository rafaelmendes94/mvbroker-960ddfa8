
CREATE OR REPLACE FUNCTION public.fn_espelho_sync_imovel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo public.espelho_tipo;
  v_emp_id uuid;
  v_numero text;
  v_grupo int;
  v_status public.espelho_status;
  v_status_src text;
  v_found uuid;
  v_unidade text;
  v_lote text;
  v_quadra text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.espelho_unidades
       SET imovel_id = NULL, status = 'indisponivel'
     WHERE imovel_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.espelho_unidades
       SET imovel_id = NULL, status = 'indisponivel'
     WHERE imovel_id = NEW.id
       AND (
         (NEW.edificio_id    IS DISTINCT FROM OLD.edificio_id)
         OR (NEW.condominio_id IS DISTINCT FROM OLD.condominio_id)
         OR (NEW.loteamento_id IS DISTINCT FROM OLD.loteamento_id)
         OR (COALESCE(NEW.unidade,'') IS DISTINCT FROM COALESCE(OLD.unidade,''))
         OR (COALESCE(NEW.lote,'')    IS DISTINCT FROM COALESCE(OLD.lote,''))
         OR (COALESCE(NEW.quadra,'')  IS DISTINCT FROM COALESCE(OLD.quadra,''))
       );
  END IF;

  IF NEW.edificio_id IS NOT NULL THEN
    v_tipo := 'edificio'; v_emp_id := NEW.edificio_id;
  ELSIF NEW.condominio_id IS NOT NULL THEN
    v_tipo := 'condominio'; v_emp_id := NEW.condominio_id;
  ELSIF NEW.loteamento_id IS NOT NULL THEN
    v_tipo := 'loteamento'; v_emp_id := NEW.loteamento_id;
  ELSE
    UPDATE public.espelho_unidades
       SET imovel_id = NULL, status = 'indisponivel'
     WHERE imovel_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Resolve identificador flexível: Unidade OU Quadra/Lote
  v_unidade := NULLIF(trim(COALESCE(NEW.unidade, '')), '');
  v_lote    := NULLIF(trim(COALESCE(NEW.lote, '')), '');
  v_quadra  := NULLIF(trim(COALESCE(NEW.quadra, '')), '');

  IF v_unidade IS NOT NULL THEN
    v_numero := v_unidade;
  ELSIF v_lote IS NOT NULL AND v_quadra IS NOT NULL THEN
    v_numero := 'Qd ' || regexp_replace(v_quadra, '^(Qd?|Lt?|L)\s*[-.]?\s*', '', 'i')
             || ' - Lt ' || regexp_replace(v_lote, '^(Qd?|Lt?|L)\s*[-.]?\s*', '', 'i');
  ELSIF v_lote IS NOT NULL THEN
    v_numero := 'Lt ' || regexp_replace(v_lote, '^(Qd?|Lt?|L)\s*[-.]?\s*', '', 'i');
  ELSE
    RETURN NEW;
  END IF;

  v_status_src := lower(COALESCE(NEW.status_imovel, 'disponivel'));
  v_status := CASE
    WHEN v_status_src = 'vendido'   THEN 'vendido'::public.espelho_status
    WHEN v_status_src = 'reservado' THEN 'reservado'::public.espelho_status
    ELSE 'disponivel'::public.espelho_status
  END;

  SELECT id INTO v_found
    FROM public.espelho_unidades
   WHERE empreendimento_tipo = v_tipo
     AND empreendimento_id   = v_emp_id
     AND regexp_replace(lower(numero), '\s+', '', 'g') = regexp_replace(lower(v_numero), '\s+', '', 'g')
   LIMIT 1;

  IF v_found IS NOT NULL THEN
    UPDATE public.espelho_unidades
       SET imovel_id = NEW.id, status = v_status
     WHERE id = v_found;
  ELSE
    v_grupo := COALESCE(
      NULLIF(regexp_replace(COALESCE(v_quadra, ''), '\D', '', 'g'), '')::int,
      NULLIF(regexp_replace(substring(v_numero from 1 for greatest(length(v_numero)-2,1)), '\D', '', 'g'), '')::int,
      1
    );
    INSERT INTO public.espelho_unidades
      (empreendimento_tipo, empreendimento_id, grupo, numero, status, imovel_id)
    VALUES (v_tipo, v_emp_id, v_grupo, v_numero, v_status, NEW.id)
    ON CONFLICT (empreendimento_tipo, empreendimento_id, numero)
      DO UPDATE SET imovel_id = EXCLUDED.imovel_id, status = EXCLUDED.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_imoveis_espelho_sync_upd ON public.imoveis;
CREATE TRIGGER trg_imoveis_espelho_sync_upd
  AFTER UPDATE OF status_imovel, edificio_id, condominio_id, loteamento_id, unidade, lote, quadra
  ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_espelho_sync_imovel();
