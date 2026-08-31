# Refino visual da página do imóvel

Ajustes só de aparência na página pública `/imovel/:id`. Nenhuma mudança de dados, permissões ou comportamento.

## O que muda

**Fundo e containers**
- Fundo da página em cinza claro `#F8FAFC` (token novo no tema, sem cor fixa no componente).
- Header do topo e todos os blocos (galeria, cabeçalho do imóvel, seções) em branco puro, com borda sutil e sombra leve, para destacar do fundo.

**Faixa de ícones (quartos, suítes, banheiros, vagas, metragem)**
- Vira uma faixa de "cards" separados: cada item em um bloco arredondado com fundo claro, ícone em círculo colorido no topo, número grande em destaque e rótulo pequeno abaixo.
- Inclui **Quartos** (dormitórios), hoje ausente da faixa — ordem: Quartos, Suítes, Banheiros, Vagas, Área privativa, Área do terreno.
- Ícones mais coerentes: cama para quartos/suítes, banheira para banheiros, carro para vagas, régua/área para metragens.
- Grid responsivo: 2 colunas no celular, 3 no tablet, 6 no desktop; alinhamento e espaçamento uniformes.

**Acabamento geral**
- Cantos, bordas e sombras padronizados entre os blocos.
- Badges de identificação (Empreendimento, Apto/Unidade, Box) com contraste melhor sobre fundo branco.
- Preço com hierarquia mais forte e espaçamento respirado em relação ao endereço.

## Detalhe técnico

- `src/styles.css`: adicionar token para o fundo `#F8FAFC` (em oklch) usado apenas por esse escopo de página, mantendo o padrão de design tokens.
- `src/routes/imovel.$id.tsx`: trocar `bg-muted/30` do wrapper pelo novo token, blocos passam a `bg-card`, e reescrita do array `stats` + do bloco de renderização da faixa de ícones.
