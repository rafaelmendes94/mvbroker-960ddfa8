
-- 1) custom_roles
CREATE TABLE public.custom_roles (
  slug text PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_roles_slug_format CHECK (slug ~ '^[a-z][a-z0-9_]{1,40}$')
);
GRANT SELECT ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_roles select authenticated" ON public.custom_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_roles admin manage" ON public.custom_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_custom_roles_updated
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) role_module_permissions
CREATE TABLE public.role_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug text NOT NULL,
  modulo text NOT NULL,
  pode_ver boolean NOT NULL DEFAULT false,
  pode_criar boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT false,
  pode_excluir boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_slug, modulo)
);
GRANT SELECT ON public.role_module_permissions TO authenticated;
GRANT ALL ON public.role_module_permissions TO service_role;
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rmp select authenticated" ON public.role_module_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rmp admin manage" ON public.role_module_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_rmp_updated
  BEFORE UPDATE ON public.role_module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) user_custom_roles
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_slug text NOT NULL REFERENCES public.custom_roles(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_slug)
);
GRANT SELECT ON public.user_custom_roles TO authenticated;
GRANT ALL ON public.user_custom_roles TO service_role;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ucr select own" ON public.user_custom_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "ucr admin manage" ON public.user_custom_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4) função efetiva
CREATE OR REPLACE FUNCTION public.get_minhas_permissoes_efetivas()
RETURNS TABLE(modulo text, pode_ver boolean, pode_criar boolean, pode_editar boolean, pode_excluir boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH meus_papeis AS (
    SELECT role::text AS slug FROM public.user_roles WHERE user_id = auth.uid()
    UNION
    SELECT role_slug FROM public.user_custom_roles WHERE user_id = auth.uid()
  ),
  por_papel AS (
    SELECT rmp.modulo,
      bool_or(rmp.pode_ver) AS pode_ver,
      bool_or(rmp.pode_criar) AS pode_criar,
      bool_or(rmp.pode_editar) AS pode_editar,
      bool_or(rmp.pode_excluir) AS pode_excluir
    FROM public.role_module_permissions rmp
    JOIN meus_papeis mp ON mp.slug = rmp.role_slug
    GROUP BY rmp.modulo
  ),
  por_usuario AS (
    SELECT modulo, pode_ver, pode_criar, pode_editar, pode_excluir
    FROM public.user_module_permissions
    WHERE user_id = auth.uid()
  )
  SELECT
    COALESCE(pp.modulo, pu.modulo) AS modulo,
    COALESCE(pp.pode_ver, false)    OR COALESCE(pu.pode_ver, false)    AS pode_ver,
    COALESCE(pp.pode_criar, false)  OR COALESCE(pu.pode_criar, false)  AS pode_criar,
    COALESCE(pp.pode_editar, false) OR COALESCE(pu.pode_editar, false) AS pode_editar,
    COALESCE(pp.pode_excluir, false) OR COALESCE(pu.pode_excluir, false) AS pode_excluir
  FROM por_papel pp
  FULL OUTER JOIN por_usuario pu ON pu.modulo = pp.modulo;
$$;
