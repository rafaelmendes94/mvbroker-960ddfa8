# Corrigir "cliente criado no admin sem plano vinculado"

## O que foi verificado agora

- O cadastro de cliente no painel admin é feito em **3 passos separados no navegador**, sem transação:
  1. cria o acesso (usuário + papel) no servidor;
  2. insere a imobiliária **ou** o corretor;
  3. insere a assinatura com o plano.
  Se qualquer passo depois do 1 falhar (ou a pessoa fechar a tela), sobra um cliente **sem assinatura** — exatamente o sintoma relatado.
- No banco atual já existe um estado inconsistente desse tipo: há uma assinatura ligada a um usuário sem nenhum registro correspondente na tabela de corretores.
- As permissões de banco (grants e regras de acesso) das tabelas de assinaturas/planos/corretores/imobiliárias estão corretas, e a função que o app usa para ler "minha assinatura" está acessível. Ou seja, **não é falta de permissão**.
- A busca por e-mail já existente na criação do acesso só olha os **200 primeiros usuários**. Numa base maior (caso da VPS), um e-mail existente pode não ser encontrado, o cadastro falha no meio e o plano nunca é gravado.

Observação honesta: não tenho acesso ao banco da VPS, então a causa exata daquele caso específico não está confirmada. O plano abaixo elimina as causas possíveis e ainda inclui uma tela para detectar/corrigir clientes já órfãos.

## O que será feito

### 1. Tornar o cadastro atômico (uma única operação no servidor)
Mover todo o fluxo (acesso + cliente + assinatura) para uma única função de servidor. Se qualquer etapa falhar, as anteriores são desfeitas e nada fica pela metade. O navegador passa a fazer uma chamada só.

### 2. Corrigir a busca de usuário por e-mail
Trocar a listagem paginada limitada por uma busca direta por e-mail (varredura completa paginada como fallback), para não falhar em bases grandes.

### 3. Papel do usuário coerente
Ao criar um cliente do tipo imobiliária, remover o papel padrão "corretor autônomo" atribuído automaticamente no cadastro, deixando apenas o papel correto.

### 4. Diagnóstico e reparo na tela de Clientes
- Marcar visualmente na lista os clientes **sem plano** e os corretores **sem login vinculado**.
- Botão "Vincular plano" já existente passa a funcionar também para reparar esses casos, criando a assinatura faltante.
- Adicionar aviso quando o cliente tem assinatura mas ela não é encontrada pelo vínculo esperado (assinatura órfã).

### 5. Verificação após login
Garantir que a leitura de "minha assinatura" cubra também o corretor vinculado à imobiliária e que a tela de bloqueio informe claramente "nenhum plano vinculado — contate o administrador", em vez de apenas bloquear.

## Detalhes técnicos

- Nova função `criarClienteCompleto` em `src/lib/clientes-admin.functions.ts` (`createServerFn`, autorização super_admin/secretaria via token, cliente admin carregado dentro do handler).
- Rollback manual em caso de erro: apagar imobiliária/corretor criado no passo anterior e, quando o usuário foi criado nessa chamada, remover o usuário de auth.
- Substituir `listUsers({page:1, perPage:200})` em `src/lib/clientes-auth.functions.ts` por `listUsers` paginado até encontrar (ou consulta por e-mail).
- `src/routes/_authenticated/clientes.tsx`: chamar a nova função única; badges "Sem plano" / "Sem login"; manter troca de plano atual.
- Se necessário, ajustar `get_minha_assinatura` via migração para também considerar corretores vinculados a imobiliária com assinatura ativa (já contemplado hoje — só será alterado se a revisão mostrar lacuna).
