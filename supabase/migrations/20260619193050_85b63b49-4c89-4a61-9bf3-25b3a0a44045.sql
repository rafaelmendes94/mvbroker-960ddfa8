
-- Fix recursão RLS entre carteiras e carteira_compartilhamentos
-- usando funções SECURITY DEFINER já existentes (pode_ler_carteira, pode_editar_carteira).

DROP POLICY IF EXISTS "Read carteiras (own, shared, public, admin)" ON public.carteiras;
DROP POLICY IF EXISTS "Update carteiras (owner, shared editor, admin)" ON public.carteiras;
DROP POLICY IF EXISTS "Owner manages shares" ON public.carteira_compartilhamentos;
DROP POLICY IF EXISTS "Shared user reads own share" ON public.carteira_compartilhamentos;

-- carteiras: SELECT
CREATE POLICY "Read carteiras (own, shared, public, admin)"
ON public.carteiras
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  OR visibilidade = 'publica'
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.pode_ler_carteira(auth.uid(), id)
);

-- carteiras: UPDATE
CREATE POLICY "Update carteiras (owner, shared editor, admin)"
ON public.carteiras
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.pode_editar_carteira(auth.uid(), id)
)
WITH CHECK (
  usuario_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.pode_editar_carteira(auth.uid(), id)
);

-- carteira_compartilhamentos: SELECT próprio share
CREATE POLICY "Shared user reads own share"
ON public.carteira_compartilhamentos
FOR SELECT
TO authenticated
USING (usuario_id = auth.uid());

-- carteira_compartilhamentos: dono gerencia (sem subquery a carteiras na própria policy
-- causa recursão; usamos função SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_carteira_owner(_user_id uuid, _carteira_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.carteiras c
    WHERE c.id = _carteira_id AND c.usuario_id = _user_id
  )
$$;

CREATE POLICY "Owner manages shares"
ON public.carteira_compartilhamentos
FOR ALL
TO authenticated
USING (
  public.is_carteira_owner(auth.uid(), carteira_id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.is_carteira_owner(auth.uid(), carteira_id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
