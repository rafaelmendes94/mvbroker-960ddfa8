
## Objetivo

Substituir a página **Clientes** (hoje com dados mock) por um cadastro real onde o admin/secretaria escolhe o **tipo de cliente** (Imobiliária ou Corretor), vincula um **plano** e, no caso de imobiliária, o plano impõe um **limite de corretores** que ela pode cadastrar.

## O que muda

### 1. Página `/clientes` (reescrita)

- Lista unificada com clientes dos dois tipos:
  - **Imobiliárias** (vindas de `imobiliarias`) + plano atual (via `assinaturas`).
  - **Corretores autônomos** (vindos de `corretores` sem `imobiliaria_id`) + plano atual.
- Cada card/linha mostra: nome, tipo (badge "Imobiliária" / "Corretor"), plano vigente, status da assinatura, e — para imobiliária — `corretores ativos / limite do plano` (ex.: `4 / 10`).
- Busca por nome/e-mail e filtro por tipo (Todos / Imobiliária / Corretor).
- Ações por cliente: **Editar**, **Trocar plano**, **Bloquear/Reativar**.

### 2. Diálogo "Novo cliente"

Campos:
- **Tipo de cliente** (radio): `Imobiliária` ou `Corretor autônomo`.
- Campos comuns: nome, e-mail, telefone/WhatsApp.
- Se Imobiliária: nome fantasia, razão social, CNPJ.
- Se Corretor: CRECI.
- **Plano**: select filtrando `planos.tipo = 'imobiliaria'` ou `'individual'` conforme o tipo escolhido (somente planos `ativo = true`).
- **Ciclo**: mensal / anual (define o valor da assinatura a partir de `preco_mensal` / `preco_anual`).

Ao salvar:
- Insere em `imobiliarias` **ou** em `corretores` (sem `imobiliaria_id`, autônomo).
- Insere a assinatura em `assinaturas` vinculada via `imobiliaria_id` ou `usuario_id` conforme o caso, com `status = 'ativa'`.

### 3. Limite de corretores por plano de imobiliária

- O campo `planos.limite_usuarios` (já existente) passa a ser tratado como **"Limite de corretores"** para planos do tipo `imobiliaria`. Vazio = ilimitado.
- No formulário de Planos (`/planos`), renomeio visualmente o label para "Limite de corretores" quando `tipo = imobiliaria` e mantenho "Limite de usuários" para `individual`.
- **Enforcement**:
  - Função no banco `public.imobiliaria_limite_corretores(imob_id uuid)` retorna `(usados int, limite int|null)` consultando `corretores` ativos da imobiliária e o `limite_usuarios` do plano da assinatura ativa.
  - Trigger `BEFORE INSERT` em `public.corretores`: quando `imobiliaria_id` não é nulo, se `usados >= limite`, levanta exceção com mensagem clara ("Plano atingiu o limite de N corretores").
  - Frontend: na página `/corretores` e na página `/clientes` (ao abrir uma imobiliária para gerenciar corretores), mostro um badge `usados / limite` e desabilito o botão "Novo corretor" quando o limite for atingido, com tooltip explicativo. O bloqueio do banco é a garantia final.

### 4. Trocar plano de um cliente existente

- Diálogo "Trocar plano" reaproveita a lógica de criação de assinatura, atualizando a linha em `assinaturas` (há um índice único por imobiliária / usuário, então é update).
- Aviso visual quando o novo plano tem `limite_usuarios` menor que o número atual de corretores da imobiliária (não bloqueia a troca, apenas avisa que novos cadastros ficarão travados até regularizar).

## Permissões

- Página `/clientes` continua restrita a `super_admin` e `secretaria` (já é o padrão para gestão comercial; ajusto em `permissions.ts` se necessário).
- Todas as operações (insert imobiliária, insert corretor, insert/update assinatura) respeitam as RLS já existentes — admin/secretaria têm acesso total via `has_role()`.

## Fora de escopo (não faço agora)

- Cobrança/integração de pagamento — segue manual via `/assinaturas`.
- Convite de login para o cliente recém-criado (criação do usuário em `auth.users` por e-mail). Posso fazer numa etapa seguinte se desejar.
- Histórico de trocas de plano.

## Detalhes técnicos

- **Migração SQL**:
  ```sql
  -- função utilitária
  CREATE OR REPLACE FUNCTION public.imobiliaria_limite_corretores(p_imob uuid)
  RETURNS TABLE(usados int, limite int)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT
      (SELECT COUNT(*)::int FROM corretores
        WHERE imobiliaria_id = p_imob AND status = 'ativo'),
      (SELECT p.limite_usuarios FROM assinaturas a
        JOIN planos p ON p.id = a.plano_id
        WHERE a.imobiliaria_id = p_imob AND a.status = 'ativa'
        LIMIT 1);
  $$;

  -- trigger de enforcement
  CREATE OR REPLACE FUNCTION public.tg_corretores_check_limite()
  RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE v_used int; v_max int;
  BEGIN
    IF NEW.imobiliaria_id IS NULL THEN RETURN NEW; END IF;
    SELECT usados, limite INTO v_used, v_max
      FROM public.imobiliaria_limite_corretores(NEW.imobiliaria_id);
    IF v_max IS NOT NULL AND v_used >= v_max THEN
      RAISE EXCEPTION 'O plano da imobiliária atingiu o limite de % corretores.', v_max;
    END IF;
    RETURN NEW;
  END $$;

  CREATE TRIGGER trg_corretores_check_limite
    BEFORE INSERT ON public.corretores
    FOR EACH ROW EXECUTE FUNCTION public.tg_corretores_check_limite();
  ```
- **Frontend**:
  - Reescrever `src/routes/_authenticated/clientes.tsx` com lista real, filtros, diálogo de criação e diálogo de troca de plano.
  - Ajustar `src/routes/_authenticated/planos.tsx` para renomear o label do limite conforme `tipo`.
  - Adicionar badge `usados/limite` em `src/routes/_authenticated/corretores.tsx` e desabilitar o botão "Novo corretor" quando atingido.

## Arquivos afetados

- `src/routes/_authenticated/clientes.tsx` (reescrita).
- `src/routes/_authenticated/planos.tsx` (label do limite por tipo).
- `src/routes/_authenticated/corretores.tsx` (badge + bloqueio do botão).
- Nova migração Supabase com a função e o trigger acima.
