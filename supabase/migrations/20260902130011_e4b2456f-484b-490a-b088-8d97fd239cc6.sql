ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueio_motivo text,
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_por uuid;

DROP POLICY IF EXISTS "Usuario ve proprio profile" ON public.profiles;
CREATE POLICY "Usuario ve proprio profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

DROP POLICY IF EXISTS "Admin atualiza bloqueio de profile" ON public.profiles;
CREATE POLICY "Admin atualiza bloqueio de profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'secretaria'));

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;