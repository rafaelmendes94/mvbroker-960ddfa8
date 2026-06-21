
-- ===== STEP 1: DROP TUDO =====
DROP TABLE IF EXISTS public.espelho_unidades CASCADE;
DROP TYPE IF EXISTS public.espelho_status CASCADE;
DROP TYPE IF EXISTS public.espelho_tipo CASCADE;
DROP FUNCTION IF EXISTS public.fn_espelho_gerar(text, uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.fn_espelho_sync_imovel() CASCADE;
DROP FUNCTION IF EXISTS public.fn_espelho_gerar_edificio() CASCADE;

-- ===== STEP 2: ENUMS + TABELA =====
CREATE TYPE public.espelho_tipo AS ENUM ('edificio','condominio','loteamento');
CREATE TYPE public.espelho_status AS ENUM ('indisponivel','disponivel','reservado','vendido');

CREATE TABLE public.espelho_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento_tipo public.espelho_tipo NOT NULL,
  empreendimento_id uuid NOT NULL,
  grupo integer NOT NULL,
  numero text NOT NULL,
  status public.espelho_status NOT NULL DEFAULT 'indisponivel',
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  valor numeric,
  area numeric,
  tipologia text,
  vagas integer,
  suites integer,
  nascente boolean DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT espelho_unidades_unique_numero UNIQUE (empreendimento_tipo, empreendimento_id, numero)
);
CREATE INDEX idx_espelho_emp ON public.espelho_unidades(empreendimento_tipo, empreendimento_id);
CREATE INDEX idx_espelho_unidades_imovel_id ON public.espelho_unidades(imovel_id);

-- ===== STEP 3: GRANTS =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.espelho_unidades TO authenticated;
GRANT ALL ON public.espelho_unidades TO service_role;

-- ===== STEP 4: RLS =====
ALTER TABLE public.espelho_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Espelho: leitura autenticada" ON public.espelho_unidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Espelho: insert admin" ON public.espelho_unidades
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE POLICY "Espelho: update admin" ON public.espelho_unidades
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE POLICY "Espelho: delete admin" ON public.espelho_unidades
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE TRIGGER trg_espelho_updated_at
  BEFORE UPDATE ON public.espelho_unidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== STEP 5: GERAÇÃO AUTOMÁTICA (edifício) =====
CREATE OR REPLACE FUNCTION public.fn_espelho_gerar_edificio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g int;
  u int;
  v_numero text;
BEGIN
  IF COALESCE(NEW.qtd_andares,0) <= 0 OR COALESCE(NEW.qtd_apartamentos,0) <= 0 THEN
    RETURN NEW;
  END IF;
  FOR g IN 1..NEW.qtd_andares LOOP
    FOR u IN 1..NEW.qtd_apartamentos LOOP
      v_numero := g::text || lpad(u::text, 2, '0');
      INSERT INTO public.espelho_unidades (empreendimento_tipo, empreendimento_id, grupo, numero, status)
      VALUES ('edificio', NEW.id, g, v_numero, 'indisponivel')
      ON CONFLICT (empreendimento_tipo, empreendimento_id, numero) DO NOTHING;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_edificios_gerar_espelho
  AFTER INSERT OR UPDATE OF qtd_andares, qtd_apartamentos ON public.edificios
  FOR EACH ROW EXECUTE FUNCTION public.fn_espelho_gerar_edificio();

