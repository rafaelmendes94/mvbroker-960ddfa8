CREATE OR REPLACE FUNCTION public.tg_imoveis_notify_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo text := COALESCE(NEW.codigo_interno, NEW.id::text);
  v_link text := '/imoveis/' || NEW.id::text;
  v_user uuid;
  v_msg text := NULL;
  v_new_bonus numeric;
  v_old_bonus numeric;
BEGIN
  IF NEW.preco IS DISTINCT FROM OLD.preco THEN
    v_msg := 'Imóvel ' || v_codigo || ' teve o valor alterado.';
  ELSIF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    v_msg := 'Imóvel ' || v_codigo || ' teve a descrição atualizada.';
  ELSIF NEW.comissao_percentual IS DISTINCT FROM OLD.comissao_percentual
     OR NEW.valor_comissao IS DISTINCT FROM OLD.valor_comissao THEN
    v_msg := 'Imóvel ' || v_codigo || ' teve a comissão alterada.';
  END IF;

  IF COALESCE(NEW.exclusividade, false) = true AND COALESCE(OLD.exclusividade, false) = false THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
    LOOP
      PERFORM public.criar_notificacao(
        v_user, 'Novo imóvel exclusivo',
        'Imóvel ' || v_codigo || ' agora é exclusividade.',
        'novo_exclusivo', 'imoveis', v_link,
        jsonb_build_object('imovel_id', NEW.id)
      );
    END LOOP;
  END IF;

  BEGIN
    v_new_bonus := NULLIF(regexp_replace(COALESCE(NEW.bonus::text, ''), '[^0-9.]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN v_new_bonus := NULL; END;
  BEGIN
    v_old_bonus := NULLIF(regexp_replace(COALESCE(OLD.bonus::text, ''), '[^0-9.]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN v_old_bonus := NULL; END;

  IF COALESCE(v_new_bonus, 0) > 0
     AND COALESCE(v_new_bonus, 0) IS DISTINCT FROM COALESCE(v_old_bonus, 0) THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
    LOOP
      PERFORM public.criar_notificacao(
        v_user, 'Imóvel com bônus',
        'Imóvel ' || v_codigo || ' agora possui bônus de R$ ' || v_new_bonus::text || '.',
        'novo_bonus', 'imoveis', v_link,
        jsonb_build_object('imovel_id', NEW.id, 'bonus', v_new_bonus)
      );
    END LOOP;
  END IF;

  IF v_msg IS NOT NULL AND NEW.imobiliaria_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      i.owner_id, 'Imóvel atualizado', v_msg, 'imovel_atualizado', 'imoveis', v_link,
      jsonb_build_object('imovel_id', NEW.id)
    )
    FROM public.imobiliarias i
    WHERE i.id = NEW.imobiliaria_id AND i.owner_id IS NOT NULL;
  END IF;

  RETURN NEW;
END $function$;