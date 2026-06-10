
CREATE TYPE public.arquivo_categoria AS ENUM ('fotos','documentos','contratos','exclusividades','materiais','plantas','outros');
CREATE TYPE public.arquivo_acao AS ENUM ('upload','download','exclusao','atualizacao');

CREATE TABLE public.arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria public.arquivo_categoria NOT NULL DEFAULT 'outros',
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumb_path TEXT,
  medium_path TEXT,
  tamanho BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  publico BOOLEAN NOT NULL DEFAULT false,
  registro_tipo TEXT,
  registro_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivos TO authenticated;
GRANT ALL ON public.arquivos TO service_role;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arquivos read" ON public.arquivos FOR SELECT TO authenticated
  USING (publico OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria') OR usuario_id = auth.uid());
CREATE POLICY "arquivos insert" ON public.arquivos FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria'));
CREATE POLICY "arquivos update" ON public.arquivos FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria'));
CREATE POLICY "arquivos delete" ON public.arquivos FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'secretaria'));
CREATE TRIGGER trg_arquivos_upd BEFORE UPDATE ON public.arquivos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_arquivos_registro ON public.arquivos(registro_tipo, registro_id);
CREATE INDEX idx_arquivos_categoria ON public.arquivos(categoria);

CREATE TABLE public.arquivo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id UUID REFERENCES public.arquivos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  acao public.arquivo_acao NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arquivo_logs TO authenticated;
GRANT ALL ON public.arquivo_logs TO service_role;
ALTER TABLE public.arquivo_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arquivo_logs read" ON public.arquivo_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR usuario_id = auth.uid());
CREATE POLICY "arquivo_logs insert" ON public.arquivo_logs FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
