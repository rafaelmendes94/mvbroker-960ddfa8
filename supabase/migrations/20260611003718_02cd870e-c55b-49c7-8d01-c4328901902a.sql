
INSERT INTO public.system_options (categoria, nome, slug, ativo, ordem)
VALUES ('contato', '5551983282535', 'whatsapp_comercial', true, 1)
ON CONFLICT (categoria, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_contato_publico(p_slug text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome FROM public.system_options
   WHERE categoria = 'contato' AND slug = p_slug AND ativo = true
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_contato_publico(text) TO anon, authenticated;
