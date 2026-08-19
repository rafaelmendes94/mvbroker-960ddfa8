# API MV Broker — padrão Órulo (Developer → Building → Typology → Unit)

Hoje já existe uma base v1 (`developments`, `typologies`, `units`, `offers`, `api_keys`, `webhooks`, envelope `{success,data,meta}`, paginação, rate limit simples, OpenAPI). O que falta é o alinhamento ao modelo Órulo, a camada pública realmente segura (escopos, sharing, campos privados), leads, logs, sincronização incremental e o painel de API.

Não haverá perda de dados: nada é apagado, tudo é adicionado ou renomeado por compatibilidade.

## Etapa 1 — Modelo de dados

Novas tabelas:
- `developers` (construtora/incorporadora): nome, cnpj, site, logo, status, tenant.
- `unit_features`, `unit_media` (mídia por unidade com ordem/capa/tipo).
- `unit_history`: unit_id, campo, valor antigo, valor novo, quem alterou, origem (web/mobile/api/import/integration/admin).
- `api_logs`: request_id, api_key_id, agency_id, endpoint, método, status, ip, user agent, tempo de resposta. Nunca grava a chave.
- `leads`: unidade, nome, telefone, e-mail, mensagem, origem, status, tenant.
- `api_key_scopes` normalizado (hoje é um array em `api_keys`).

Alterações em tabelas existentes:
- `developments` (= Building) ganha `developer_id`, `public_id` (`bld_…`).
- `typologies` ganha `public_id` (`typ_…`).
- `units` ganha `public_id` (`unt_…`), `reference` (MV-xxxxx), `sharing_scope` (`private|agency|network|public_api`), `archived_at`, `floor`, `furnished`, `decorated`, `exclusive`, `sea_view`, `front_sea`, `property_type` normalizado, `transaction_type`, `price`, `currency`.
- Status padronizado: `available|reserved|sold|rented|inactive|archived`.
- `api_keys` ganha `environment` (`live|test`), `rate_limit_per_hour`, `field_scope` (lista de campos permitidos).
- Índices: city, neighborhood, status, price, updated_at, agency_id, building_id, typology_id, reference, public_id.

Migração: `developments → buildings` (conceitual, tabela mantida com o nome atual e exposta como `buildings` na API), tipologias já existem, `imoveis → units` já foi feito no backfill anterior e será complementado com os novos campos; `imoveis.construtora` gera registros em `developers` com de-duplicação por nome normalizado.

## Etapa 2 — Núcleo da API

- `resolvePrincipal` passa a distinguir `mvb_live_` e `mvb_test_`, carregar escopos da chave, `agency_id`/tenant e limite de requisições próprio.
- Escopos: `developers:read`, `buildings:read`, `typologies:read`, `units:read`, `units:write`, `media:read`, `leads:read`, `leads:write`, `reports:read`.
- Nenhuma chave nasce com acesso irrestrito.
- Camada de sanitização: serializers por entidade que só emitem campos públicos e respeitam o `field_scope` da chave. Campos internos (comissão, proprietário, observações internas, documentos, chaves) nunca saem na API pública.
- Regra de visibilidade das unidades na API pública: só retorna `sharing_scope in (public_api, network)` conforme a chave, mais o filtro de tenant. Acesso por ID segue a mesma regra (proteção contra IDOR).
- Mass assignment: POST/PATCH só aceitam listas explícitas de campos, validadas com Zod.
- Rate limit por chave, com `X-RateLimit-Limit/Remaining/Reset`.
- Log de cada requisição em `api_logs`.

## Etapa 3 — Endpoints

Públicos (`/api/public/v1`):
- `GET /health`
- `GET /developers`, `/developers/{id}`, `/developers/{id}/buildings`
- `GET /buildings`, `/buildings/{id}`, `/buildings/{id}/typologies`, `/buildings/{id}/units`
- `GET /typologies`, `/typologies/{id}`, `/typologies/{id}/units`
- `GET /units`, `/units/{id}`, `/units/{id}/media`
- `POST /units`, `PATCH /units/{id}`, `DELETE /units/{id}` (soft delete → `archived`)
- `POST /leads`

`GET /units` com todos os filtros pedidos (city, state, neighborhood, street, postal_code, building_id, developer_id, typology_id, property_type, transaction_type, bedrooms, suites, bathrooms, parking_spaces, min/max price, min/max private_area, status, furnished, decorated, exclusive, sea_view, front_sea, agency_id, agent_id, reference, created_after, updated_after), ordenação `sort=price|-price|created_at|-created_at|updated_at|-updated_at`, paginação `page`/`per_page` (padrão 50, máx 100) e bloco `pagination` na resposta.

Sincronização incremental via `updated_after` em units, buildings, typologies e developers.

A API interna (`/api/v1`, JWT) continua usando os mesmos serviços — sem lógica duplicada.

## Etapa 4 — Webhooks

Eventos: `building.created/updated`, `typology.created/updated`, `unit.created/updated/reserved/sold/rented/price_changed/archived`.
Assinatura HMAC-SHA256 com segredo próprio, reenvio automático com backoff, log de entregas com status HTTP e histórico de falhas.

## Etapa 5 — Painel da API

Rota `/integracoes` (Configurações → Desenvolvedores → API), só `super_admin`:
- Criar chave: nome, imobiliária vinculada, escopos, ambiente (live/test), rate limit, campos permitidos. Chave exibida uma única vez.
- Revogar, regenerar, suspender/ativar, ver último acesso e volume de requisições.
- Aba de logs com filtro por chave, endpoint, status e período.
- Aba de webhooks com entregas e reenvio manual.
- Dashboard: requisições hoje/mês, integrações ativas, taxa de erro, tempo médio de resposta, endpoints mais usados, falhas de webhook.

## Etapa 6 — Documentação e testes

- OpenAPI 3.1 completo em `/api/public/v1/openapi.json` e Swagger UI em `/api/docs`, com as seções Authentication, Organization of Properties, Developers, Buildings, Typologies, Units, Media, Filters, Pagination, Synchronization, Webhooks, Errors, Rate Limits, Examples.
- Testes automatizados (Vitest) cobrindo: autenticação por chave, escopo negado, IDOR entre tenants, filtros e paginação de units, soft delete, sanitização de campos privados, assinatura de webhook e rate limit.
- Documento técnico da arquitetura em `docs/API.md`.

## Detalhes técnicos

- Serviços em `src/lib/api/v1/*.server.ts`; rotas finas em `src/routes/api/v1/$.ts` e `src/routes/api/public/v1/$.ts`.
- IDs públicos com prefixo ULID-like (`dev_`, `bld_`, `typ_`, `unt_`, `agy_`, `agt_`, `med_`) gerados no banco, mantendo o UUID interno.
- Validação com Zod em toda entrada; erros com códigos estáveis e HTTP correto (400/401/403/404/409/422/429/500).
- Rate limit e logs persistidos no banco (o worker é stateless, o contador em memória atual não serve para produção).
- Sandbox: chaves `mvb_test_` restritas a registros marcados como demo; mesmo código, ambiente separado por flag da chave.
- Nada em `infra/` nem em `src/integrations/supabase/*` gerado será alterado.

## Ordem de execução

Etapas 1 e 2 primeiro (banco + núcleo seguro), depois 3, 4, 5 e 6. Cada etapa é entregue funcionando de ponta a ponta contra o banco real, sem dados simulados.
