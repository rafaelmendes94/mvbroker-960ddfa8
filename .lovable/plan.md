## 1. Header mobile de `/imoveis` quebrado

Em `src/pages/Properties.tsx` (~L998-1060) a linha do título + botões (Relatórios / XML / Importações / Novo) usa `flex items-center justify-between` com `flex-wrap flex-shrink-0`. Em 390px os botões estouram para fora da tela.

Ajustes:
- Trocar o wrapper por `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`.
- Container dos botões: `flex flex-wrap gap-2 w-full sm:w-auto` (remover `flex-shrink-0`).
- Botões: reduzir padding no mobile (`px-2 py-1.5 text-[11px] sm:px-3 sm:text-xs`) e esconder rótulos longos em telas pequenas (`<span className="hidden sm:inline">Relatórios</span>`, idem "Importações"), mantendo o ícone.
- Título: `text-base sm:text-xl` e `min-w-0 truncate` para não competir por largura.
- Dropdown XML: adicionar `max-w-[calc(100vw-2rem)]` para não sair da tela.

## 2. Botão "Voltar" em todas as telas

Já existem `BackButton` (`src/components/BackButton.tsx`) e `useSmartBack` (`src/lib/useSmartBack.ts`) — este último faz `navigate(-1)` quando há histórico e cai no fallback caso contrário (então já "volta pra última página que o user estava").

Para não editar 60+ arquivos, injetar globalmente no shell:

- `src/components/AppLayout.tsx` passa a renderizar `<BackButton />` no topo, dentro de um wrapper `px-4 pt-3 sm:px-6`, condicional via `useRouterState({ select: s => s.location.pathname })`.
- Esconder nas rotas raiz/auth: `/`, `/dashboard`, `/login`, `/auth`, `/reset-password`, `/confianca`.
- Remover chamadas manuais `<BackButton />` já presentes em `src/pages/Properties.tsx` e `src/pages/Reports.tsx` para não duplicar.

## Arquivos a editar

- `src/pages/Properties.tsx` — reestrutura responsiva do header + remove `<BackButton />` local.
- `src/pages/Reports.tsx` — remove `<BackButton />` local.
- `src/components/AppLayout.tsx` — injeta `<BackButton />` global condicional.

## Observação

O "voltar para última página" usa `window.history.back()`. Isso cobre navegação interna. Se o usuário abriu a URL diretamente (sem histórico), cai no fallback `/` — comportamento já implementado em `useSmartBack`.
