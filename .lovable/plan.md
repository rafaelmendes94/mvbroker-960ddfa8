## Objetivo

1. **Tirar o autocadastro**: apenas Super Admin e Secretaria criam usuários.
2. **Módulo Planos**: criar/editar planos com preços.
3. **Módulo Assinaturas**: vincular plano a imobiliária OU corretor autônomo, registrar pagamentos manualmente, liberar/bloquear.
4. **Bloqueio inadimplente**: usuário loga, mas vai para tela de regularização até liberar.

---

## Banco (1 migration)

**`planos`** — catálogo de planos
- `nome`, `descricao`, `tipo` (`individual` | `imobiliaria`), `preco_mensal`, `preco_anual`, `recursos` (jsonb com lista de bullets), `limite_usuarios`, `limite_carteiras`, `ativo`, `ordem`

**`assinaturas`** — uma por imobiliária ou por corretor autônomo
- `plano_id`, `imobiliaria_id` (nullable), `usuario_id` (nullable — corretor autônomo), `ciclo` (`mensal`|`anual`), `valor`, `status` (`ativa`|`bloqueada`|`cancelada`|`trial`), `bloqueio_motivo`, `inicio_em`, `proximo_vencimento`, `ultimo_pagamento_em`
- CHECK: exatamente um de `imobiliaria_id` / `usuario_id` preenchido

**`pagamentos`** — histórico manual (gateway plugável depois)
- `assinatura_id`, `valor`, `metodo` (`pix`|`boleto`|`cartao`|`transferencia`|`outro`), `status` (`pago`|`pendente`|`atrasado`|`estornado`), `vencimento`, `pago_em`, `competencia` (mês/ano), `comprovante_url`, `observacao`, `registrado_por`

**`get_assinatura_ativa(_user_id)`** — RPC `SECURITY DEFINER` que devolve status efetivo do usuário (junta `corretores` → `imobiliaria` → `assinaturas`, ou direto pela assinatura individual).

**RLS**
- `planos`: SELECT autenticados; INSERT/UPDATE/DELETE só super_admin.
- `assinaturas` / `pagamentos`: SELECT só super_admin, secretaria e o próprio dono da imobiliária; mutação só super_admin/secretaria.
- GRANT padrão authenticated/service_role.

---

## Frontend

### Tirar autocadastro
- `src/routes/auth.tsx` — remover `<TabsContent value="cadastro">` e o `<TabsTrigger>`; manter só Login + Esqueci senha. Remover `handleSignup`.
- `src/routes/index.tsx` — botões "Assinar Plano" e "Começar Agora" deixam de apontar para `/auth`; passam para um link "Falar com Comercial" (mailto/WhatsApp) ou âncora `#planos` com texto "Solicite acesso ao comercial". Sem CTA de criar conta.
- Trigger `handle_new_user` continua existindo (cria profile quando admin convidar via Admin API), mas a tela de signup pública some.

### Acesso Negado / Bloqueio
- Novo: `src/routes/_authenticated/regularizacao.tsx` — mostra plano, valor, vencimento, "fale com seu gerente" + dados de contato.
- `_authenticated/route.tsx` é gerenciado; criar componente `<AssinaturaGate>` em `src/components/AssinaturaGate.tsx` consumido dentro de cada rota? Não: melhor um wrapper no `__root` da área autenticada via hook. Como o layout é managed, fazer:
  - Hook `useAssinaturaStatus()` que chama RPC `get_assinatura_ativa` no carregamento.
  - Componente `<RequireAssinatura>` envolvendo o `<Outlet />` dentro de cada página crítica — ou mais simples: criar arquivo `src/routes/_authenticated/_paywall.tsx` (pathless) e mover as rotas que exigem plano para dentro. Como mover tudo é grande, alternativa: gate no `Topbar` que, se `status !== 'ativa'`, sobrescreve o `<main>` com a tela de regularização. **Vou pelo gate no `AppLayout`** (já existe em `src/components/layout/`). Super Admin e Secretaria nunca são bloqueados.

### Menu Super Admin (sidebar)
- Adicionar grupo "Comercial" com: **Planos**, **Assinaturas**, **Pagamentos**.

### Telas (Super Admin / Secretaria)
- `_authenticated/planos.tsx` — CRUD: tabela + dialog com nome, tipo, preços, recursos (textarea linha-a-linha), limites, ativo.
- `_authenticated/assinaturas.tsx` — lista com filtro por status; criar/editar vincula a imobiliária OU usuário, define plano, ciclo, valor, vencimento, status. Ação rápida "Bloquear/Liberar".
- `_authenticated/assinaturas.$id.tsx` — detalhe: dados + tabela de pagamentos + botão "Registrar pagamento" (valor, método, vencimento, pago_em, competência, comprovante upload opcional, observação). Ao registrar pago, atualiza `ultimo_pagamento_em` e `proximo_vencimento` da assinatura.
- `_authenticated/pagamentos.tsx` — visão consolidada com filtros (status, mês, plano).

### Permissões
- Atualizar `src/lib/permissions.ts` adicionando os novos módulos para `super_admin` (full) e `secretaria` (gestão sem deletar planos).

---

## Detalhes técnicos

- **RPC `get_assinatura_ativa`**: retorna `{ status, plano_nome, proximo_vencimento, bloqueio_motivo }`. Resolve a partir do `auth.uid()` — primeiro tenta assinatura individual (`usuario_id`); se nada, busca corretor → imobiliária → assinatura.
- **Auto-bloqueio por atraso**: feito por trigger? Não — mantemos status manual nesta fase (o usuário escolheu "manual agora"). Super Admin marca como `bloqueada` quando quiser; tela de regularização aparece imediatamente.
- **Criação de usuário pelo Super Admin**: já há `usuarios.tsx` mockado; tornar real fica fora deste escopo (ele só pediu *retirar* o cadastro público + planos). A rota `/usuarios` continuará mockada — sinalizo isso ao final e ele pode pedir como próximo passo.
- **Landing**: mantém o desenho, só troca CTAs.

---

## Fora do escopo agora
- Integração Stripe/Paddle (estrutura pronta — `pagamentos.metodo` aceita `cartao`, podemos plugar webhook depois).
- CRUD real de usuários em `/usuarios` (mock continua) — peça em seguida se quiser.
- Cobrança automática / notificação por e-mail de vencimento.

---

## Ordem de execução
1. Migration (planos, assinaturas, pagamentos, RPC, RLS, GRANTs).
2. Tirar signup de `/auth` e da landing.
3. Criar `usePlanoAssinatura` + gate no layout autenticado + tela `/regularizacao`.
4. Telas CRUD: planos, assinaturas, detalhe, pagamentos.
5. Atualizar sidebar + permissions.