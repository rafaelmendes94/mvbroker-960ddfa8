## Objetivo

No formulário de imóvel, no bloco "Vincular a Edifício / Condomínio / Loteamento", adicionar em cada um dos três selects (Edifício, Condomínio, Loteamento) um botão fixo no final da lista: **"+ Criar novo …"**. Ao clicar, abre um modal para cadastro rápido, sem sair da tela. Após salvar, o item é inserido no banco, adicionado à lista do select e já selecionado automaticamente.

## Mudanças

### 1) `src/components/imoveis/EntitySelector.tsx`
- No dropdown (bloco após `filtered.map(...)`), acrescentar um item fixo **sempre visível** no final: `+ Criar novo {label}`.
- Ao clicar, chama um callback novo `onCreateNew()` recebido por props (opcional). Se `search` estiver preenchido, envia como nome inicial (`onCreateNew(search)`).
- Expor uma função `refresh()` via `useImperativeHandle` (ou aceitar prop `reloadKey`) para o pai forçar recarregar `options` depois de criar. Abordagem escolhida: **prop `reloadKey: number`** — quando muda, o `useEffect` roda novamente e busca a lista atualizada. Simples e suficiente.
- Nenhuma outra mudança de layout/estilo.

### 2) Novo componente `src/components/imoveis/QuickCreateEntityModal.tsx`
Modal enxuto reutilizável para os três tipos:
- Props: `open`, `onClose`, `table: "edificios" | "condominios" | "loteamentos"`, `initialName?: string`, `onCreated(entity)`.
- Campos mínimos: **Nome** (obrigatório), **Cidade**, **Estado** (UF). Os demais dados (endereço completo, infraestrutura, imagens) ficam para editar depois na tela da estrutura — mesma filosofia do "cadastro rápido".
- Ao salvar: `supabase.from(table).insert({ nome, cidade, estado, ativo: true }).select().single()`, então `onCreated(data)` e fecha.
- Título dinâmico: `Novo Edifício` / `Novo Condomínio` / `Novo Loteamento` a partir de um mapa de labels.
- Usa os componentes shadcn `Dialog`, `Input`, `Label`, `Button` (mesmo padrão do resto do projeto).

### 3) `src/components/imoveis/ImovelForm.tsx`
No bloco "Vincular a Edifício / Condomínio / Loteamento" (onde os três `EntitySelector` são renderizados):
- Adicionar estado local: `quickCreate: { table, initialName } | null` e `reloadKeys: { edificios, condominios, loteamentos }`.
- Passar para cada `EntitySelector`:
  - `onCreateNew={(name) => setQuickCreate({ table: "edificios"|..., initialName: name })}`
  - `reloadKey={reloadKeys.<table>}`
- Renderizar `<QuickCreateEntityModal>` uma vez no bloco, controlado por `quickCreate`.
- No `onCreated(entity)`: incrementar `reloadKeys[table]`, chamar o `onChange`/`onSelect` correspondente já preenchendo o `form.edificio_id`/`condominio_id`/`loteamento_id` e herdando endereço/infra igual ao fluxo atual do `onSelect`, e fechar o modal.

### Resultado
Usuário abre o select de Condomínio, não encontra "Residencial X", digita o nome, clica em **"+ Criar novo Condomínio"** no rodapé da lista → modal abre com o nome pré-preenchido → informa cidade/UF → salva → modal fecha, o novo condomínio aparece selecionado no campo e disponível na lista, sem sair da tela de cadastro do imóvel. Mesmo comportamento para Edifício e Loteamento.
