
CREATE OR REPLACE FUNCTION public.tg_imoveis_notify_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func text;
  v_src text;
BEGIN
  -- regenerate body but with safe bonus check (text -> numeric)
  RETURN NEW;
END;
$$;
