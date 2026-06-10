
-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.notification_tipo AS ENUM (
    'novo_imovel',
    'imovel_atualizado',
    'novo_exclusivo',
    'novo_bonus',
    'xml_atualizado',
    'erro_xml',
    'publicacao_aprovada',
    'publicacao_rejeitada',
    'sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_categoria AS ENUM (
    'imoveis', 'xml', 'portais', 'sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TABELA notifications
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo public.notification_tipo NOT NULL DEFAULT 'sistema',
  categoria public.notification_categoria NOT NULL DEFAULT 'sistema',
  lida boolean NOT NULL DEFAULT false,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve proprias notificacoes" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'secretaria'::app_role)
  );

CREATE POLICY "usuario atualiza proprias notificacoes" ON public.notifications
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "usuario deleta proprias notificacoes" ON public.notifications
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

-- INSERT só via SECURITY DEFINER (criar_notificacao). Nenhuma policy de INSERT a usuários.

CREATE INDEX IF NOT EXISTS idx_notifications_usuario_lida
  ON public.notifications (usuario_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_categoria
  ON public.notifications (usuario_id, categoria, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================================
-- TABELA notification_preferences
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  tipo public.notification_tipo NOT NULL,
  canal_sistema boolean NOT NULL DEFAULT true,
  canal_email boolean NOT NULL DEFAULT false,
  canal_whatsapp boolean NOT NULL DEFAULT false,
  canal_push boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario gerencia suas preferencias" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- FUNÇÕES UTILITÁRIAS
-- =========================================================

CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_usuario_id uuid,
  p_titulo text,
  p_mensagem text,
  p_tipo public.notification_tipo,
  p_categoria public.notification_categoria DEFAULT 'sistema',
  p_link text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_pref boolean;
BEGIN
  IF p_usuario_id IS NULL THEN RETURN NULL; END IF;

  -- Respeita preferência canal_sistema se existir
  SELECT canal_sistema INTO v_pref
  FROM public.notification_preferences
  WHERE usuario_id = p_usuario_id AND tipo = p_tipo;

  IF v_pref IS NOT NULL AND v_pref = false THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications(usuario_id, titulo, mensagem, tipo, categoria, link, metadata)
  VALUES (p_usuario_id, p_titulo, p_mensagem, p_tipo, p_categoria, p_link, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications
     SET lida = true
   WHERE id = p_id AND usuario_id = auth.uid();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.marcar_todas_lidas(p_categoria public.notification_categoria DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.notifications
     SET lida = true
   WHERE usuario_id = auth.uid()
     AND lida = false
     AND (p_categoria IS NULL OR categoria = p_categoria);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.contar_nao_lidas()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.notifications
   WHERE usuario_id = auth.uid() AND lida = false
$$;

CREATE OR REPLACE FUNCTION public.get_preferencias_notificacao()
RETURNS TABLE(tipo public.notification_tipo, canal_sistema boolean, canal_email boolean, canal_whatsapp boolean, canal_push boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.tipo,
         COALESCE(np.canal_sistema, true) AS canal_sistema,
         COALESCE(np.canal_email, false)  AS canal_email,
         COALESCE(np.canal_whatsapp, false) AS canal_whatsapp,
         COALESCE(np.canal_push, false)   AS canal_push
  FROM unnest(enum_range(NULL::public.notification_tipo)) t(tipo)
  LEFT JOIN public.notification_preferences np
    ON np.tipo = t.tipo AND np.usuario_id = auth.uid()
  ORDER BY t.tipo;
$$;

-- =========================================================
-- TRIGGERS sobre imoveis
-- =========================================================

CREATE OR REPLACE FUNCTION public.tg_imoveis_notify_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cidade text := COALESCE(NEW.cidade, 'sem cidade');
  v_codigo text := COALESCE(NEW.codigo_interno, NEW.id::text);
  v_link text := '/imoveis/' || NEW.id::text;
  v_user uuid;
BEGIN
  -- Notifica super_admin e secretaria
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.user_roles
     WHERE role IN ('super_admin', 'secretaria')
  LOOP
    PERFORM public.criar_notificacao(
      v_user,
      'Novo imóvel cadastrado',
      'Novo imóvel ' || v_codigo || ' cadastrado em ' || v_cidade || '.',
      'novo_imovel', 'imoveis', v_link,
      jsonb_build_object('imovel_id', NEW.id, 'cidade', v_cidade)
    );
  END LOOP;

  -- Notifica owner da imobiliária dona do imóvel
  IF NEW.imobiliaria_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      i.owner_id,
      'Novo imóvel cadastrado',
      'Novo imóvel ' || v_codigo || ' em ' || v_cidade || '.',
      'novo_imovel', 'imoveis', v_link,
      jsonb_build_object('imovel_id', NEW.id)
    )
    FROM public.imobiliarias i
    WHERE i.id = NEW.imobiliaria_id AND i.owner_id IS NOT NULL;
  END IF;

  -- Bonus / Exclusividade no insert
  IF COALESCE(NEW.bonus_valor, 0) > 0 THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
    LOOP
      PERFORM public.criar_notificacao(
        v_user,
        'Imóvel com bônus',
        'Imóvel ' || v_codigo || ' possui bônus de R$ ' || NEW.bonus_valor::text || '.',
        'novo_bonus', 'imoveis', v_link,
        jsonb_build_object('imovel_id', NEW.id, 'bonus', NEW.bonus_valor)
      );
    END LOOP;
  END IF;

  IF COALESCE(NEW.exclusividade, false) = true THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
    LOOP
      PERFORM public.criar_notificacao(
        v_user,
        'Novo imóvel exclusivo',
        'Imóvel ' || v_codigo || ' cadastrado como exclusividade.',
        'novo_exclusivo', 'imoveis', v_link,
        jsonb_build_object('imovel_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_imoveis_notify_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo text := COALESCE(NEW.codigo_interno, NEW.id::text);
  v_link text := '/imoveis/' || NEW.id::text;
  v_user uuid;
  v_msg text := NULL;
  v_tipo public.notification_tipo := 'imovel_atualizado';
BEGIN
  -- Detectar mudanças relevantes
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    v_msg := 'Imóvel ' || v_codigo || ' teve o valor alterado.';
  ELSIF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    v_msg := 'Imóvel ' || v_codigo || ' teve a descrição atualizada.';
  ELSIF NEW.comissao_percentual IS DISTINCT FROM OLD.comissao_percentual
     OR NEW.valor_comissao IS DISTINCT FROM OLD.valor_comissao THEN
    v_msg := 'Imóvel ' || v_codigo || ' teve a comissão alterada.';
  END IF;

  -- Exclusividade ativada
  IF COALESCE(NEW.exclusividade, false) = true AND COALESCE(OLD.exclusividade, false) = false THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
    LOOP
      PERFORM public.criar_notificacao(
        v_user,
        'Novo imóvel exclusivo',
        'Imóvel ' || v_codigo || ' agora é exclusividade.',
        'novo_exclusivo', 'imoveis', v_link,
        jsonb_build_object('imovel_id', NEW.id)
      );
    END LOOP;
  END IF;

  -- Bônus alterado
  IF COALESCE(NEW.bonus_valor, 0) > 0
     AND COALESCE(NEW.bonus_valor, 0) IS DISTINCT FROM COALESCE(OLD.bonus_valor, 0) THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('super_admin', 'secretaria', 'corretor_autonomo', 'imobiliaria')
    LOOP
      PERFORM public.criar_notificacao(
        v_user,
        'Imóvel com bônus',
        'Imóvel ' || v_codigo || ' agora possui bônus de R$ ' || NEW.bonus_valor::text || '.',
        'novo_bonus', 'imoveis', v_link,
        jsonb_build_object('imovel_id', NEW.id, 'bonus', NEW.bonus_valor)
      );
    END LOOP;
  END IF;

  -- Mudança genérica → notifica owner da imobiliária
  IF v_msg IS NOT NULL AND NEW.imobiliaria_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      i.owner_id, 'Imóvel atualizado', v_msg, v_tipo, 'imoveis', v_link,
      jsonb_build_object('imovel_id', NEW.id)
    )
    FROM public.imobiliarias i
    WHERE i.id = NEW.imobiliaria_id AND i.owner_id IS NOT NULL;
  END IF;

  RETURN NEW;
END $$;

-- Drop e recriar triggers (idempotente)
DROP TRIGGER IF EXISTS trg_imoveis_notify_insert ON public.imoveis;
CREATE TRIGGER trg_imoveis_notify_insert
  AFTER INSERT ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_imoveis_notify_insert();

DROP TRIGGER IF EXISTS trg_imoveis_notify_update ON public.imoveis;
CREATE TRIGGER trg_imoveis_notify_update
  AFTER UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_imoveis_notify_update();