-- ===== STEP 6: SYNC imovel -> espelho (coração da correção) =====
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
BEGIN
  -- DELETE: libera unidade vinculada
  IF TG_OP = 'DELETE' THEN
    UPDATE public.espelho_unidades
       SET imovel_id = NULL, status = 'indisponivel'
     WHERE imovel_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Em UPDATE: se vínculo/unidade mudou, libera a unidade antiga
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.espelho_unidades
       SET imovel_id = NULL, status = 'indisponivel'
     WHERE imovel_id = NEW.id
       AND (
         (NEW.edificio_id   IS DISTINCT FROM OLD.edificio_id)
         OR (NEW.condominio_id IS DISTINCT FROM OLD.condominio_id)
         OR (NEW.loteamento_id IS DISTINCT FROM OLD.loteamento_id)
         OR (COALESCE(NEW.unidade,'') IS DISTINCT FROM COALESCE(OLD.unidade,''))
         OR (COALESCE(NEW.lote,'')    IS DISTINCT FROM COALESCE(OLD.lote,''))
       );
  END IF;

  -- Resolve vínculo atual
  IF NEW.edificio_id IS NOT NULL THEN
    v_tipo := 'edificio';
    v_emp_id := NEW.edificio_id;
    v_numero := NULLIF(trim(NEW.unidade), '');
  ELSIF NEW.condominio_id IS NOT NULL THEN
    v_tipo := 'condominio';
    v_emp_id := NEW.condominio_id;
    v_numero := NULLIF(trim(NEW.unidade), '');
  ELSIF NEW.loteamento_id IS NOT NULL THEN
    v_tipo := 'loteamento';
    v_emp_id := NEW.loteamento_id;
    v_numero := NULLIF(trim(NEW.lote), '');
  ELSE
    -- Sem vínculo: garante que nenhuma unidade fica apontando pra este imóvel
    UPDATE public.espelho_unidades
       SET imovel_id = NULL, status = 'indisponivel'
     WHERE imovel_id = NEW.id;
    RETURN NEW;
  END IF;

  IF v_numero IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mapeia status do imóvel
  v_status_src := lower(COALESCE(NEW.status_imovel, 'disponivel'));
  v_status := CASE
    WHEN v_status_src = 'vendido'   THEN 'vendido'::public.espelho_status
    WHEN v_status_src = 'reservado' THEN 'reservado'::public.espelho_status
    ELSE 'disponivel'::public.espelho_status
  END;

  -- Tenta achar unidade existente (case-insensitive, sem espaços)
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
    -- Cria unidade na grade (best-effort para descobrir o grupo)
    v_grupo := CASE
      WHEN v_tipo = 'loteamento' THEN COALESCE(NULLIF(regexp_replace(COALESCE(NEW.quadra,''), '\D', '', 'g'), '')::int, 1)
      ELSE COALESCE(NULLIF(regexp_replace(substring(v_numero from 1 for greatest(length(v_numero)-2,1)), '\D', '', 'g'), '')::int, 1)
    END;
    INSERT INTO public.espelho_unidades
      (empreendimento_tipo, empreendimento_id, grupo, numero, status, imovel_id)
    VALUES (v_tipo, v_emp_id, v_grupo, v_numero, v_status, NEW.id)
    ON CONFLICT (empreendimento_tipo, empreendimento_id, numero)
      DO UPDATE SET imovel_id = EXCLUDED.imovel_id, status = EXCLUDED.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_imoveis_espelho_sync_ins
  AFTER INSERT ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_espelho_sync_imovel();

CREATE TRIGGER trg_imoveis_espelho_sync_upd
  AFTER UPDATE OF status_imovel, edificio_id, condominio_id, loteamento_id, unidade, lote, quadra
  ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_espelho_sync_imovel();

CREATE TRIGGER trg_imoveis_espelho_sync_del
  AFTER DELETE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_espelho_sync_imovel();

-- ===== STEP 7: REGERAR ESPELHO DOS EDIFICIOS EXISTENTES =====
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, qtd_andares, qtd_apartamentos FROM public.edificios
           WHERE COALESCE(qtd_andares,0) > 0 AND COALESCE(qtd_apartamentos,0) > 0
  LOOP
    PERFORM 1;
    -- chama indiretamente: update no-op não dispara (trigger usa UPDATE OF). Faz insert direto:
    FOR i IN 1..r.qtd_andares LOOP
      FOR j IN 1..r.qtd_apartamentos LOOP
        INSERT INTO public.espelho_unidades (empreendimento_tipo, empreendimento_id, grupo, numero, status)
        VALUES ('edificio', r.id, i, i::text || lpad(j::text, 2, '0'), 'indisponivel')
        ON CONFLICT (empreendimento_tipo, empreendimento_id, numero) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ===== STEP 8: BACKFILL — sincroniza imóveis existentes =====
UPDATE public.imoveis
   SET status_imovel = status_imovel
 WHERE edificio_id IS NOT NULL OR condominio_id IS NOT NULL OR loteamento_id IS NOT NULL;
