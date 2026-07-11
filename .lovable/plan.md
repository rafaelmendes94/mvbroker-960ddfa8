## Problema

Hoje o formulário e o banco assumem uma nomenclatura fixa por tipo de vínculo:
- Edifício/Condomínio → obriga **Unidade** (e o picker esconde Quadra/Lote, sobrescrevendo o que o usuário digitou)
- Loteamento → obriga **Lote**

Isso quebra casos reais: condomínios horizontais usam Quadra/Lote, alguns loteamentos usam Unidade, etc. O usuário digita Quadra/Lote, salva, recebe o erro "Informe a Unidade…" e o form volta mostrando só Unidade/Bloco.

## Objetivo

Deixar Quadra, Lote e Unidade **sempre disponíveis** em qualquer vínculo. O sistema identifica sozinho qual identificador foi preenchido e usa esse para vincular ao espelho.

## Mudanças

### 1) `src/components/imoveis/ImovelForm.tsx`
- Trocar o bloco condicional (linhas 588–622) por **um único layout fixo** com os três campos (Unidade, Quadra, Lote) sempre visíveis, independente do vínculo.
- Manter o `EspelhoUnitPicker` como **complemento**: quando houver vínculo (edifício/condomínio/loteamento), mostrar acima dos inputs um seletor opcional "Escolher do espelho" que, ao selecionar, preenche o campo correto (Unidade para edifício/condomínio, Lote+Quadra para loteamento) — sem apagar os outros campos.
- Validação em `save()` (linhas 453–460): substituir por regra flexível — se houver qualquer vínculo, exigir que **pelo menos um** entre `unidade` ou `lote` esteja preenchido. Mensagem: "Informe Unidade ou Quadra/Lote para vincular ao espelho."

### 2) Migration nova para `fn_espelho_sync_imovel`
Ajustar a função para resolver o identificador de forma flexível:
- Para qualquer tipo de vínculo, `v_numero := COALESCE(NULLIF(trim(NEW.unidade),''), NULLIF(trim(NEW.lote),''))`.
- Se `unidade` estiver vazio mas `quadra`+`lote` preenchidos, usar formato `"Qd X - Lt Y"` como número no espelho (mesmo padrão do `formatUnitParts`).
- Trigger `trg_imoveis_espelho_sync_upd` passa a observar também mudanças em `lote` para edifício/condomínio (já observa `quadra`).

### 3) Sem mudança de schema
Colunas `unidade`, `quadra`, `lote`, `box` já existem em `imoveis` e a coluna `numero` do espelho é `text` — comporta ambos os formatos.

## Resultado

- Usuário cadastra Quadra 5 + Lote 12 em um condomínio → salva sem erro, espelho recebe unidade "Qd 5 - Lt 12".
- Usuário cadastra Unidade 302 em um loteamento → salva sem erro, espelho recebe unidade "302".
- Os três campos permanecem visíveis ao reabrir o cadastro (nada de mudar de "Quadra/Lote" para "Bloco/Unidade").