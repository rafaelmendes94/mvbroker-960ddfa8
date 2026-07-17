## Objetivo
Cada usuário monta o próprio XML escolhendo quais imóveis exportar na tela de listagem. O link/URL do XML é exclusivo dele — nunca mistura com o de outros usuários.

## Base
O sistema já tem `carteiras` + rota pública `/api/public/feed/{slug}.xml` (uma por carteira, com `carteira_imoveis` guardando os IDs escolhidos). Vou reutilizar essa base em vez de criar tabela nova — assim aproveita RLS, logs de leitura, portais etc. que já existem.

## Mudanças

### 1. Carteira pessoal "Meu XML" por usuário
- Ao entrar na tela de Imóveis, garantir (server fn) que o usuário logado tenha uma carteira própria com `slug` único (`meu-xml-{userId curto}`), criada sob demanda se não existir. Ninguém mais tem acesso — RLS já isola por `usuario_id`.

### 2. Modo seleção na listagem `src/pages/Properties.tsx`
- Botão "Selecionar para XML" ativa modo de seleção.
- Checkbox em cada card + barra fixa no rodapé mostrando quantos selecionados, com ações:
  - **Adicionar ao meu XML** / **Remover do meu XML** (usa `addCarteiraItems` / `removeCarteiraItems` da carteira pessoal).
  - **Selecionar todos filtrados** / **Limpar seleção**.
- Cards mostram um selo discreto "no meu XML" quando já incluídos.

### 3. Painel "Meu XML" (drawer/modal aberto por botão no topo da lista)
- Mostra:
  - URL pública: `${origin}/api/public/feed/{slug}.xml` — botão copiar e abrir.
  - Botão **Baixar XML** (usa `DownloadXmlButton` existente).
  - Contagem de imóveis inclusos + lista rápida com remover.
- Disponível para todos os papéis (admin e cliente) — cada um vê o seu.

### 4. Ajustes de acesso
- Feed `/api/public/feed/$slug.ts` já é público por slug — nada a mudar lá.
- Remover exposição do "Feed Geral" (`geral.$id`) da UI do cliente para não confundir com o feed pessoal (endpoint continua no ar para quem já usa).

### Detalhes técnicos
- Novo server fn `ensureMinhaCarteiraXml()` em `src/lib/carteiras.functions.ts` (middleware `requireSupabaseAuth`): faz upsert de carteira `tipo='pessoal'`, `visibilidade='privada'`, `slug` derivado do user id, retorna `{ id, slug }`.
- Reaproveitar `addCarteiraItems` / `removeCarteiraItems` / `listCarteiraItems` já existentes.
- Feed já respeita `exportacao_liberada` via `tg_exportacao_check_liberada` — mantém.

## Fora do escopo
- Não altero schema (nenhuma migration).
- Não mexo em portais nem no Feed Geral.
- Não altero a página `/carteiras` — o "Meu XML" é atalho direto na listagem de imóveis.
