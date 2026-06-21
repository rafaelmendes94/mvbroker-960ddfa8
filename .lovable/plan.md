## Objetivo
No popover da célula da unidade no espelho, substituir o card grande do imóvel por um **mini-card** apenas com atalho para o cadastro, e remover o botão "Vincular imóvel cadastrado" (a vinculação já é feita pelo formulário do imóvel).

## Mudanças

**Arquivo:** `src/components/empreendimentos/EspelhoSheet.tsx` (função `LinkedImovelSection`, ~linhas 883–1000)

1. **Quando há imóvel vinculado** (`linked`): trocar o bloco atual (foto grande, preço, dorm/banh/vagas/área, botões Abrir/Cadastro/Desvincular) por um mini-card horizontal compacto:
   - Thumbnail pequena (40×40) à esquerda
   - `Un. {unidade} • {titulo}` + código (linha menor)
   - Botão único "Abrir cadastro" (link para `/imoveis/$id/editar`) ocupando a célula clicável inteira
   - Ícone de desvincular (`Link2Off`) só para admin, discreto à direita
   - Sem preço/dorm/banh/área (são vistos no cadastro)

2. **Quando NÃO há imóvel vinculado**: remover totalmente o `Popover` de "Vincular imóvel cadastrado" (linhas 943–~1000). Em vez disso, mostrar apenas um texto pequeno:
   `"Sem imóvel cadastrado — cadastre pelo menu Imóveis."`

3. Limpar imports/estados que ficarem sem uso: `pickerOpen`, `q`, `searching`, `list`, `vincular`, `Popover/PopoverTrigger/PopoverContent`, `Search`, `Link2`, `Input`. Manter `Link2Off`, `Eye` removível, `ImovelDrawer` removível (não usaremos mais o "Abrir" interno).

## Sem mudanças
- Sem alteração de banco, triggers ou `ImovelForm`.
- Lógica de busca/leitura do imóvel vinculado (`useEffect` em `unit.imovel_id`) permanece.
