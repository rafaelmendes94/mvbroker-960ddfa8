## Objetivo

No cadastro de **Clientes** (imobiliárias e corretores autônomos), criar automaticamente uma conta de acesso para o cliente, com duas opções:
1. **Gerar senha automática** — sistema cria uma senha forte e mostra na tela para copiar/enviar.
2. **Enviar convite por email** — cliente recebe link para definir a própria senha.

E no **Perfil** do usuário logado, adicionar a opção de **alterar a própria senha**.

---

## 1. Cadastro de Clientes (`/clientes`)

No diálogo "Novo cliente", adicionar bloco **Acesso ao sistema**:

- Radio:
  - `Gerar senha agora` (default) — gera senha aleatória de 12 caracteres.
  - `Enviar convite por email` — dispara email de definição de senha.
- Email é obrigatório para ambos os modos.
- Após criar com sucesso:
  - Modo "gerar senha": mostra dialog com email + senha, botão **Copiar credenciais** e aviso "Anote agora — não será exibida novamente".
  - Modo "convite": toast "Convite enviado para `email`".

### Vínculo do usuário criado
- Imobiliária → `imobiliarias.owner_id = novo user_id` + role `imobiliaria` em `user_roles`.
- Corretor autônomo → `corretores.user_id = novo user_id` + role `corretor_autonomo`.
- Se o email já existe em `auth.users`, reaproveitar o user_id existente em vez de duplicar; mostrar aviso "Conta já existia, vinculada ao cliente".

---

## 2. Perfil (`/perfil`) — Alterar senha

Adicionar card **Segurança** com:
- Campos: nova senha, confirmar nova senha.
- Validação: mínimo 8 caracteres, igual no confirmar.
- Botão **Atualizar senha** → `supabase.auth.updateUser({ password })`.
- Toast de sucesso / erro.

---

## Detalhes técnicos

**Server function** `src/lib/clientes-auth.functions.ts` com `requireSupabaseAuth`:
- `criarAcessoCliente({ email, modo: 'senha' | 'convite', nome })`
- Verifica caller via `has_role(super_admin)` OR `has_role(secretaria)`; caso contrário, 403.
- Carrega `supabaseAdmin` dentro do handler (`await import('@/integrations/supabase/client.server')`).
- Procura usuário existente: `supabaseAdmin.auth.admin.listUsers` filtrando por email.
- Se não existe:
  - Modo `senha`: `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` — retorna `{ user_id, senha }`.
  - Modo `convite`: `auth.admin.inviteUserByEmail(email, { redirectTo: <origin>/reset-password })` — retorna `{ user_id }`.
- Insere role apropriada em `user_roles` (`imobiliaria` ou `corretor_autonomo`) — idempotente.
- Retorna `{ user_id, senha?: string, jaExistia: boolean }`.

**Fluxo no formulário** (clientes.tsx):
1. Chama `criarAcessoCliente` antes de inserir o cliente.
2. Usa o `user_id` retornado para preencher `owner_id`/`user_id` no insert da tabela.
3. Se modo `senha`, abre o segundo diálogo com as credenciais.

**Rota `/reset-password`** — verificar se já existe; se não, criar página pública que detecta `type=recovery|invite` no hash e chama `supabase.auth.updateUser({ password })`. Isso garante que o link do convite funciona.

**Perfil** — componente novo `<AlterarSenhaCard />` em `src/components/perfil/AlterarSenhaCard.tsx`, importado em `perfil.tsx`.

**Sem migrações de banco** — apenas `user_roles` (já existe) recebe insert via service role.

---

## Fora de escopo

- Reenviar convite a partir da lista de clientes (pode ser adicionado depois).
- Desativar/excluir conta auth quando cliente é removido.
- 2FA / política de complexidade adicional além do HIBP já existente.
