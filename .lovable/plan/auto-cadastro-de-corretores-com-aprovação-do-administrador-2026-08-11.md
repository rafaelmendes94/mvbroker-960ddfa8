# Auto-cadastro de corretores com aprovação do administrador

Hoje só o administrador cria contas. A ideia é abrir o cadastro para o próprio corretor, mas com a conta em "aguardando aprovação" até o administrador aprovar e vincular um plano.

## Como vai funcionar

```text
Corretor se cadastra  ->  Conta criada, sem plano  ->  Tela "Aguardando aprovação"
                                                              |
                          Admin analisa em Usuários > Solicitações
                                                              |
                          Aprova + escolhe plano/ciclo  ->  Acesso liberado
                                                              |
                                             E-mail "sua conta foi aprovada"
```

## 1. Tela de cadastro (pública)

Nova aba "Criar conta" na tela de login (`/auth`), com os campos:
nome completo, e-mail, telefone/WhatsApp, CRECI, cidade e senha (com confirmação e o mesmo botão de mostrar senha).

- Sem confirmação de e-mail: ao concluir, o corretor já entra no sistema e vê a tela de "conta em análise".
- Validação dos campos (formato de e-mail/telefone, senha mínima, limites de tamanho) no navegador e no servidor.

## 2. Fila de aprovação

- A conta nasce com papel de corretor autônomo, status **pendente** e sem assinatura.
- Enquanto pendente, ao entrar o corretor vê apenas o painel "Conta em análise" (reaproveita o bloqueio de assinatura que já existe hoje), com o contato do comercial. Nada mais do sistema fica acessível.

## 3. Painel do administrador

Nova aba **Solicitações** dentro de Usuários, visível para super admin e secretária:

- Lista das contas pendentes com nome, e-mail, telefone, CRECI, cidade e data do pedido.
- Botão **Aprovar**: abre um diálogo para escolher plano, ciclo (mensal/anual), valor e data do primeiro vencimento; ao confirmar, cria a assinatura ativa, marca a conta como aprovada e libera o acesso.
- Botão **Recusar**: marca como recusada, com campo de motivo. O corretor passa a ver uma mensagem de recusa com o contato do comercial.
- Contador de pendências no menu para o admin não perder solicitações.

## 4. E-mail de "conta aprovada"

- Configuração do envio de e-mails com o seu domínio (abro o assistente para você informar o domínio; depois o DNS leva algumas horas para validar).
- Modelo de e-mail no visual do MV Broker: boas-vindas, confirmação da aprovação, plano contratado e botão para acessar o sistema.
- Disparo automático no momento da aprovação. Se o domínio ainda estiver validando, o e-mail fica na fila e sai assim que o DNS concluir.

## Detalhes técnicos

- Tabela nova `solicitacoes_cadastro` (user_id, nome, telefone, creci, cidade, status pendente/aprovado/recusado, motivo, aprovado_por, datas) com RLS: o próprio usuário lê a sua; super admin e secretária leem/atualizam todas. GRANTs para `authenticated` e `service_role`.
- Server function pública `signupCorretor` (`createServerFn` + Zod): cria o usuário via Admin API com e-mail já confirmado, grava o perfil, o papel `corretor_autonomo` e a solicitação pendente. Rate limit simples por e-mail/IP.
- Server function protegida `aprovarSolicitacao` (super admin/secretária): valida papel do chamador, insere em `assinaturas` (status `ativa`), atualiza a solicitação e enfileira o e-mail.
- `useAssinatura`/`AssinaturaGate` passam a considerar o status da solicitação para exibir "em análise" ou "recusada" em vez da mensagem genérica de assinatura.
- E-mail: `setup_email_infra` + template React Email `conta-aprovada` registrado no registry, disparado pela rota de envio com chave de idempotência por solicitação.
- Cadastro por auto-serviço não concede nenhum papel administrativo — sempre `corretor_autonomo`.
