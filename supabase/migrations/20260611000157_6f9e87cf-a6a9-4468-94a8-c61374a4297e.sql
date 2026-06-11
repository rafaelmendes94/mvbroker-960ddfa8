-- Corretores: bloquear leitura direta de colunas sensíveis
REVOKE SELECT (email, telefone, whatsapp) ON public.corretores FROM anon, authenticated;

-- Imobiliárias: bloquear leitura direta de colunas sensíveis
REVOKE SELECT (cnpj, email, telefone) ON public.imobiliarias FROM anon, authenticated;

-- Imóveis: bloquear leitura direta de campos internos
REVOKE SELECT (
  observacoes_internas,
  local_chaves,
  responsavel_nome,
  responsavel_telefone,
  responsavel_whatsapp,
  responsavel_email,
  comissao_percentual,
  valor_comissao,
  termo_exclusividade_path,
  pdf_comercial_path
) ON public.imoveis FROM anon, authenticated;
