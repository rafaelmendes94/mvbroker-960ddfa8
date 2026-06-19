-- Permite que usuários autenticados adicionem novas opções no catálogo global.
-- Edição/remoção continua restrita a super_admin (policy existente "Super admin manages options").
CREATE POLICY "Auth users can add options"
ON public.system_options
FOR INSERT
TO authenticated
WITH CHECK (true);