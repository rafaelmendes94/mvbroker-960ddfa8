CREATE OR REPLACE FUNCTION public.tg_imoveis_notify_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo text := COALESCE(NEW.codigo_interno, NEW.id::text);
  v_link   text := '/imoveis/' || NEW.id::text;
  v_user   uuid;
  v_bonus  numeric;
BEGIN
  IF COALESCE(NEW.arquivado, false) = true THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_bonus := NULLIF(regexp_replace(COALESCE(NEW.bonus::text, ''), '[^0-9.]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    v_bonus := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT user_id FROM public.user_roles
     WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
  LOOP
    PERFORM public.criar_notificacao(
      v_user,
      'Novo imóvel cadastrado',
      'Imóvel ' || v_codigo || COALESCE(' — ' || NEW.titulo, '') || ' foi cadastrado.',
      'novo_imovel'::public.notification_tipo,
      'imoveis'::public.notification_categoria,
      v_link,
      jsonb_build_object('imovel_id', NEW.id, 'codigo', v_codigo)
    );

    IF COALESCE(NEW.exclusividade, false) = true OR COALESCE(NEW.exclusivo, false) = true THEN
      PERFORM public.criar_notificacao(
        v_user,
        'Novo imóvel exclusivo',
        'Imóvel ' || v_codigo || ' é exclusividade.',
        'novo_exclusivo'::public.notification_tipo,
        'imoveis'::public.notification_categoria,
        v_link,
        jsonb_build_object('imovel_id', NEW.id)
      );
    END IF;

    IF v_bonus IS NOT NULL AND v_bonus > 0 THEN
      PERFORM public.criar_notificacao(
        v_user,
        'Imóvel com bônus',
        'Imóvel ' || v_codigo || ' possui bônus de R$ ' || v_bonus::text || '.',
        'novo_bonus'::public.notification_tipo,
        'imoveis'::public.notification_categoria,
        v_link,
        jsonb_build_object('imovel_id', NEW.id, 'bonus', v_bonus)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

INSERT INTO public.notifications (usuario_id, titulo, mensagem, tipo, categoria, link, metadata)
SELECT p.id,
       'Bem-vindo ao MV Broker',
       'Seu sistema de notificações está ativo. Você receberá alertas de novos imóveis, exclusividades, bônus e atualizações.',
       'sistema'::public.notification_tipo,
       'sistema'::public.notification_categoria,
       '/notificacoes',
       '{}'::jsonb
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.notifications n WHERE n.usuario_id = p.id
);