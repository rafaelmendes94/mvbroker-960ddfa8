# Importação inteligente de planilhas (IA)

Novo módulo de importação de imóveis por planilha que usa IA para mapear colunas, limpar/normalizar dados e evitar duplicidade mesmo com erros de digitação. O resultado é revisado antes de gravar.

## Fluxo do usuário

1. **Enviar arquivo** — XLSX/CSV, com pré-visualização das primeiras linhas.
2. **Mapeamento automático (IA)** — a IA lê os cabeçalhos + amostra de linhas e propõe o campo do sistema para cada coluna, com nível de confiança. O usuário pode ajustar qualquer coluna manualmente.
3. **Normalização (IA + regras)** — em lotes:
   - tipo de imóvel, status, padrão, cidade/estado, booleanos, preços, datas e áreas convertidos para os valores válidos do sistema;
   - correção de digitação em título, bairro, logradouro e nome do empreendimento (padroniza capitalização, remove abreviações inconsistentes);
   - `outras_caracteristicas` vira lista; condições de pagamento (financiamento, entrada, prazos) concatenadas em um único campo;
   - `estado` padrão "RS" quando ausente; título de fallback quando vazio.
   - **Status ativo/inativo**: a planilha pode trazer a coluna de situação (Ativo/Inativo, Sim/Não, 1/0, Disponível/Vendido). A IA interpreta e converte para o status do sistema (`disponivel`, `reservado`, `vendido`) e para o campo de arquivado. Na tela de importação existe um seletor de status padrão, aplicado às linhas em que a planilha não informa nada, com opção de forçar o mesmo status em todas as linhas.

4. **Detecção de duplicados** — para cada linha, o sistema busca candidatos no banco e classifica:
   - **Idêntico** (código interno igual, ou endereço+unidade equivalentes) → atualiza automaticamente o imóvel existente;
   - **Provável duplicado** (semelhança alta por empreendimento+unidade ou endereço, com diferenças de digitação) → também atualiza automaticamente, e a linha entra no relatório marcada como "atualizado por semelhança";
   - **Duvidoso** (semelhança média) → fica pendente para o usuário decidir: atualizar, criar novo ou ignorar;
   - **Novo** → cria.
5. **Vínculo de empreendimento** — quando a planilha traz nome de condomínio/edifício/loteamento, a IA encontra o cadastro existente equivalente e vincula; se não existir, o usuário escolhe criar ou deixar sem vínculo.
6. **Revisão e execução** — tela com contadores (novos, atualizados, duvidosos, com erro), pré-visualização das alterações campo a campo nos atualizados, e botão para confirmar. Ao final, relatório exportável com o que foi criado, atualizado, ignorado e falhou.

## Regras de duplicidade

Comparação em duas etapas, do barato para o caro:

1. **Chaves determinísticas**: `codigo_interno`; e chave composta normalizada (cidade + logradouro + número + unidade/quadra/lote).
2. **Semelhança textual** (sem IA): normalização (minúsculas, sem acento/pontuação, abreviações de logradouro expandidas) + similaridade por trigramas para gerar até ~5 candidatos por linha.
3. **Desempate por IA**: só os candidatos da faixa cinzenta vão para o modelo, em lote, que responde `mesmo_imovel | diferente | incerto` com justificativa curta. Alto → atualiza; incerto → pendente para o usuário.

A deduplicação também roda **dentro do próprio arquivo**, para não importar duas linhas iguais da mesma planilha.

## Detalhes técnicos

- **Rota**: `/importacoes/imoveis-ia` (super admin/secretaria), item novo em Importações, reusando `FileDropzone`, `PreviewTable`, `ColumnMapper` e `ImportReport`.
- **Parsing** continua no cliente com `xlsx` (`parseFile` de `src/lib/import-runner.ts`) e coerção via `coerceValue`.
- **Server functions** novas em `src/lib/import-ia.functions.ts`:
  - `sugerirMapeamento` — cabeçalhos + 20 linhas de amostra → mapa coluna→campo com confiança;
  - `normalizarLote` — normaliza/corrige um lote de ~40 linhas;
  - `resolverDuplicados` — recebe linha + candidatos e devolve o veredito;
  - `executarImportacao` — grava em lotes com `upsert` por `codigo_interno` e `update` por id nos casos resolvidos, registrando log.
- **IA**: Lovable AI Gateway via `createLovableAiGatewayProvider` (`src/lib/ai-gateway.server.ts`) com saída estruturada (Zod), `google/gemini-3-flash-preview` como padrão por custo/velocidade; processamento em lotes com limite de concorrência e barra de progresso.
- **Busca de candidatos**: função SQL `buscar_imoveis_similares(...)` usando `pg_trgm` (extensão + índices GIN em `titulo`, `logradouro`, `bairro`, `cidade`) para performance com 5 mil+ linhas.
- **Migration**: extensão `pg_trgm`, índices, função de busca, e tabela `import_jobs` (arquivo, usuário, status, contadores, resultado JSON) com GRANTs e RLS restrita a super admin/secretaria, para permitir reabrir o relatório depois.
- **Segurança**: todas as server functions com middleware de autenticação e checagem de papel administrativo; nada de gravação sem confirmação explícita do usuário.
- **Auditoria**: cada criação/atualização passa pelos triggers já existentes (`audit_logs`, sincronização de `units` e espelho).

## Fora do escopo

- Importação de fotos/mídias pela planilha.
- Agendamento/importação recorrente automática.
