# MV Broker — Auditoria e Arquitetura API First

Entrega desta etapa: **somente diagnóstico + arquitetura + plano**. Nenhuma mudança estrutural será feita sem sua aprovação.

## 1. Arquitetura atual encontrada

- **Frontend/Backend**: TanStack Start (React 19 + Vite), rotas em `src/routes`, SSR. Backend = server functions (`src/lib/*.functions.ts`, ~2.3k linhas) + rotas HTTP em `src/routes/api/public/*` (feeds XML, imóvel público, proxy de imagem).
- **Banco**: Postgres gerenciado (Lovable Cloud), ~45 tabelas, RLS ligado, ~40 funções `SECURITY DEFINER` (`has_role`, `get_imovel_internal`, `get_ranking_*`, etc.).
- **Auth**: e-mail/senha + `user_roles` (enum `app_role`: super_admin, secretaria, imobiliaria, corretor_imobiliaria, corretor_autonomo…), com camada extra de `custom_roles`, `role_module_permissions`, `user_module_permissions`.
- **Storage**: 8 buckets privados, acesso por URL assinada.
- **Modelo imobiliário**: tabela única `imoveis` (~90 colunas) misturando imóvel físico, empreendimento, características e condição comercial. Estruturas paralelas: `edificios`, `condominios`, `loteamentos`, `empreendimentos` (4 tabelas quase idênticas) + `espelho_unidades` como espelho de disponibilidade.
- **Distribuição**: feeds XML (VRSync) por rota pública, `carteiras` para feed personalizado por usuário.

## 2. Problemas encontrados

1. **Sem camada de API**: regra de negócio espalhada entre componentes React, server functions e triggers SQL. Não há contrato reutilizável por app mobile/parceiro.
2. **Modelo achatado**: `imoveis` acumula empreendimento + tipologia + unidade + oferta. Duplicação de endereço, infraestrutura e comissão em cada registro.
3. **4 tabelas de empreendimento** (`edificios`, `condominios`, `loteamentos`, `empreendimentos`) com colunas praticamente idênticas → código com `if tipo` em todo lugar, e duplicatas por nome (já existe `empreendimento-dedupe.ts` como remendo).
4. **Multi-tenant incompleto**: `imoveis.imobiliaria_id` existe mas grande parte das políticas é por papel global, não por tenant. Não há isolamento real entre imobiliárias.
5. **Sem API Keys / webhooks / versionamento**: integrações externas hoje só via XML público.
6. **Sem paginação padrão nem envelope de resposta**; várias telas fazem `select *` completo.
7. **Preço/oferta sem histórico**: não há `previous_price` nem trilha de mudança comercial (apenas `audit_logs` genérico).

## 3. Arquitetura API First recomendada

```text
Web MV Broker | App mobile | Parceiros | Portais | IA
                     ↓
        /api/v1  (REST versionada, envelope padrão)
                     ↓
        Camada de serviços (regras de negócio)
                     ↓
        Repositórios → Postgres (RLS por agency) / Storage / Filas
```

- Server functions continuam existindo, mas passam a **chamar os mesmos serviços** que a API REST — nunca lógica duplicada.
- Autenticação dupla no mesmo pipeline: **Bearer JWT** (usuário logado) ou **API Key** (integração).
- Todo endpoint responde `{ success, data, meta }` ou `{ success: false, error: { code, message } }`.

## 4. Entidades e relacionamentos

```text
agencies 1─┬─* brokers
           ├─* api_keys
           ├─* webhooks
           └─* developments 1─* typologies 1─* units 1─* offers
                       │                       │
                       └────── media ──────────┘  (polimórfica)

catalogs *─* units (catalog_properties) → catalog_templates → generated_files
external_sources → external_mappings → sync_jobs → connectors
```

## 5. Empreendimento → Tipologia → Unidade → Oferta

| Camada | Responsabilidade | Exemplo Sense | Exemplo Trend Carlos Gomes |
|---|---|---|---|
| Development | Local, construtora, infraestrutura | Condomínio Sense, Xangri-Lá | Trend Carlos Gomes, Porto Alegre |
| Typology | Produto padrão | Sobrado 5 suítes, 472 m² | Apto 1 dorm, 66,20 m², 1 vaga |
| Unit | Imóvel físico | Quadra B / Lote 10 | Unidade 608 |
| Offer | Condição comercial | R$ 8.900.000, disponível | Venda R$ 695.000 + locação R$ 3.900 |

## 6. Tabelas novas necessárias

Núcleo: `agencies`, `brokers` (evolução de `corretores`), `developments`, `typologies`, `units`, `offers`, `media`.
Integração: `api_keys`, `api_key_scopes`, `webhooks`, `webhook_deliveries`, `api_request_logs`.
Catálogo: `catalogs`, `catalog_properties`, `catalog_templates`, `generated_files`.
Sincronização: `connectors`, `external_sources`, `external_mappings`, `sync_jobs`.
Todas com `agency_id`, `created_at`, `updated_at`, GRANTs explícitos e RLS por tenant.

## 7. Tabelas existentes reaproveitadas

- `imobiliarias` → base de `agencies` (renomeia conceitualmente, mantém tabela).
- `corretores` → base de `brokers` (adicionar instagram, logo).
- `empreendimentos` / `edificios` / `condominios` / `loteamentos` → **consolidados** em `developments` com coluna `type` (mantidos como views de compatibilidade durante a transição).
- `imoveis` → origem de `units` + `offers` (mantida intacta na Fase 3; sincronizada por trigger).
- `imovel_imagens`, `estrutura_imagens` → migram para `media`.
- `espelho_unidades` → passa a ser derivada de `units` + `offers.status`.
- `audit_logs`, `user_roles`, `role_module_permissions`, `notifications` → mantidos como estão.

