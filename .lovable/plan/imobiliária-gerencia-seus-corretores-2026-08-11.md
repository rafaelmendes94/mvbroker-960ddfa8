# Imobiliária gerencia seus corretores

A imobiliária passa a ter uma tela própria para cadastrar, bloquear e excluir seus corretores, respeitando o limite de usuários do plano que o administrador vinculou.

## O que já existe

- Tabela `corretores` com `imobiliaria_id`, `status` e vínculo opcional com o usuário de login.
- Regra de acesso que já permite ao dono da imobiliária gerenciar apenas os corretores dela.
- Validação no banco que impede passar do limite de corretores ativos do plano da imobiliária.
- Função que informa quantos corretores estão usados e qual o limite do plano.

## Nova tela: "Meus corretores"

Rota `/meus-corretores`, visível para o perfil Imobiliária (e Super Admin).

- Cartão no topo: **X de Y corretores ativos** (Y vem do plano). Sem plano ativo, o botão de cadastrar fica desabilitado com aviso.
- Lista/tabela com nome, e-mail, CRECI, telefone, status (Ativo / Bloqueado) e último acesso.
- Botão **Novo corretor** abre um formulário com nome, e-mail, senha (gerada automaticamente ou digitada), CRECI e telefone.
  - Ao salvar: cria o login, marca e-mail como confirmado, dá o papel "Corretor da Imobiliária", cria o registro do corretor vinculado à imobiliária e mostra a senha para copiar.
  - Se o limite do plano já estiver atingido, o cadastro é recusado com mensagem clara.
  - Se o e-mail já existir no sistema, o cadastro é recusado (evita roubar usuário de outra conta).
- Ações por corretor:
  - **Bloquear / Desbloquear**: muda o status e impede/libera o login. Corretor bloqueado não conta no limite do plano.
  - **Redefinir senha**: gera nova senha e exibe para copiar.
  - **Excluir**: remove o corretor e a conta de login dele, com confirmação.

## Detalhes técnicos

Novo arquivo `src/lib/corretores-imobiliaria.functions.ts` (server functions), seguindo o padrão de `clientes-auth.functions.ts`:

- `listarMeusCorretores`, `criarCorretorImobiliaria`, `alterarStatusCorretor`, `resetarSenhaCorretor`, `excluirCorretorImobiliaria`.
- Cada função valida o token, resolve a imobiliária pelo `owner_id = auth.uid()` e só age sobre corretores daquela imobiliária. Super Admin pode informar a imobiliária explicitamente.
- Limite via RPC `imobiliaria_limite_corretores`; a trigger do banco continua como segunda barreira.
- Bloqueio de login usando o banimento de conta do Auth (bloqueia/libera) além do `status` em `corretores`.
- Cliente com chave de serviço carregado dentro do handler (`@/lib/supabase-node-safe`), nunca no escopo do módulo.

Front-end:

- Nova rota `src/routes/_authenticated/meus-corretores.tsx` protegida por `RoleGate` (`imobiliaria`, `super_admin`).
- Entrada no menu lateral (`AppSidebar`) e liberação em `ROUTE_ACCESS` de `src/lib/permissions.ts`.

Sem alteração de banco de dados: as tabelas, políticas e a validação de limite já existem.
