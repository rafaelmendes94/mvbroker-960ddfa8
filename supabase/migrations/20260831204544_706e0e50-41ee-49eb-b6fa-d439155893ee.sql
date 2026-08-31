DROP FUNCTION IF EXISTS public.imobiliaria_limite_corretores(uuid);
CREATE FUNCTION public.imobiliaria_limite_corretores(p_imob uuid)
 RETURNS TABLE(usados integer, limite integer, tem_plano_ativo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*)::int FROM public.corretores
      WHERE imobiliaria_id = p_imob AND status = 'ativo'),
    (SELECT p.limite_usuarios FROM public.assinaturas a
      JOIN public.planos p ON p.id = a.plano_id
      WHERE a.imobiliaria_id = p_imob AND a.status = 'ativa'
      LIMIT 1),
    EXISTS (SELECT 1 FROM public.assinaturas a
      WHERE a.imobiliaria_id = p_imob AND a.status = 'ativa');
$function$;

-- Repara assinaturas de imobiliária gravadas em usuario_id
DO $$
DECLARE r RECORD; v_imob uuid;
BEGIN
  FOR r IN
    SELECT a.id, a.usuario_id
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.status = 'ativa' AND p.tipo = 'imobiliaria'
      AND a.imobiliaria_id IS NULL AND a.usuario_id IS NOT NULL
  LOOP
    SELECT i.id INTO v_imob FROM public.imobiliarias i WHERE i.owner_id = r.usuario_id LIMIT 1;
    IF v_imob IS NULL THEN CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.assinaturas b
               WHERE b.imobiliaria_id = v_imob AND b.status = 'ativa') THEN
      UPDATE public.assinaturas SET status = 'cancelada' WHERE id = r.id;
    ELSE
      UPDATE public.assinaturas
         SET imobiliaria_id = v_imob, usuario_id = NULL
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

UPDATE public.imobiliarias i
   SET status = 'ativa'
 WHERE EXISTS (SELECT 1 FROM public.assinaturas a
               WHERE a.imobiliaria_id = i.id AND a.status = 'ativa')
   AND COALESCE(i.status, '') <> 'ativa';