## 8. Endpoints propostos

```text
/api/v1/developments            GET POST
/api/v1/developments/:id        GET PATCH
/api/v1/developments/:id/typologies GET
/api/v1/typologies/:id          GET PATCH
/api/v1/typologies/:id/units    GET
/api/v1/units                   GET POST
/api/v1/units/:id               GET PATCH
/api/v1/units/:id/offers        GET POST
/api/v1/offers/:id              PATCH
/api/v1/properties              GET   (visão agregada + filtros)
/api/v1/brokers                 GET POST /:id GET PATCH
/api/v1/agencies                GET /:id GET PATCH
/api/v1/media                   POST /:id PATCH DELETE
/api/v1/catalogs                GET POST /:id GET PATCH
/api/v1/catalogs/:id/properties POST
/api/v1/catalogs/:id/generate   POST
/api/v1/ai/import-properties    POST  (retorna proposta, nunca grava direto)
/api/v1/webhooks                GET POST /:id PATCH DELETE
/api/v1/openapi.json  +  /api/v1/docs (Swagger UI)
```

`GET /api/v1/properties` aceita: `city, neighborhood, development_id, property_type, bedrooms, suites, parking, min_area, max_area, min_price, max_price, transaction_type, status, launch, exclusive, broker_id, agency_id, page, per_page, sort`.

## 9. Estratégia de autenticação

Middleware único resolve o "principal":
1. `Authorization: Bearer <supabase_jwt>` → usuário + papéis + `agency_id`.
2. `Authorization: Bearer <mvb_live_...>` → API Key → agency + scopes, papel `INTEGRATION`.

Papéis mapeados: ADMIN (super_admin), GESTOR (imobiliaria/secretaria), CORRETOR (corretor_*), INTEGRATION (api key). Cada rota declara scope exigido; o banco reforça com RLS por `agency_id`.

## 10. Estratégia de API Keys

- Formato `mvb_live_<32 bytes base62>`; guarda-se apenas `key_hash` (SHA-256 + prefixo visível para identificação).
- Chave em texto puro exibida **uma única vez** na criação.
- Campos: `agency_id`, `name`, `permissions[]` (scopes), `last_used_at`, `expires_at`, `active`.
- Rate limiting por chave (janela deslizante em tabela + índice) e log em `api_request_logs`.

## 11. Integração com APIs externas

Padrão Adapter, sem contaminar o banco:

```text
API externa → Adapter (OruloAdapter, CrmAdapter) → DTO MV Broker → Serviço → Banco
```

- `external_sources` guarda credenciais por tenant (segredos só no backend).
- `external_mappings` faz de-para campo a campo.
- `sync_jobs` registra execução, `external_id`/`external_source`/`last_sync_at`/`sync_status` ficam nas entidades.
- Dedupe antes de inserir empreendimento: `external_id` → nome normalizado + cidade → endereço + incorporadora; havendo colisão, entra em fila de revisão manual.
- Órulo: **apenas o adapter e a interface**, sem chamada real até haver credenciais e leitura oficial da documentação.

## 12. Plano de migração sem perda de dados

1. Criar tabelas novas vazias (nada é apagado).
2. Backfill: `empreendimentos/edificios/condominios/loteamentos` → `developments`; agrupar `imoveis` por (development, tipo, dorms, suítes, área) → `typologies`; cada `imovel` → `units` + `offers`; `imovel_imagens` → `media`.
3. Guardar `legacy_imovel_id` em `units` para rastreabilidade.
4. Fase de convivência: triggers mantêm `imoveis` e `units/offers` sincronizados nos dois sentidos; telas atuais continuam funcionando.
5. Migrar telas para a API v1 gradualmente.
6. Só depois de tudo migrado e validado, congelar `imoveis` como view de leitura.

## 13. Fases

- **Fase 1** — Auditoria (esta entrega).
- **Fase 2** — Aprovação da arquitetura. **Pausa aqui.**
- **Fase 3** — `developments`, `typologies`, `units`, `offers` + backfill + endpoints CRUD + `/properties`.
- **Fase 4** — `media`, `brokers`, `agencies`, multi-tenant e RLS por `agency_id`.
- **Fase 5** — API Keys, scopes, rate limit, OpenAPI/Swagger, webhooks, tela "API & Integrações" com playground.
- **Fase 6** — Catálogos, 10 templates dinâmicos, geração assíncrona de PDF.
- **Fase 7** — IA de importação com tela de revisão, connectors, adapters, sync jobs.

## Detalhes técnicos

- Serviços em `src/lib/api/services/*.ts` (server-only), rotas finas em `src/routes/api/v1/*`.
- Validação de payload com Zod em toda entrada; erros mapeados para códigos estáveis (`UNIT_NOT_FOUND`, `FORBIDDEN_SCOPE`…).
- Paginação por `page`/`per_page` (máx 100) com `meta.total`.
- Índices: `units(development_id, typology_id)`, `offers(unit_id, status)`, `developments(agency_id, city)`, GIN em amenities.
- PDFs e sincronizações rodam como job assíncrono com status consultável, nunca no request.
- Nenhuma alteração em `src/integrations/supabase/*` gerado, nem em `infra/`.

Aprovando, começo pela Fase 3 (developments → typologies → units → offers) com migração segura e sem quebrar as telas atuais.
