# Bloqueio de acesso apenas manual (super admin)

Hoje o acesso é bloqueado automaticamente sempre que a assinatura não está "ativa" ou "trial" (inclusive cancelada, vencida ou sem assinatura). O painel "Acesso temporariamente bloqueado" aparece sozinho, sem ação do administrador.

## O que muda

- O bloqueio passa a acontecer **somente** quando o super admin marcar a assinatura como bloqueada na aba de clientes.
- Assinatura cancelada, vencida ou sem plano **não** bloqueia mais nada — sem avisos, sem painel de regularização.
- Nada de aviso de prazo/vencimento; a data de vencimento continua só como informação na tabela.
- Na tela de clientes (super admin), o botão Bloquear/Reativar continua sendo a única forma de bloquear, com confirmação e feedback claro do estado atual (badge "bloqueada").

## Detalhes técnicos

- `src/hooks/use-assinatura.ts`: `bloqueado` passa a ser `!isAdmin && data?.status === "bloqueada"`.
- `src/components/AssinaturaGate.tsx`: mantém o painel de regularização apenas para o caso bloqueado manualmente; segue liberando quem tem solicitação de cadastro ainda pendente pelo fluxo atual.
- `src/routes/_authenticated/clientes.tsx`: manter o botão Bloquear/Reativar (adicionar confirmação antes de bloquear) e destacar o status "bloqueada" no badge.
- Sem mudanças de banco de dados.
