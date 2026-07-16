## Escopo

Aplicar modo "só leitura" na tela de Imóveis (`src/pages/Properties.tsx`) para todos os usuários que **não são** `super_admin` nem `secretaria`. Sem migração de banco — as políticas RLS de escrita já bloqueiam servidor-side, isso só remove a UI.

## Regra central

No topo do componente `Properties`:

```ts
const isAdmin = isSuperAdmin || isAdminStaff;
```

Todo o resto deriva daí.

## Ocultar na barra superior (quando `!isAdmin`)

- Botão **"Exportar XML"** (dropdown de portais)
- Botão **"Importações"** (abre `setImportOpen`)
- Botão **"Novo Imóvel"** + contador de limite
- Mantém: Relatórios, busca, filtros, favoritar, rota, baixar fotos/Drive, WhatsApp, PDF, visualizar detalhe

## Cards e linhas de imóvel

Passar `canManage={isAdmin}` (removendo o fallback `property.userId === user?.id`) para `PropertyCard` e `PropertyRow` — hoje o dono do imóvel conseguia editar/excluir mesmo sem ser admin; isso passa a exigir admin.

Dentro de `PropertyCard` e `PropertyRow`, envolver em `canManage &&` os elementos que hoje ficam visíveis para qualquer um:

- **StatusBar** (botões Disponível / Vendido / Reservado / Alugado / Suspenso) — quando não-admin, renderiza apenas um `Badge` estático com o status atual, sem trocar.
- **Duplicar** (ícone `Copy` na coluna de ações da PropertyRow — hoje sem `canManage`).
- **Alterar preço inline** (`onPriceChange` / `PriceEditor`), **DealLabel**, **QuickUpdate**, **Contrato**, **Avaliação** — qualquer controle de escrita in-card.

Editar e Excluir já estão gated por `canManage`, então automaticamente somem.

## Ações em massa

Se houver seleção múltipla com ações (excluir em lote / mudar status), esconder o toolbar quando `!isAdmin`.

## Fora de escopo

- Dashboard (`src/routes/_authenticated/dashboard.tsx`) não tem esses botões hoje — nada a fazer lá.
- Rotas `/imoveis/novo` e `/imoveis/$id/editar` continuam existindo; o backend (RLS) já bloqueia gravação de não-admin. Não vou adicionar guard de rota para evitar quebrar corretor autônomo que legitimamente edita o próprio imóvel via outros fluxos — só removo os pontos de entrada da tela de Imóveis conforme pedido.
- Sem novo papel `cliente` no enum — a restrição vale para qualquer não-admin (corretor_autonomo, imobiliaria, e qualquer outro).

## Arquivos afetados

- `src/pages/Properties.tsx` (único)
