## Objetivo
Permitir que clientes (não-admin) visualizem Condomínios, Edifícios e Loteamentos normalmente — só sem ações de escrita (criar, editar, excluir, importar).

## Mudanças

**1. `src/routes/_authenticated/condominios.tsx`, `edificios.tsx`, `loteamentos.tsx`**
- Remover o `<RoleGate allow={["super_admin", "secretaria"]}>` — a página passa a ser aberta a todos os autenticados.

**2. `src/components/estruturas/EstruturaPage.tsx`**
- Adicionar `const { isAdmin } = useRoles()` (super_admin ou secretaria).
- Envolver com `{isAdmin && ...}`:
  - Botões do header: **Baixar modelo**, **Importar Excel**, **Novo {singular}** (linhas ~433-441).
  - Ícones **Editar** e **Excluir** em cada card (grid) e linha (list) — linhas 546-550 e 637-638.
- Manter visíveis para todos: busca, toggle Lista/Blocos, botões **Material completo**, **Mapa**, **Localização**, link para o empreendimento (espelho / detalhes).
- O modal de cadastro/edição continua existindo, mas fica inacessível sem os botões (sem risco extra).

**3. Verificação**
- Confirmar que a página `/empreendimentos/$id` (espelho) e `/imovel/$id` já estão liberadas pra cliente — já estão (sem RoleGate).

Sem mudanças de RLS: as políticas de leitura para `edificios/condominios/loteamentos` já permitem `authenticated`; só a UI estava bloqueando.
