## Objetivo

No topo da tela **Novo Imóvel** adicionar um botão **"✨ Cadastrar por IA"**. Ao clicar, abre um modal onde o usuário cola uma descrição livre (WhatsApp, texto do proprietário, etc.). A IA analisa, extrai os campos e volta para a tela do formulário já preenchida — o usuário só revisa e clica em Salvar.

## Mudanças

### 1) Nova server function `src/lib/imovel-ia-extract.functions.ts`
- `extrairImovelDeTexto` (POST, `requireSupabaseAuth`).
- Input: `{ texto: string }`.
- Usa a mesma chave Gemini já configurada em `imovel-ia.functions.ts` (DB `integration_settings.gemini_api_key` com fallback `GEMINI_API_KEY`).
- Chama Gemini `gemini-2.5-flash` com prompt system em pt-BR: "Extraia os campos do imóvel a partir do texto livre. Retorne SOMENTE JSON válido com este schema; use `null` quando o campo não aparecer no texto. Nunca invente."
- Schema retornado (subset do `FormState` — só campos que se costuma inferir de descrição livre):
  - `titulo`, `tipo_imovel`, `descricao` (texto limpo/reformatado)
  - Localização: `cep`, `logradouro`, `numero`, `bairro`, `cidade`, `estado`
  - Identificação: `unidade`, `box`, `quadra`, `lote`
  - Valores: `preco` (number), `comissao_percentual` (number), `bonus`, `condicoes_pagamento` (array)
  - Proprietários: `responsavel_nome`, `responsavel_telefone` (primeiro contato)
  - Chaves/acesso: `local_chaves` (ex: "Tag Lux Group central/sepe, senha 1745")
  - Contagens: `dormitorios`, `suites`, `banheiros`, `lavabo`, `vagas`, `elevadores`
  - Áreas: `area_privativa`, `area_total` (numbers)
  - Booleans/enums: `vista_mar`, `decorado`, `aceita_permuta`, `condicao`, `posicao_solar`, `vista`, `padrao`
  - `infraestrutura` (array de strings livre — piscina, elevador, hall decorado, beira mar, etc.)
- Faz `JSON.parse` defensivo (strip de crases/```json), valida com Zod, devolve `{ campos: Partial<FormState> }`. Nunca lança por campo faltando — só devolve o que achou.

### 2) Novo componente `src/components/imoveis/CadastroIAModal.tsx`
- Props: `open`, `onClose`, `onExtracted(campos: Partial<FormState>)`.
- Layout: `Dialog` com `Textarea` grande (rows 12), placeholder mostrando exemplo curto ("Cole aqui a descrição do imóvel — WhatsApp, e-mail, ficha do proprietário…"), botão **"Analisar com IA"** e botão Cancelar.
- Ao clicar Analisar: `useServerFn(extrairImovelDeTexto)` com loading (`Loader2` + "Analisando descrição..."). Em sucesso: `onExtracted(campos)` e fecha. Em erro: toast.
- Sem outros campos — a IA cuida de tudo.

### 3) `src/components/imoveis/ImovelForm.tsx`
- Adicionar estado `iaModalOpen: boolean` (só disponível em modo "novo", esconder quando `isEdit`).
- Novo botão no topo do formulário (ao lado do título da página, dentro do próprio form): **"✨ Cadastrar por IA"** (`variant="outline"`, ícone `Wand2` já importado).
- Handler `handleIAExtracted(campos)`:
  - `setForm(prev => ({ ...prev, ...cleanCampos }))` — merge só das chaves não-nulas.
  - Normalizações: números viram string onde `FormState` guarda string (`preco`, `area_*`, `comissao_percentual`); arrays substituem; booleans só se vierem `true`.
  - Se `infraestrutura` vier com nomes livres, casar com `infraOpts` por match case-insensitive; itens não encontrados vão para `outras_caracteristicas`.
  - Toast "Dados preenchidos pela IA. Revise antes de salvar."
- Renderizar `<CadastroIAModal>` uma vez, controlado por `iaModalOpen`.
- **Não** salva sozinho — usuário confere e clica em Salvar (fluxo atual).

### Resultado
Fluxo do usuário no exemplo do Rio Tevere 303: abre "Novo Imóvel" → clica "Cadastrar por IA" → cola o texto do WhatsApp → clica Analisar → modal fecha e o formulário aparece preenchido (título, 2 dorm/1 suíte, 75,05 m² priv / 109,50 m² total, 1 vaga, vista mar, mobiliado/decorado, Capão da Canoa/Zona Nova/Av. Beira Mar 1301, R$ 1.250.000, comissão 4%, proprietários Júlio/Ramon/Eduardo com telefones no campo responsável, local das chaves com tag e senha, infraestrutura piscina/elevador/hall decorado/beira mar, descrição reformatada). O usuário revisa, ajusta o que faltar e salva normalmente.
