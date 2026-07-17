## Restringir menu da Secretária

A **Secretária** só verá/acessará: **Imóveis**, **Empreendimentos** (Condomínios / Edifícios / Loteamentos), **Banco de Imagens** e **Tabela** (+ Perfil e Notificações).

Ficam **ocultos** para ela: Dashboard, Oportunidades, Relatórios, Relatórios Admin, Clientes, Usuários, Planos, Assinaturas, Exportação, Feeds XML, Portais, Auditoria, Segurança, Configurações, Importações.

### Alterações

**`src/lib/permissions.ts`**
- Adicionar lista `SECRETARIA_ALLOW` com apenas as rotas permitidas:
  `/imoveis`, `/edificios`, `/condominios`, `/loteamentos`, `/biblioteca`, `/tabela`, `/perfil`, `/notificacoes`, `/favoritos`.
- Ajustar `canAccess(path, roles)`: se o papel principal for `secretaria`, permitir apenas caminhos dessa lista (ignora `ROUTE_ACCESS` para ela).
- Ajustar `primaryRole` se necessário para garantir que secretaria seja detectada corretamente.

Isso já filtra automaticamente:
- **Sidebar** (`AppSidebar.tsx`) — só mostra itens/seções permitidos (usa `canAccess`).
- **Guardas de rota** em `_authenticated/*` que usam `canAccess`.

Não mexer em nada de UI além de esconder — a lógica é toda no `permissions.ts`.
