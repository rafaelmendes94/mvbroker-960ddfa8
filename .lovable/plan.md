## Objetivo

Adicionar à tela `/usuarios` (acesso restrito a super_admin) um módulo que:
1. Lista todos os papéis (built-in + customizados) e permite editar o que cada um vê/cria/edita/exclui por módulo.
2. Permite ao super_admin criar/renomear/excluir papéis customizados.
3. Mantém a tela atual de usuários, mas a permissão efetiva passa a ser: **padrão do papel ∪ override por usuário**.

## Limitações já alinhadas

- Papéis customizados controlam apenas UI/módulos. RLS do banco continua usando o enum `app_role` existente (super_admin, secretaria, imobiliaria, corretores) — não muda.
- Papéis built-in (enum) aparecem como "do sistema" e não podem ser excluídos/renomeados, só ter suas permissões padrão editadas.

## Estrutura de UI

Em `/usuarios`, adicionar `Tabs` no topo:
- **Usuários** (tela atual, intacta)
- **Papéis & Permissões** (novo)

Aba nova mostra:
- Lista de papéis à esquerda (built-in + customizados, badge "Sistema" nos built-in).
- Botão "+ Novo papel" (abre dialog: nome, slug, descrição).
- Painel à direita: tabela de módulos agrupados (reusa `MODULOS` + grupos do `EditUserSheet`) com checkboxes Ver/Criar/Editar/Excluir/Tudo.
- Botão Salvar; papel customizado tem ação "Excluir papel".

Na aba **Usuários** existente:
- O seletor de papéis ganha os papéis customizados (além de super_admin/secretaria).
- Texto explicativo: "permissões = padrão do papel + ajustes deste usuário".

## Backend (migração)

Novas tabelas (RLS: tudo gated por `has_role(auth.uid(),'super_admin')`):

1. `public.custom_roles`
   - `slug text PK` (ex.: `gerente_vendas`), `nome text`, `descricao text`, `created_at`, `updated_at`.
2. `public.role_module_permissions`
   - `id uuid PK`
   - `role_slug text` — guarda enum value OU custom_roles.slug (texto livre para suportar ambos)
   - `modulo text`
   - `pode_ver/criar/editar/excluir boolean`
   - UNIQUE(`role_slug`,`modulo`)
3. `public.user_custom_roles`
   - `id uuid PK`, `user_id uuid`, `role_slug text` referenciando `custom_roles.slug`
   - UNIQUE(`user_id`,`role_slug`)

GRANTs padrão (`authenticated` + `service_role`), RLS ativada, policies via `has_role('super_admin')` para escrita; SELECT permitido para o próprio usuário em `user_custom_roles` e `role_module_permissions` (para o frontend calcular permissão efetiva).

Função SQL `public.get_minhas_permissoes_efetivas()` que retorna por módulo o OR entre:
- `role_module_permissions` dos papéis do usuário (enum + custom)
- `user_module_permissions` (override do usuário)

A função `get_minhas_permissoes_modulo()` existente fica para compatibilidade.

## Server functions novas (`src/lib/papeis-admin.functions.ts`)

Todas com `requireSupabaseAuth` + checagem `has_role(super_admin)`:
- `listarPapeis()` → built-in (do enum) + custom_roles, com flag `sistema`.
- `criarPapel({slug,nome,descricao})`
- `renomearPapel({slug,nome,descricao})`
- `excluirPapel({slug})` — bloqueia se houver usuários atribuídos.
- `listarPermissoesPapel({role_slug})`
- `salvarPermissoesPapel({role_slug, permissoes[]})`
- Ajustar `atualizarRolesUsuario` para aceitar slugs customizados (grava em `user_custom_roles`) além do enum (que continua em `user_roles`).

## Arquivos

- **Migração**: novas tabelas + função + policies + grants.
- **Novo**: `src/lib/papeis-admin.functions.ts`.
- **Novo**: `src/components/usuarios/PapeisPermissoesTab.tsx` (lista + editor + dialog novo papel).
- **Editar**: `src/routes/_authenticated/usuarios.tsx` — envolve conteúdo atual em `Tabs` (Usuários / Papéis). Ajusta `ROLE_OPTIONS` para puxar dinâmico de `listarPapeis`.
- **Editar**: `src/lib/usuarios-admin.functions.ts` — `atualizarRolesUsuario` aceita slugs custom.
- Opcional: `src/hooks/useMinhasPermissoes.ts` passa a usar `get_minhas_permissoes_efetivas` (se já existir hook similar; senão fica para próximo passo).

## Fora de escopo

- Aplicar RLS por papel customizado em outras tabelas (carteiras, imoveis etc.) — papéis novos só controlam visibilidade de módulos na UI.
- Reescrita do gating existente que usa `has_role('secretaria'|'super_admin')` em código — continua igual.
